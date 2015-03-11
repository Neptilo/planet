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
    var squareUv = Game.getSquareUvFromSphericalPosition(sphericalPosition.theta, sphericalPosition.phi);
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
    var diffuseTexture = THREE.ImageUtils.loadTexture("img/map.png");
    this.material = new THREE.MeshPhongMaterial({map: diffuseTexture});
}

Scene.Planet.prototype.setAltitudeMap = function(img) {
    this.altitudeMap = document.createElement('canvas');
    this.altitudeMap.width = img.width;
    this.altitudeMap.height = img.height;
    this.altitudeMap.getContext('2d').drawImage(img, 0, 0);
}

Scene.Planet.prototype.updateTerrain = function(uv, square) {
    var blockId = Game.getBlockIdFromUv(uv, square, this);

    // unload far away blocks
    for (var id in this.blocks) {
        var block = this.blocks[id];
        var i = Math.floor(id/this.blocksPerSide);
        var j = id%this.blocksPerSide;
        if ((Math.abs(i-blockId[0]) > 2) || (Math.abs(j-blockId[1]) > 2)) {
            View.scene.remove(block);
            delete this.blocks[id];
            console.log('delete block '+[i, j]);
        }
    }

    // load close blocks
    for (var i = Math.max(blockId[0]-1, 0); i <= Math.min(blockId[0]+1, this.blocksPerSide-1); i++) {
        for (var j = Math.max(blockId[1]-1, 0); j <= Math.min(blockId[1]+1, this.blocksPerSide-1); j++) {
            var id = this.blocksPerSide*i+j;
            if (this.blocks[id] == undefined) {
                this.blocks[id] = View.makeBlock([i, j], this);
                View.scene.add(this.blocks[id]);
                console.log('create block '+[i, j]);
            }
        }
    }
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

    // view
    this.model = View.makeCharacter(this.size.width, this.size.height);
}
