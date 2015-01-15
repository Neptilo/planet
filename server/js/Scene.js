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

    this.gravity = .0001;
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
}
