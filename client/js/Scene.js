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
    View.pivot.position.y = Scene.player.eyeAltitude-Scene.player.size.height/2;
    View.sun.target = Scene.player.model;
    Game.init();
}

Scene.createCharacter = function(characterId, characterData) {
    var character = new Scene.Character(characterData);
    Scene.objects[characterId] = character;
    character.model.rotation.order = 'ZXY';
    Scene.planet.model.add(character.model);
}

Scene.removeCharacter = function(characterId) {
    var character = Scene.objects[characterId];
    Scene.planet.model.remove(character.model);
    delete Scene.objects[characterId];
}

Scene.Planet = function() {
    this.radius = 100;
    this.minAltitude = -2.5;
    this.maxAltitude = 2.5;

    // altitude
    var planet = this;
    var img = new Image;
    img.onload = function() {
        planet.setAltitudeMap(this);
        planet.model = View.makePlanet(planet);
        View.scene.add(planet.model);
        Scene.makeWorld();
    };
    img.src = 'img/altitude.png';

    this.gravity = .0001;
}

Scene.Planet.prototype.setAltitudeMap = function(img) {
    this.altitudeMap = document.createElement('canvas');
    this.altitudeMap.width = img.width;
    this.altitudeMap.height = img.height;
    this.altitudeMap.getContext('2d').drawImage(img, 0, 0);
}

Scene.Character = function(data) {
    // characteristics
    this.speed = .01;
    this.angularSpeed = .002;
    this.jumpSpeed = .01;
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
