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
    var planet = this;
    fs.readFile(__dirname + '/../img/altitude.png', function(err, data) {
        if (err) throw err;
        var img = new Canvas.Image;
        img.src = data;
        planet.setAltitudeMap(img);
        console.info('Altitude map loaded');
    });

    this.gravity = .0001;
}

Scene.Planet.prototype.setAltitudeMap = function(img) {
    var canvas = Canvas.createCanvas(img.width, img.height);
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
