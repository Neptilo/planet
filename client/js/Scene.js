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

    // calling getSquareUvFromSphericalPosition because the square uvs have not been
    // computed client-side
    var sphericalPosition = Scene.player.sphericalPosition;
    var squareUv = Game.getSquareUvFromSphericalPosition(
        sphericalPosition.theta, sphericalPosition.phi, Scene.planet);
    Scene.planet.updateTerrain(squareUv.uv, squareUv.square);
    if (View.onPlayerSetup)
        View.onPlayerSetup(Scene.player);
    Game.init();
}

Scene.createCharacter = function(characterId, characterData) {
    Scene.objects[characterId] = new Scene.Character(characterData);
}

Scene.removeCharacter = function(characterId) {
    var character = Scene.objects[characterId];
    View.remove(character.model);
    delete Scene.objects[characterId];
}

Scene.Planet = function() {
    // TODO These parameters have been divided by 10 for testing
    // Multiply them by 10 before merging.
    this.radius = 10;
    this.minAltitude = -.25;
    this.maxAltitude = .25;

    this.gravity = .0001;
    // TODO Reset to 8 before merging
    this.blocksPerSide = 4; // The number of blocks in a square is the square of this.

    /* Mapping of each square to its orthogonal axis and direction in world space
        +--+--+--+
        |x-|z+|x+|
        +--+--+--+
        |y-|z-|y+|
        +--+--+--+ */

    // coordInds[k][i][j] gives the axis, in local square space, (u, v, w)
    // representing the k-th world-space dimension (x, y, z) for square [i, j].
    // coordSigns[k][i][j] is the direction of that axis.
    this.coordInds = [
        [[1, 2], [1, 0], [1, 2]],
        [[2, 1], [0, 1], [2, 1]],
        [[0, 0], [2, 2], [0, 0]]];
    this.coordSigns = [
        [[1, -1], [1, 1], [1, 1]],
        [[-1, 1], [1, 1], [1, 1]],
        [[-1, 1], [-1, 1], [1, -1]]];

    // squareInds[dim][pos] are the indices of the square orthogonal to the dim
    // axis and on the positive (resp. negative) side if pos is 1 (resp. 0).
    // uSigns[dim][pos] represents the direction of the first axis of
    // that square in world space.
    this.squareInds = [
        [[0, 1], [2, 1]],
        [[0, 0], [2, 0]],
        [[1, 0], [1, 1]]];
    this.uSigns = [[-1, 1], [1, 1], [1, -1]];

    this.blockLoadDistance = 1; // must be at least 1
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
    this.material = new THREE.MeshBasicMaterial({
        // TODO clean comments before merge
        //wireframe: true,
        //vertexColors: THREE.FaceColors,
        //color: new THREE.Color(1/2, 1/2, 1/2)
        map: diffuseTexture
    });
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
        if (d > this.blockUnloadDistance)
            this.terrainVisitor.deleteBlockNode(null, id, id+'/');
    }

    // load all blocks within a radius of blockLoadDistance
    for (var i = -this.blockLoadDistance; i <= this.blockLoadDistance; i++) {
        for (var j = -this.blockLoadDistance; j <= this.blockLoadDistance; j++) {
            var indSquare = this.blockAdd(blockInd, square, [i, j]);
            if (indSquare == null)
                continue;
            var ind = indSquare[0];
            var sqr = indSquare[1];
            var id = this.getBlockIdFromInd(ind, sqr);
            if (this.blocks[id] != undefined)
                continue; // block already exists

            // schedule block creation after render
            var sqrUvBounds = [
                ind[0]/this.blocksPerSide, ind[1]/this.blocksPerSide,
                (ind[0]+1)/this.blocksPerSide, (ind[1]+1)/this.blocksPerSide
            ];
            this.createBlockLater(null, id, sqr, sqrUvBounds, id+'/');
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
            0,
            id+'/',
            [i, j],
            [iSquare, jSquare],
            sqrUvBounds);
    }
}

Scene.createBlock = function(data) {
    var blockList = data.parentNode ? data.parentNode.subBlocks : data.planet.blocks;

    // check block list still exists
    if (!blockList)
    {
        console.error('Creating block in non-existent list');
        return;
    }
    // check block doesn't already exist
    if (blockList[data.id])
        return;

    // create block
    Scene.setChild(
        data.parentNode,
        data.id,
        {
            mesh: View.makeBlock(
                data.square, data.sqrUvBounds, data.planet, data.name),
            subBlocks: [],
            faceBufferInd: [1, 1],
            neighbors: [[], [], [], []],
            name: data.name
        });
    var curBlock = blockList[data.id];

    // if block is top-level, show it right away
    // and connect neighbors
    // iNei represents -x, +x, -y, +y
    if (!data.parentNode) {
        if (curBlock.name != data.id+'/')
            console.error(curBlock.name, ' != ', data.id+'/', '. Is it normal?');
        View.addBlock(curBlock);
        for (var iNei = 0; iNei < 4; iNei++) {
            var dir = iNei%2;
            var dim = (iNei-dir)/2;
            var bps = data.planet.blocksPerSide
            var j = data.id%bps;
            var tmp = (data.id-j)/bps;
            var i = tmp%bps;
            tmp = (tmp-i)/bps;
            var jSquare = tmp%2;
            var iSquare = (tmp-jSquare)/2;
            var t = [0, 0];
            t[dim] = 2*dir-1;
            var indSqr = data.planet.blockAdd([i, j], [iSquare, jSquare], t);
            if (indSqr == null)
                continue;

            // express translation vector in new square space
            if (iSquare != indSqr[1][0] || jSquare != indSqr[1][1]) {
                // we moved to another square, so the translation vector is
                // flipped over an edge of the cube
                t = [0, 0, -Math.abs(t[0])-Math.abs(t[1])];

                var tWorld =
                    data.planet.getUnorientedCoordinates(t, [iSquare, jSquare]);
                t = data.planet.getOrientedCoordinates(tWorld, indSqr[1]);
                delete t[2];
            }

            var id = data.planet.getBlockIdFromInd(indSqr[0], indSqr[1]);
            var neighbor = data.planet.blocks[id];
            if (!neighbor)
                continue; // no neighbor here

            dim = Number(!t[0]);
            dir = Number(t[dim] < 0); // reverse direction for neighbor
            var iNeiRev = 2*dim+dir; // reverse neighbor index

            // set this node's neighbors and
            // set it as neighbor of its neighbors
            Scene.setNeighbors(curBlock, iNei, [neighbor]); // by default
            Scene.setNeighbors(neighbor, iNeiRev, [curBlock]);
            if (neighbor.subBlocks.length == 4) {
                // magic formulas that give the indices of the two
                // facing neighbor sub-blocks in the given direction
                var idA = (1+dim)*dir;
                var idB = idA+2-dim;
                var nodeInScene = View.isShown(neighbor.mesh);
                // only if parent neighbor is not shown,
                // set its children as neighbors
                if (!nodeInScene)
                    Scene.setNeighbors(curBlock, iNei, [
                        neighbor.subBlocks[idA],
                        neighbor.subBlocks[idB]]);
                Scene.setNeighbors(neighbor.subBlocks[idA], iNeiRev, [curBlock]);
                Scene.setNeighbors(neighbor.subBlocks[idB], iNeiRev, [curBlock]);
            } else if (neighbor.subBlocks.length)
                console.error('A block has sub-blocks but not 4.');
        }
    }
}

Scene.setNeighbors = function(node, ind, neighbors) {
    if (View.removeNeighbors)
        View.removeNeighbors(node, node.neighbors[ind]);
    node.neighbors[ind] = neighbors;
    if (View.addNeighbors)
        View.addNeighbors(node, neighbors);
}

Scene.setChild = function(node, ind, child) {
    var blockList = node ? node.subBlocks : this.planet.blocks;
    if (View.removeChild)
        View.removeChild(node, blockList[ind]);
    if (child) blockList[ind] = child;
    else delete blockList[ind];
    if (View.addChild)
        View.addChild(node, child);
}

Scene.Planet.prototype.createBlockLater = function(
    parentNode, id, square, sqrUvBounds, name) {
    Game.taskList.push({
        handler: Scene.createBlock,
        data: {
            planet:         this,
            parentNode:      parentNode,
            id:             id,
            square:         square,
            sqrUvBounds:    sqrUvBounds,name:name}
    });
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
// coordinates in t must be less than blocksPerSide
Scene.Planet.prototype.blockAdd = function(ind, square, t) {
    var i = ind[0]+t[0];
    var j = ind[1]+t[1];
    var coordsOutBounds = 0;
    var sideInd; // index of the result on a side square
    if (i < 0) {
        sideInd = [-1, j, this.blocksPerSide+i];
        coordsOutBounds++;
    } else if (i >= this.blocksPerSide) {
        sideInd = [this.blocksPerSide, j, 2*this.blocksPerSide-i-1];
        coordsOutBounds++;
    }
    if (j < 0) {
        sideInd = [i, -1, this.blocksPerSide+j];
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
    this.loadDist = 0.72;

    // in UV coordinates
    // Blocks are unloaded unloadOffset further away than the distance at which
    // they're loaded, regardless of the depth
    this.unloadOffset = 0.05;

    this.depthMax = 2;

    this.uv = null; // UV coordinates of the player on the square
    this.square = null; // square where the player is located
}

// recursively delete block and all its branches, also removing any representation
// from the view
Scene.TerrainVisitor.prototype.deleteBlockNode = function(parentNode, ind, path) {
    var blockList = parentNode ? parentNode.subBlocks : Scene.planet.blocks;
    var node = blockList[ind];
    View.remove(node.mesh);
    for (var i in node.subBlocks)
        this.deleteBlockNode(node, i, path+String(i));
    node.subBlocks = [];
    Scene.setChild(parentNode, ind, null);
}

// recursively visit block to load/unload the sub-blocks that need to be
Scene.TerrainVisitor.prototype.visitBlockNode = function(
    node, depth, path, blockInd, square, sqrUvBounds) {
    // compute distance
    var d = this.planet.uvToBoundsDistance(this.uv, this.square, sqrUvBounds, square);
    var weightedDist = this.loadDist*(1-depth/this.depthMax);

    if (node.subBlocks.length) {
        // block has children

        if (!node.mesh) {
            console.error('Block has children but no mesh');
            return;
        }

        // decide if sub-blocks should be deleted
        if (d > weightedDist+this.unloadOffset) {

            // node is too far - delete its children if possible
            var anyNodeInScene = false;
            var mayUnrefine = true;
            for (var i in node.subBlocks) {
                var subBlock = node.subBlocks[i];
                anyNodeInScene |= View.isShown(subBlock.mesh);
                for (var iNei in subBlock.neighbors) {
                    if (subBlock.neighbors[iNei].length == 2) {
                        mayUnrefine = false;
                        break;
                    }
                }
                if (!mayUnrefine) break;
            }

            if (anyNodeInScene && mayUnrefine) {
                // merge neighbors from its children
                // and connect the obtained neighbors
                node.neighbors = [[], [], [], []];
                for (var i in node.subBlocks) {
                    var x = i%2;
                    var y = (i-x)/2;
                    var childXNeighbors = node.subBlocks[i].neighbors[x];
                    // since mayUnrefine is true, all sub-blocks have at most
                    // 1 neighbor on each side
                    if (childXNeighbors.length) {
                        var xNeighbors = node.neighbors[x];
                        // check the parent node doesn't already have the
                        // neighbor we're about to add
                        if (!xNeighbors.length ||
                            xNeighbors[0] !== childXNeighbors[0]) {
                            xNeighbors.push(childXNeighbors[0]);
                            Scene.setNeighbors(childXNeighbors[0], 1-x, [node]);
                            // if we've added 2 neighbors on the same side,
                            // those neighbors must have coarser sides
                            if (xNeighbors.length == 2) {
                                xNeighbors[0].faceBufferInd[0] = 2*(1-x);
                                View.updateBlockFaceBuffer(xNeighbors[0]);
                                xNeighbors[1].faceBufferInd[0] = 2*(1-x);
                                View.updateBlockFaceBuffer(xNeighbors[1]);
                            }
                        }
                    }
                    var childYNeighbors = node.subBlocks[i].neighbors[2+y];
                    if (childYNeighbors.length) {
                        var yNeighbors = node.neighbors[2+y];
                        if (!yNeighbors.length ||
                            yNeighbors[0] !== childYNeighbors[0]) {
                            yNeighbors.push(childYNeighbors[0]);
                            Scene.setNeighbors(childYNeighbors[0], 3-y, [node]);
                            if (yNeighbors.length == 2) {
                                yNeighbors[0].faceBufferInd[1] = 2*(1-y);
                                View.updateBlockFaceBuffer(yNeighbors[0]);
                                yNeighbors[1].faceBufferInd[1] = 2*(1-y);
                                View.updateBlockFaceBuffer(yNeighbors[1]);
                            }
                        }
                    }
                }

                // delete children
                for (var i in node.subBlocks)
                    this.deleteBlockNode(node, i, path+String(i));

                node.subBlocks = [];

                // show parent block
                View.addBlock(node);
                node.name = path;
            }

        } else if (node.subBlocks.length == 4) {
            // block is not too far and has all its children

            // if it is shown in scene, hide it
            var nodeInScene = View.isShown(node.mesh);
            var mayRefine =
                node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
            if (nodeInScene && mayRefine) {
                View.remove(node.mesh);
            }

            // visit children nodes
            // don't visit sub-blocks until all four are available
            for (var i = 0; i < 4; i++) {
                // if node block was shown in scene (and now hidden),
                // connect the 4 sub-blocks' neighbors and show them
                if (nodeInScene && mayRefine) {
                    // connect internal neighbors
                    var x = i%2;
                    var y = (i-x)/2;
                    Scene.setNeighbors(node.subBlocks[i], 1-x,
                        [node.subBlocks[2*y+(1-x)]]);
                    Scene.setNeighbors(node.subBlocks[i], 3-y,
                        [node.subBlocks[2*(1-y)+x]]);

                    // connect external neighbors
                    var xNeighbors = node.neighbors[x];
                    switch (xNeighbors.length) {
                        case 1:
                            Scene.setNeighbors(node.subBlocks[i], x, [xNeighbors[0]]);
                            node.subBlocks[i].faceBufferInd[0] = 2*x;
                            if (y == 0)
                                Scene.setNeighbors(xNeighbors[0], 1-x, [
                                    node.subBlocks[x],
                                    node.subBlocks[2+x]]);
                            break;
                        case 2:
                            Scene.setNeighbors(node.subBlocks[i], x, [xNeighbors[y]]);
                            Scene.setNeighbors(xNeighbors[y], 1-x, [node.subBlocks[i]]);
                            xNeighbors[y].faceBufferInd[0] = 1;
                            View.updateBlockFaceBuffer(xNeighbors[y]);
                            break;
                    }
                    var yNeighbors = node.neighbors[2+y];
                    switch (yNeighbors.length) {
                        case 1:
                            Scene.setNeighbors(node.subBlocks[i], 2+y, [yNeighbors[0]]);
                            node.subBlocks[i].faceBufferInd[1] = 2*y;
                            if (x == 0)
                                Scene.setNeighbors(yNeighbors[0], 3-y, [
                                    node.subBlocks[2*y],
                                    node.subBlocks[2*y+1]]);
                            break;
                        case 2:
                            Scene.setNeighbors(node.subBlocks[i], 2+y, [yNeighbors[x]]);
                            Scene.setNeighbors(yNeighbors[x], 3-y, [node.subBlocks[i]]);
                            yNeighbors[x].faceBufferInd[1] = 1;
                            View.updateBlockFaceBuffer(yNeighbors[x]);
                            break;
                    }

                    if (node.subBlocks[i].faceBufferInd[0] != 1 ||
                        node.subBlocks[i].faceBufferInd[1] != 1)
                        View.updateBlockFaceBuffer(node.subBlocks[i]);

                    View.addBlock(node.subBlocks[i]);
                    node.subBlocks[i].name = path+String(i);
                }

                // split sqrUvBounds into 4 quarters based on i
                var childSqrUvBounds = Geom.getBoundsQuarter(sqrUvBounds, i);
                this.visitBlockNode(
                    node.subBlocks[i],
                    depth+1,
                    path+String(i),
                    blockInd,
                    square,
                    childSqrUvBounds);
            }
        }
    } else if (d <= weightedDist) {
        var mayRefine =
            node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
        if (mayRefine)
            // block has no child and is near enough
            // refine it by spawning 4 children
            for (var i = 0; i < 4; i++) {
                // schedule block creation after render
                this.planet.createBlockLater(
                    node,
                    i,
                    square,
                    Geom.getBoundsQuarter(sqrUvBounds, i),
                    path+String(i));
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
    this.model = View.addCharacter(this.size.width, this.size.height);
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