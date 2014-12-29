Scene = {};

Scene.init = function() {
    Scene.planet = new Scene.Planet;
    Scene.characters = [];
}

Scene.Planet = function() {
    this.radius = 100;
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
}

Scene.Character.prototype.move = function(speed) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(Scene.planet.radius+this.sphericalPosition.altitude+this.eyeAltitude);
    var newTheta = Math.acos(Math.cos(theta)*Math.cos(d)+Math.sin(theta)*Math.sin(d)*Math.cos(b));
    var dTheta = newTheta-theta;
    this.sphericalPosition.theta = newTheta;
    this.sphericalPosition.phi += Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));
    if (d >= 0)
        this.bearing = Math.atan2(
                Math.sin(b)*Math.sin(d)*Math.sin(theta),
                Math.cos(d)*Math.cos(newTheta)-Math.cos(theta));
    else
        this.bearing = Math.atan2(
                -Math.sin(b)*Math.sin(d)*Math.sin(theta),
                -(Math.cos(d)*Math.cos(newTheta)-Math.cos(theta)));
}

