var Canvas = require('canvas');
var fs = require('fs');

Scene = {};

Scene.init = function() {
    Scene.planet = new Scene.Planet;
    Scene.characters = {};
}

Scene.Planet = function() {
    this.radius = 100;
    this.minAltitude = -2.5;
    this.maxAltitude = 2.5;

    // altitude
    fs.readFile(__dirname + '/../img/altitude.png', function(err, data) {
        if (err) throw err;
        var img = new Canvas.Image;
        img.src = data;
        Scene.planet.altitudeMap = new Canvas(img.width, img.height);
        Scene.planet.altitudeMap.getContext('2d').drawImage(img, 0, 0);
        console.info('Altitude map loaded');
    });
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

Scene.Character.prototype.move = function(speed, planet) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(Scene.planet.radius+this.sphericalPosition.altitude);
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

