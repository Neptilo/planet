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
    var dTheta = newTheta-theta;
    var newPhi = this.sphericalPosition.phi+Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));

    // determine new altitude
    var newCoords = []; // normalized coordinates
    newCoords[0] = Math.sin(newTheta)*Math.sin(newPhi);
    newCoords[1] = -Math.sin(newTheta)*Math.cos(newPhi);
    newCoords[2] = Math.cos(newTheta);
    var squareInds = [
        [[0, 1], [2, 1]],
        [[0, 0], [2, 0]],
        [[1, 0], [1, 1]]];
    var uSigns = [[-1, 1], [1, 1], [1, -1]];
    // find biggest coordinate
    var wInd = 0;
    var w = 0;
    for (var i = 0; i < 3; i++) {
        if (Math.abs(newCoords[i]) > Math.abs(w)) {
            w = newCoords[i];
            wInd = i;
        }
    }
    var square = squareInds[wInd][Number(w >= 0)];
    var vInd = square[1]; // magic trick
    var v = newCoords[vInd]/Math.abs(w);
    var uInd = 3-wInd-vInd; // the remaining coordinate
    var u = uSigns[square[0]][square[1]]*newCoords[uInd]/Math.abs(w);

    this.sphericalPosition.altitude = Game.getAltitudeFromUv((u+1)/2, (v+1)/2, square,
        planet.altitudeMap, planet.minAltitude, planet.maxAltitude);

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

