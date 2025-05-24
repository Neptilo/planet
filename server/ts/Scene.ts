import Canvas from 'canvas'
import fs from 'fs'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export class Planet {
    radius = 100;
    minAltitude = -2.5;
    maxAltitude = 2.5;
    gravity = .0001;
    altitudeMap;

    constructor() {
        // altitude
        var planet = this;
        const serverDirName = dirname(fileURLToPath(import.meta.url));
        fs.readFile(serverDirName + '/../img/altitude.png', function (err, data) {
            if (err) throw err;
            var img = new Canvas.Image;
            img.src = data;
            planet.setAltitudeMap(img);
            console.info('Altitude map loaded');
        });
    }

    setAltitudeMap(img) {
        var canvas = Canvas.createCanvas(img.width, img.height);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this.altitudeMap = {};
        this.altitudeMap.width = img.width;
        this.altitudeMap.height = img.height;

        // copy only red channel of img into altitudeMap
        var imgData = ctx.getImageData(0, 0, img.width, img.height).data;
        this.altitudeMap.data = [];
        for (var i = 0; i < imgData.length / 4; i++) {
            this.altitudeMap.data[i] = imgData[4 * i];
        }
    }
}

export class Character {
    // characteristics
    speed = .007;
    angularSpeed = .002;
    jumpSpeed = .02;
    eyeAltitude = 1;
    size = {
        "width": .4,
        "height": 1
    };

    // state
    bearing;
    sphericalPosition;
    altitude;
    groundAltitude;
    velocity = [0, 0];
    currentActions = {};

    constructor(data) {
        // state
        this.bearing = data.bearing;
        this.sphericalPosition = data.sphericalPosition;
        this.altitude = data.altitude;
        this.groundAltitude = this.altitude;
    }
}

export const Scene = {
    planet: null as Planet | null,
    characters: null as any,
    init() {
        Scene.planet = new Planet;
        Scene.characters = {};
    }
}