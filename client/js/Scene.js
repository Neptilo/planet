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

    // calling getSquareUvFromSphericalPosition because the square uvs have not been computed client-side
    var sphericalPosition = Scene.player.sphericalPosition;
    var squareUv = Game.getSquareUvFromSphericalPosition(sphericalPosition.theta, sphericalPosition.phi, Scene.planet);
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
    this.blocksPerSide = 32; // The number of blocks in a square is the square of this.
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

    this.blocks = {};

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
    var blockUnloadDistance = 3;
    for (var id in this.blocks) {
        var block = this.blocks[id];
        var j = id%this.blocksPerSide;
        var tmp = (id-j)/this.blocksPerSide;
        var i = tmp%this.blocksPerSide;
        tmp = (tmp-i)/this.blocksPerSide;
        var jSquare = tmp%2;
        var iSquare = (tmp-jSquare)/2;
        var d = this.blockDistance(blockInd, square, [i, j], [iSquare, jSquare]);
        if (d > blockUnloadDistance) {
            View.scene.remove(block);
            delete this.blocks[id];
        }
    }

    // load close blocks
    var blockLoadDistance = 2;
    for (var i = -blockLoadDistance; i <= blockLoadDistance; i++) {
        for (var j = -blockLoadDistance; j <= blockLoadDistance; j++) {
            var indSquare = this.blockAdd(blockInd, square, [i, j]);
            if (indSquare != null) {
                var ind = indSquare[0];
                var sqr = indSquare[1];
                var id = this.getBlockIdFromInd(ind, sqr);
                if (this.blocks[id] == undefined) {
                    this.blocks[id] = View.makeBlock(sqr, ind, this);
                    View.scene.add(this.blocks[id]);
                }
            }
        }
    }
}

// returns the distance in terms of blocks between two blocks
Scene.Planet.prototype.blockDistance = function(ind0, square0, ind1, square1) {
    if (square0[0] == square1[0] && square0[1] == square1[1])
        return Math.max(Math.abs(ind1[0]-ind0[0]), Math.abs(ind1[1]-ind0[1]));
    else {
        var coords = [];
        coords[0] = ind0[0]-this.blocksPerSide/2+0.5;
        coords[1] = ind0[1]-this.blocksPerSide/2+0.5;
        coords[2] = this.blocksPerSide/2;
        var A = this.getUnorientedCoordinates(coords, square0);
        coords[0] = ind1[0]-this.blocksPerSide/2+0.5;
        coords[1] = ind1[1]-this.blocksPerSide/2+0.5;
        var B = this.getUnorientedCoordinates(coords, square1);
        return Math.max(Math.max(
            Math.abs(B[0]-A[0]),
            Math.abs(B[1]-A[1])),
            Math.abs(B[2]-A[2]));
    }
}

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

Scene.Character = function(data) {
    // characteristics
    this.speed = .01;
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