Scene = {}

Scene.init = function() {
    Scene.planet = new Scene.Planet;
    View.scene.add(Scene.planet.model);

    Scene.objects = [];
    for (var i in Connection.characters)
        Scene.createCharacter(i, Connection.characters[i]);
    Connection.characters = null; // We won't need it anymore.

    Scene.player = Scene.objects[Connection.clientId];
    Scene.player.model.add(View.pivot);
    View.pivot.position.y = Scene.player.eyeAltitude-Scene.player.size.height/2;
    View.sun.target = Scene.player.model;
}

Scene.createCharacter = function(characterId, characterData) {
    var character = new Scene.Character(characterData);
    Scene.objects[characterId] = character;
    character.model.rotation.order = 'ZXY';
    Scene.planet.model.add(character.model);
}

Scene.Planet = function() {
    this.radius = 100;
    this.model = View.makePlanet(this.radius);
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

Scene.Character.prototype.move = function(speed, worldRadius) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(worldRadius+this.sphericalPosition.altitude+this.eyeAltitude);
    var newTheta = Math.acos(Math.cos(theta)*Math.cos(d)+Math.sin(theta)*Math.sin(d)*Math.cos(b));
    var dTheta = newTheta-theta;
    this.sphericalPosition.theta = newTheta;
    this.sphericalPosition.phi += Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));
    this.bearing = Math.atan2(
            Math.sign(d)*Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.sign(d)*(Math.cos(d)*Math.cos(newTheta)-Math.cos(theta)));
}
