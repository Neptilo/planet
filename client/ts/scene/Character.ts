import { SphericalPosition } from '../Geom.js';
import { View } from '../View.js';
import { CharacterData } from './Scene.js';

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
    bearing: number;
    sphericalPosition: SphericalPosition;
    altitude: number;
    groundAltitude: number;
    velocity = [0, 0];
    currentActions = {};
    balloonText = '';

    // view
    model: THREE.Mesh;
    balloonModel: THREE.Mesh;

    constructor(data: CharacterData) {
        this.bearing = data.bearing;
        this.sphericalPosition = data.sphericalPosition;
        this.altitude = data.altitude;
        this.groundAltitude = this.altitude;

        this.model = View.addCharacter(this.size.width, this.size.height);
    }

    updateBalloon(text: string) {
        if (text != this.balloonText) {
            this.balloonText = text;
            if (text) {
                View.makeBalloon(text, this);
            } else {
                if (this.balloonModel)
                    this.model.remove(this.balloonModel);
                this.balloonModel = null;
            }
        }
    }
}