Scene = {}

Scene.init = function() {
    Scene.planet = new Scene.Planet; // will in turn call makeWorld asynchronously
}

Scene.makeWorld = function() {
    Scene.objects = [];
    for (var i in Connection.characters)
        Scene.createCharacter(i, Connection.characters[i]);
    Connection.characters = null; // We won't need it anymore.

    Scene.player = Scene.objects[Connection.clientId];
    Scene.player.model.add(View.pivot);

    // calling getSquareUvFromSphericalPosition because the square uvs have not been
    // computed client-side
    var sphericalPosition = Scene.player.sphericalPosition;
    var squareUv = Game.getSquareUvFromSphericalPosition(
        sphericalPosition.theta, sphericalPosition.phi, Scene.planet);
    Scene.planet.updateTerrain(squareUv.uv, squareUv.square);
    View.pivot.position.y = Scene.player.eyeAltitude-Scene.player.size.height/2;
    View.sun.target = Scene.player.model;
    Game.init();
}

Scene.createCharacter = function(characterId, characterData) {
    var character = new Scene.Character(characterData);
    Scene.objects[characterId] = character;
    character.model.rotation.order = 'ZXY';
    View.scene.add(character.model);
}

Scene.removeCharacter = function(characterId) {
    var character = Scene.objects[characterId];
    View.scene.remove(character.model);
    delete Scene.objects[characterId];
}

Scene.Planet = function() {
    this.radius = 100;
    this.minAltitude = -2.5;
    this.maxAltitude = 2.5;
    this.gravity = .0001;
    this.blocksPerSide = 8; // The number of blocks in a square is the square of this.
    this.coordInds = [
        [[1, 2], [1, 0], [1, 2]],
        [[2, 1], [0, 1], [2, 1]],
        [[0, 0], [2, 2], [0, 0]]];
    this.coordSigns = [
        [[1, -1], [1, 1], [1, 1]],
        [[-1, 1], [1, 1], [1, 1]],
        [[-1, 1], [-1, 1], [1, -1]]];
    this.squareInds = [
        [[0, 1], [2, 1]],
        [[0, 0], [2, 0]],
        [[1, 0], [1, 1]]];
    this.uSigns = [[-1, 1], [1, 1], [1, -1]];
    this.blockLoadDistance = 1;
    this.blockUnloadDistance = 3; // must be at least 2 more than blockLoadDistance

    this.blocks = {};
    this.terrainVisitor = new Scene.TerrainVisitor(this);

    // altitude
    var planet = this;
    var img = new Image;
    img.onload = function() {
        planet.setAltitudeMap(this);
        Scene.makeWorld(); // populate scene with objects and update terrain
    };
    img.src = 'img/altitude.png';

    // view: material
    var diffuseTexture = new THREE.TextureLoader().load("img/map.png");
    this.material = new THREE.MeshPhongMaterial({map: diffuseTexture});
}

Scene.Planet.prototype.setAltitudeMap = function(img) {
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    this.altitudeMap = {};
    this.altitudeMap.width = img.width;
    this.altitudeMap.height = img.height;

    // copy only red channel of img into altitudeMap
    var imgData = ctx.getImageData(0, 0, img.width, img.height).data;
    this.altitudeMap.data = [];
    for (var i = 0; i < imgData.length/4; i++) {
        this.altitudeMap.data[i] = imgData[4*i];
    }
}

Scene.Planet.prototype.updateTerrain = function(uv, square) {
    var blockInd = Game.getBlockIndFromUv(uv, this);

    // unload far away blocks
    for (var id in this.blocks) {
        var block = this.blocks[id];
        var j = id%this.blocksPerSide;
        var tmp = (id-j)/this.blocksPerSide;
        var i = tmp%this.blocksPerSide;
        tmp = (tmp-i)/this.blocksPerSide;
        var jSquare = tmp%2;
        var iSquare = (tmp-jSquare)/2;
        var d = this.blockDistance(blockInd, square, [i, j], [iSquare, jSquare]);
        if (d > this.blockUnloadDistance) {
            this.terrainVisitor.deleteBlockNode(this.blocks[id]);
            delete this.blocks[id];
        }
    }

    // load all blocks within a radius of blockLoadDistance
    for (var i = -this.blockLoadDistance; i <= this.blockLoadDistance; i++) {
        for (var j = -this.blockLoadDistance; j <= this.blockLoadDistance; j++) {
            var indSquare = this.blockAdd(blockInd, square, [i, j]);
            if (indSquare == null) {
                continue;
            }
            var ind = indSquare[0];
            var sqr = indSquare[1];
            var id = this.getBlockIdFromInd(ind, sqr);
            if (this.blocks[id] != undefined) {
                continue; // block already exists
            }
            // schedule block creation after render
            var sqrUvBounds = [
                ind[0]/this.blocksPerSide, ind[1]/this.blocksPerSide,
                (ind[0]+1)/this.blocksPerSide, (ind[1]+1)/this.blocksPerSide
            ];
            Game.taskList.push({
                handler: function(data) {
                    // double-check block doesn't already exist
                    if (data.planet.blocks[data.id] != undefined) {
                        return;
                    }
                    data.planet.blocks[data.id] = {
                        mesh: View.makeBlock(
                            data.square, data.sqrUvBounds, data.planet),
                        subBlocks: []
                    }

                    View.scene.add(data.planet.blocks[data.id].mesh);
                },
                data: {planet: this, id: id, square: sqr, sqrUvBounds: sqrUvBounds}
            });
        }
    }

    // visit all existing blocks and refine every leaf down to the required depth
    this.terrainVisitor.square = square;
    this.terrainVisitor.uv = uv;
    for (var id in this.blocks) {
        var node = this.blocks[id];
        var j = id%this.blocksPerSide;
        var tmp = (id-j)/this.blocksPerSide;
        var i = tmp%this.blocksPerSide;
        tmp = (tmp-i)/this.blocksPerSide;
        var jSquare = tmp%2;
        var iSquare = (tmp-jSquare)/2;
        var sqrUvBounds = [
            i/this.blocksPerSide, j/this.blocksPerSide,
            (i+1)/this.blocksPerSide, (j+1)/this.blocksPerSide
        ];
        this.terrainVisitor.visitBlockNode(
            node,
            '',
            [i, j],
            [iSquare, jSquare],
            sqrUvBounds);
    }
}

// returns the distance between uv and the nearest point on the given uv bounds
// in UV units
Scene.Planet.prototype.uvToBoundsDistance = function(
    uv, square0, sqrUvBounds, square1) {
    if (square0[0] == square1[0] && square0[1] == square1[1]) {
        return Geom.pointToBoundsDistance(uv, sqrUvBounds);
    } else {
        var coords = [];
        coords[0] = uv[0]-0.5;
        coords[1] = uv[1]-0.5;
        coords[2] = 0.5;
        var posOnCube = this.getUnorientedCoordinates(coords, square0);
        coords[0] = sqrUvBounds[0]-0.5;
        coords[1] = sqrUvBounds[1]-0.5;
        var minOnCube = this.getUnorientedCoordinates(coords, square1);
        coords[0] = sqrUvBounds[2]-0.5;
        coords[1] = sqrUvBounds[3]-0.5;
        var maxOnCube = this.getUnorientedCoordinates(coords, square1);
        return Geom.pointToBoundsDistance(posOnCube, minOnCube.concat(maxOnCube));
    }
}

// returns the distance in terms of blocks between two blocks
Scene.Planet.prototype.blockDistance = function(ind0, square0, ind1, square1) {
    if (square0[0] == square1[0] && square0[1] == square1[1])
        return Geom.dist(ind0, ind1, 0);
    else {
        var coords = [];
        coords[0] = ind0[0]-this.blocksPerSide/2+0.5;
        coords[1] = ind0[1]-this.blocksPerSide/2+0.5;
        coords[2] = this.blocksPerSide/2;
        var a = this.getUnorientedCoordinates(coords, square0);
        coords[0] = ind1[0]-this.blocksPerSide/2+0.5;
        coords[1] = ind1[1]-this.blocksPerSide/2+0.5;
        var b = this.getUnorientedCoordinates(coords, square1);
        return Geom.dist(a, b, 0);
    }
}

// Return the index and square of the block at the postion of the block at index ind
// in the given square, translated by t
// t is a translation vector in terms of block indices
// t must be less than blocksPerSide
Scene.Planet.prototype.blockAdd = function(ind, square, t) {
    var i = ind[0]+t[0];
    var j = ind[1]+t[1];
    var coordsOutBounds = 0;
    var sideInd; // index of the result on a side square
    if (i < 0) {
        sideInd = [-1, j, this.blocksPerSide+i]
        coordsOutBounds++;
    } else if (i >= this.blocksPerSide) {
        sideInd = [this.blocksPerSide, j, 2*this.blocksPerSide-i-1];
        coordsOutBounds++;
    }
    if (j < 0) {
        sideInd = [i, -1, this.blocksPerSide+j]
        coordsOutBounds++;
    } else if (j >= this.blocksPerSide) {
        sideInd = [i, this.blocksPerSide, 2*this.blocksPerSide-j-1];
        coordsOutBounds++;
    }
    if (!coordsOutBounds)
        return [[i, j], square];
    else if (coordsOutBounds > 1)
        return null; // such a block doesn't exist
    else {
        // convert sideInd into absolute coordinates
        for (iCoord = 0; iCoord < 3; iCoord++)
            sideInd[iCoord] -= (this.blocksPerSide-1)/2;
        var coords = this.getUnorientedCoordinates(sideInd, square);

        // find square
        // find biggest coordinate
        var wInd = 0;
        var w = 0;
        for (var i = 0; i < 3; i++) {
            if (Math.abs(coords[i]) > Math.abs(w)) {
                w = coords[i];
                wInd = i;
            }
        }
        var resSquare = this.squareInds[wInd][Number(w >= 0)];

        // convert coords into resSquare coordinate system
        var blockInd = this.getOrientedCoordinates(coords, resSquare);
        for (iCoord = 0; iCoord < 3; iCoord++)
            blockInd[iCoord] += (this.blocksPerSide-1)/2;

        return [[blockInd[0], blockInd[1]], resSquare];
    }    
}

Scene.Planet.prototype.getBlockIdFromInd = function(ind, square) {
    var squareId = square[0]*2+square[1];
    return (squareId*this.blocksPerSide+ind[0])*this.blocksPerSide+ind[1];
}

Scene.Planet.prototype.getUnorientedCoordinates = function(coords, square) {
    var res = [];
    var i = square[0];
    var j = square[1];
    for (var k = 0; k < 3; k++)
        res[k] = this.coordSigns[k][i][j]*coords[this.coordInds[k][i][j]];
    return res;
}

Scene.Planet.prototype.getOrientedCoordinates = function(coords, square) {
    var res = [];
    var i = square[0];
    var j = square[1];
    for (var k = 0; k < 3; k++)
        res[this.coordInds[k][i][j]] = this.coordSigns[k][i][j]*coords[k];
    return res;
}

// helper class grouping information needed when visiting a planet's terrain
// and the recursive methods to do so
Scene.TerrainVisitor = function(planet) {
    this.planet = planet;

    // maximum distance, in UV units, at which blocks at 0-depth are loaded
    // The distance at which blocks at maximum depth are loaded is 0
    // and the distance at other depths is determined linearly from these rules
    this.loadDist = 0.25;

    // in UV coordinates
    // Blocks are unloaded unloadOffset further away than the distance at which
    // they're loaded, regardless of the depth
    this.unloadOffset = 0.05;

    this.depthMax = 3;

    this.uv = null; // UV coordinates of the player on the square
    this.square = null; // square where the player is located
}

// recursively delete block and all its branches, also removing any representation
// from the view
Scene.TerrainVisitor.prototype.deleteBlockNode = function(node) {
    View.scene.remove(node.mesh);
    for (var i in node.subBlocks)
        this.deleteBlockNode(node.subBlocks[i]);
    node.subBlocks = [];
    delete node.mesh;
}

// recursively visit block to load/unload the sub-blocks that need to be
Scene.TerrainVisitor.prototype.visitBlockNode = function(
    node, path, blockInd, square, sqrUvBounds) {
    // compute distance
    var d = this.planet.uvToBoundsDistance(this.uv, this.square, sqrUvBounds, square);
    var depth = path.length;
    var weightedDist = this.loadDist*(1-depth/this.depthMax);

    if (node.subBlocks.length) {
        // block has children

        if (!node.mesh) {
            console.error('Block has children but no mesh');
            return;
        }

        // decide if sub-blocks should be deleted
        if (d > weightedDist+this.unloadOffset) {

            // node is too far - delete its children
            for (var i in node.subBlocks)
                this.deleteBlockNode(node.subBlocks[i]);
            node.subBlocks = [];

            // and show parent block instead
            View.scene.add(node.mesh);

        } else if (node.subBlocks.length == 4) {
            // block is not too far and has all its children

            // if it is shown in scene, hide it
            var nodeInScene = node.mesh.parent === View.scene;
            if (nodeInScene)
                View.scene.remove(node.mesh);

            // visit children nodes
            // don't visit sub-blocks until all four are available
            for (var i = 0; i < 4; i++)
            {
                // if node block was shown in scene (and now hidden),
                // show the 4 sub-blocks
                if (nodeInScene)
                    View.scene.add(node.subBlocks[i].mesh);

                // split sqrUvBounds into 4 quarters based on i
                var childSqrUvBounds = Geom.getBoundsQuarter(sqrUvBounds, i);
                this.visitBlockNode(
                    node.subBlocks[i],
                    path+String(i),
                    blockInd,
                    square,
                    childSqrUvBounds);
            }
        }
    } else if (d <= weightedDist) {
        // block has no child and is near enough
        // refine it by spawning 4 children
        for (var i = 0; i < 4; i++) {
            var childPath = path+String(i);
            // schedule block creation after render
            Game.taskList.push({
                handler: function(data) {
                    // check block list still exists
                    if (!data.blockList)
                    {
                        console.error('Creating block in non-existent list');
                        return;
                    }
                    // check block doesn't already exist
                    if (data.blockList[data.id])
                        return;
                    var subX = data.id%2;
                    var subY = (data.id-subX)/2;
                    data.blockList[data.id] = {
                        mesh: View.makeBlock(
                            data.square, data.sqrUvBounds, data.planet),
                        subBlocks: []
                    }
                },
                data: {
                    planet: this.planet,
                    blockList: node.subBlocks,
                    id: i,
                    square: square,
                    sqrUvBounds: Geom.getBoundsQuarter(sqrUvBounds, i)
                }
            });
        }
    }
}

Scene.Character = function(data) {
    // characteristics
    this.speed = .007;
    this.angularSpeed = .002;
    this.jumpSpeed = .02;
    this.eyeAltitude = 1;
    this.size = {
        "width": .4,
        "height": 1
    };

    // state
    this.bearing = data.bearing;
    this.sphericalPosition = data.sphericalPosition;
    this.altitude = data.altitude;
    this.groundAltitude = this.altitude;
    this.velocity = [0, 0];
    this.currentActions = {};
    this.balloonText = '';

    // view
    this.model = View.makeCharacter(this.size.width, this.size.height);
}

Scene.Character.prototype.updateBalloon = function(text) {
    if (text != this.balloonText) {
        this.balloonText = text;
        if (text) {
            View.makeBalloon(text, this);
        } else {
            if (this.balloonModel)
                this.model.remove(this.balloonModel);
            this.balloonModel = null;
        }
    }
}