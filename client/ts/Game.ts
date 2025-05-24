import { Scene } from './Scene.js';
import { View } from './View.js';

let slopeThreshold = 1;
let lastTime = 0;

export const Game = {
    taskList: [] as any[],

    init() {
        tick();
    },

    getAltitudeFromUv(uvSquare, square, planet) {
        var xTex = Math.round((planet.altitudeMap.width - 1) * (square[0] + uvSquare[0]) / 3);
        var yTex = Math.round((planet.altitudeMap.height / 2 - 1) * (1 - uvSquare[1]));
        if (square[1] == 0) yTex += planet.altitudeMap.height / 2;
        var altitudePix = planet.altitudeMap.data[planet.altitudeMap.width * yTex + xTex];
        return planet.minAltitude + (planet.maxAltitude - planet.minAltitude) * altitudePix / 255;
    },

    getSquareUvFromSphericalPosition(theta, phi, planet) {
        var newCoords: number[] = []; // normalized coordinates
        newCoords[0] = Math.sin(theta) * Math.sin(phi);
        newCoords[1] = -Math.sin(theta) * Math.cos(phi);
        newCoords[2] = Math.cos(theta);
        // find biggest coordinate
        var wInd = 0;
        var w = 0;
        for (var i = 0; i < 3; i++) {
            if (Math.abs(newCoords[i]) > Math.abs(w)) {
                w = newCoords[i];
                wInd = i;
            }
        }
        var square = planet.squareInds[wInd][Number(w >= 0)];
        var vInd = square[1]; // magic trick
        var v = newCoords[vInd] / Math.abs(w);
        var uInd = 3 - wInd - vInd; // the remaining coordinate
        var u = planet.uSigns[square[0]][square[1]] * newCoords[uInd] / Math.abs(w);
        return {
            'uv': [(u + 1) / 2, (v + 1) / 2],
            'square': square
        }
    },

    // better not call this and call getAltitudeFromUv directly if squareUv is available
    getAltitudeFromSphericalPosition(theta, phi, planet) {
        var squareUv = Game.getSquareUvFromSphericalPosition(theta, phi, planet);
        return Game.getAltitudeFromUv(squareUv.uv, squareUv.square, planet);
    },

    getBlockIndFromUv(uv, planet) {
        return [Math.floor(uv[0] * planet.blocksPerSide), Math.floor(uv[1] * planet.blocksPerSide)];
    }
}

function tick() {
    requestAnimationFrame(tick);
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var deltaTime = timeNow - lastTime;
        moveObjects(deltaTime, Scene.planet);
        // update the terrain
        // but don't add more work if there's already a lot
        if (Game.taskList.length < 64)
            updateTerrain(Scene.player, Scene.planet);
        applyGravity(deltaTime, Scene.planet);
    }
    lastTime = timeNow;

    // update scene
    View.update();

    // run scheduled tasks
    if (Game.taskList.length) {
        // even if we don't have time, do at least one task
        var task = Game.taskList.shift();
        task.handler(task.data);
    }
    while (Game.taskList.length && new Date().getTime() - lastTime < 15) {
        var task = Game.taskList.shift();
        task.handler(task.data);
    }
}

// compute new spherical coordinates and bearing
// given an initial set of spherical coordinates as an object with
// the attributes: 'theta', 'phi' and 'rho',
// rho being the distance to the center of the sphere
// and given an initial bearing
// and a distance to go through
function getNewSphericalPostion(sphericalPosition, bearing, distance) {
    var th = sphericalPosition.theta;
    var b = bearing;
    var d = distance / sphericalPosition.rho;
    var newTheta = Math.acos(Math.cos(th) * Math.cos(d) + Math.sin(th) * Math.sin(d) * Math.cos(b));
    var newPhi = sphericalPosition.phi + Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.sin(th),
        Math.cos(d) - Math.cos(th) * Math.cos(newTheta));
    var newBearing;
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

// better not call this and call getBlockIndFromUv directly if squareUv is available
function getBlockIndFromSphericalPosition(theta, phi, planet) {
    var squareUv = Game.getSquareUvFromSphericalPosition(theta, phi, planet);
    return Game.getBlockIndFromUv(squareUv.uv, planet)
}

function moveObjects(deltaTime, planet) {
    var characters = Scene.objects;
    for (var i in characters)
        moveObject(characters[i], deltaTime, planet);
}

function updateTerrain(player, planet) {
    var sphericalPos = player.sphericalPosition;
    var squareUv = Game.getSquareUvFromSphericalPosition(
        sphericalPos.theta, sphericalPos.phi, planet);
    planet.updateTerrain(squareUv.uv, squareUv.square);
}

function applyGravity(deltaTime, planet) {
    var objects = Scene.objects;
    for (var i in objects)
        objects[i].velocity[1] -= deltaTime * planet.gravity;
}

function moveObject(object, deltaTime, planet) {
    if (!deltaTime)
        return;

    // ground contact test
    if (object.altitude <= object.groundAltitude) {
        // touching the ground: apply actions
        object.velocity[0] = 0;
        var actions = object.currentActions;
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
    var hd = deltaTime * object.velocity[0],
        vd = deltaTime * object.velocity[1];
    if (hd != 0) {
        var sphericalPosition = {
            'theta': object.sphericalPosition.theta,
            'phi': object.sphericalPosition.phi,
            'rho': planet.radius + object.altitude
        }
        var newSphericalPosition = getNewSphericalPostion(
            sphericalPosition, object.bearing, hd);
        var newTheta = newSphericalPosition.theta;
        var newPhi = newSphericalPosition.phi;
        var newBearing = newSphericalPosition.bearing;
        var newSquareUv = Game.getSquareUvFromSphericalPosition(
            newTheta, newPhi, planet);
        var newGroundAltitude = Game.getAltitudeFromUv(
            newSquareUv.uv, newSquareUv.square, planet);
        if ((newGroundAltitude - object.altitude) / Math.abs(hd) <= slopeThreshold) {
            object.sphericalPosition.theta = newTheta;
            object.sphericalPosition.phi = newPhi;
            object.bearing = newBearing;
            object.groundAltitude = newGroundAltitude;
        } else
            object.velocity[0] = 0;
    }
    let newAltitude = Math.max(object.altitude + vd, object.groundAltitude);
    object.velocity[1] = (newAltitude - object.altitude) / deltaTime;
    object.altitude = newAltitude;
}
