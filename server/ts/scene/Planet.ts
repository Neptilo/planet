import Canvas from 'canvas'
import fs from 'fs'
import { dirname } from 'path';

export class Planet {
    radius = 100;
    minAltitude = -2.5;
    maxAltitude = 2.5;
    gravity = .0001;
    altitudeMap: { width?: number; height?: number; data?: number[]; };

    constructor() {
        // altitude
        const planet = this;
        const serverDirName = dirname(process.argv[1]);
        fs.readFile(serverDirName + '/../img/altitude.png', (err, data) => {
            if (err) throw err;
            const img = new Canvas.Image;
            img.src = data;
            planet.setAltitudeMap(img);
            console.info('Altitude map loaded');
        });
    }

    setAltitudeMap(img: Canvas.Image | Canvas.Canvas) {
        const canvas = Canvas.createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this.altitudeMap = {};
        this.altitudeMap.width = img.width;
        this.altitudeMap.height = img.height;

        // copy only red channel of img into altitudeMap
        const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
        this.altitudeMap.data = [];
        for (let i = 0; i < imgData.length / 4; i++) {
            this.altitudeMap.data[i] = imgData[4 * i];
        }
    }
}