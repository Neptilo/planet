import { Scene } from './scene/Scene.js';
import { Character, SphericalPosition } from './scene/Character.js';
import { Planet } from './scene/Planet.js';

const slopeThreshold = 1;
let lastTime = 0;

export const Game = {
    init() {
        tick();
    },

    getAltitudeFromUv(uSquare: number, vSquare: number, square: number[], planet: Planet) {
        let xTex = Math.round((planet.altitudeMap.width - 1) * (square[0] + uSquare) / 3);
        let yTex = Math.round((planet.altitudeMap.height / 2 - 1) * (1 - vSquare));
        if (square[1] == 0) yTex += planet.altitudeMap.height / 2;
        const altitudePix = planet.altitudeMap.data[planet.altitudeMap.width * yTex + xTex];
        return planet.minAltitude + (planet.maxAltitude - planet.minAltitude) * altitudePix / 255;
    },

    getAltitudeFromSphericalPosition(theta: number, phi: number, planet: Planet) {
        const newCoords: number[] = []; // normalized coordinates
        newCoords[0] = Math.sin(theta) * Math.sin(phi);
        newCoords[1] = -Math.sin(theta) * Math.cos(phi);
        newCoords[2] = Math.cos(theta);
        const squareInds = [
            [[0, 1], [2, 1]],
            [[0, 0], [2, 0]],
            [[1, 0], [1, 1]]];
        const uSigns = [[-1, 1], [1, 1], [1, -1]];
        // find biggest coordinate
        let wInd = 0;
        let w = 0;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(newCoords[i]) > Math.abs(w)) {
                w = newCoords[i];
                wInd = i;
            }
        }
        const square = squareInds[wInd][Number(w >= 0)];
        const vInd = square[1]; // magic trick
        const v = newCoords[vInd] / Math.abs(w);
        const uInd = 3 - wInd - vInd; // the remaining coordinate
        const u = uSigns[square[0]][square[1]] * newCoords[uInd] / Math.abs(w);
        return Game.getAltitudeFromUv((u + 1) / 2, (v + 1) / 2, square, planet);
    }
}

function tick() {
    setTimeout(tick, 15);
    const timeNow = new Date().getTime();
    if (lastTime != 0) {
        const deltaTime = timeNow - lastTime;
        moveObjects(deltaTime, Scene.planet);
        applyGravity(deltaTime, Scene.planet);
    }
    lastTime = timeNow;
}

// compute new spherical coordinates and bearing
// given an initial set of spherical coordinates as an object with
// the attributes: 'theta', 'phi' and 'rho',
// rho being the distance to the center of the sphere
// and given an initial bearing
// and a distance to go through
function getNewSphericalPostion(sphericalPosition: SphericalPosition, bearing: number, distance: number) {
    const th = sphericalPosition.theta;
    const b = bearing;
    const d = distance / sphericalPosition.rho;
    const newTheta = Math.acos(Math.cos(th) * Math.cos(d) + Math.sin(th) * Math.sin(d) * Math.cos(b));
    const newPhi = sphericalPosition.phi + Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.sin(th),
        Math.cos(d) - Math.cos(th) * Math.cos(newTheta));
    let newBearing: number;
    if (d >= 0)
        newBearing = Math.atan2(
            Math.sin(b) * Math.sin(d) * Math.sin(th),
            Math.cos(d) * Math.cos(newTheta) - Math.cos(th));
    else
        newBearing = Math.atan2(
            -Math.sin(b) * Math.sin(d) * Math.sin(th),
            -(Math.cos(d) * Math.cos(newTheta) - Math.cos(th)));
    return {
        'theta': newTheta,
        'phi': newPhi,
        'bearing': newBearing
    }
}

function moveObjects(deltaTime: number, planet: Planet) {
    const characters = Scene.characters;
    for (let i in characters) {
        const character = characters[i];
        moveObject(character, deltaTime, planet);
    }
}

function applyGravity(deltaTime: number, planet: Planet) {
    const characters = Scene.characters;
    for (let i in characters) {
        characters[i].velocity[1] -= deltaTime * planet.gravity;
    }
}

function moveObject(object: Character, deltaTime: number, planet: Planet) {
    // ground contact test
    if (object.altitude <= object.groundAltitude) {
        // touching the ground: apply actions
        object.velocity[0] = 0;
        const actions = object.currentActions;
        if (actions['jump'])
            object.velocity[1] = object.jumpSpeed;
        if (actions['left'])
            object.bearing -= deltaTime * object.angularSpeed;
        if (actions['right'])
            object.bearing += deltaTime * object.angularSpeed;
        if (actions['forward'])
            object.velocity[0] += object.speed;
        if (actions['back'])
            object.velocity[0] -= object.speed;
    } // else in the air: free fall
    const hd = deltaTime * object.velocity[0],
        vd = deltaTime * object.velocity[1];
    if (hd != 0) {
        const sphericalPosition = {
            'theta': object.sphericalPosition.theta,
            'phi': object.sphericalPosition.phi,
            'rho': planet.radius + object.altitude
        }
        const newSphericalPosition = getNewSphericalPostion(sphericalPosition, object.bearing, hd);
        const newTheta = newSphericalPosition.theta;
        const newPhi = newSphericalPosition.phi;
        const newBearing = newSphericalPosition.bearing;
        const newGroundAltitude = Game.getAltitudeFromSphericalPosition(newTheta, newPhi, planet);
        if ((newGroundAltitude - object.altitude) / Math.abs(hd) <= slopeThreshold) {
            object.sphericalPosition.theta = newTheta;
            object.sphericalPosition.phi = newPhi;
            object.bearing = newBearing;
            object.groundAltitude = newGroundAltitude;
        } else {
            object.velocity[0] = 0;
        }
    }
    const newAltitude = Math.max(object.altitude + vd, object.groundAltitude);
    object.velocity[1] = (newAltitude - object.altitude) / deltaTime;
    object.altitude = newAltitude;
    if (object.altitude < object.groundAltitude)
        console.error('Object lower than ground');
}