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
}

Scene.Planet.prototype.setAltitudeMap = function(img) {
    this.altitudeMap = document.createElement('canvas');
    this.altitudeMap.width = img.width;
    this.altitudeMap.height = img.height;
    this.altitudeMap.getContext('2d').drawImage(img, 0, 0);
}

Scene.Character = function(data) {
    this.speed = .01;
    this.angularSpeed = .002;
    this.bearing = data.bearing;
    this.eyeAltitude = 1;
    this.sphericalPosition = data.sphericalPosition;
    this.size = {
        "width": .4,
        "height": 1
    };
    this.currentActions = {};
    this.model = View.makeCharacter(this.size.width, this.size.height);
}

Scene.Character.prototype.move = function(speed, planet) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(planet.radius+this.sphericalPosition.altitude);
    var newTheta = Math.acos(Math.cos(theta)*Math.cos(d)+Math.sin(theta)*Math.sin(d)*Math.cos(b));
    var newPhi = this.sphericalPosition.phi+Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));
    var newAltitude = Game.getAltitudeFromSphericalPosition(newTheta, newPhi, planet);
    if ((newAltitude-this.sphericalPosition.altitude)/Math.abs(speed) <= Game.slopeThreshold) {
        this.sphericalPosition.altitude = newAltitude;
        this.sphericalPosition.theta = newTheta;
        this.sphericalPosition.phi = newPhi;
        if (d >= 0)
            this.bearing = Math.atan2(
                    Math.sin(b)*Math.sin(d)*Math.sin(theta),
                    Math.cos(d)*Math.cos(newTheta)-Math.cos(theta));
        else
            this.bearing = Math.atan2(
                    -Math.sin(b)*Math.sin(d)*Math.sin(theta),
                    -(Math.cos(d)*Math.cos(newTheta)-Math.cos(theta)));
    }
}
