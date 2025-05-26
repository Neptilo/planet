export type SphericalPosition = { theta: number; phi: number; rho: number; };

export type CharacterData = { sphericalPosition: SphericalPosition; altitude: number; bearing: number; }

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

    constructor(data: CharacterData) {
        // state
        this.bearing = data.bearing;
        this.sphericalPosition = data.sphericalPosition;
        this.altitude = data.altitude;
        this.groundAltitude = this.altitude;
    }
}