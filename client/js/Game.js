Game = {};

Game.slopeThreshold = 1;

Game.init = function() {
    Game.lastTime = 0;
    Game.tick();
}

Game.tick = function() {
    requestAnimationFrame(Game.tick, 15);
    var timeNow = new Date().getTime();
    if (Game.lastTime != 0) {
        var deltaTime = timeNow-Game.lastTime;
        Game.moveObjects(deltaTime, Scene.planet);
        Game.applyGravity(deltaTime, Scene.planet);
    }
    Game.lastTime = timeNow;

    // update scene
    for (var i in Scene.objects) {
        var character = Scene.objects[i];
        // +.5 for each coordinate because of the way of constructing the planet
        // should be removed afterwards
        character.model.position.x = (Scene.planet.radius+character.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.sin(character.sphericalPosition.phi);
        character.model.position.y = -(Scene.planet.radius+character.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.cos(character.sphericalPosition.phi);
        character.model.position.z = (Scene.planet.radius+character.altitude+.5)*Math.cos(character.sphericalPosition.theta);
        character.model.rotation.z = character.sphericalPosition.phi;
        character.model.rotation.x = character.sphericalPosition.theta+Math.PI/2; // because of the way the plane is created
        character.model.rotation.y = -character.bearing;
    }

    View.sun.position.x = Scene.player.model.position.x+4;
    View.sun.position.y = Scene.player.model.position.y;
    View.sun.position.z = Scene.player.model.position.z;

    View.pivot.rotation.x = View.camera.elevation-Math.PI/2;

    View.camera.applyActions();
    View.camera.position.z = View.camera.distance;

    // animate

    View.renderer.render(View.scene, View.camera);
}

Game.getAltitudeFromUv = function(uSquare, vSquare, square, planet) {
    var xTex = Math.round((planet.altitudeMap.width-1)*(square[0]+uSquare)/3);
    var yTex = Math.round((planet.altitudeMap.height/2-1)*(1-vSquare));
    if (square[1] == 0) yTex += planet.altitudeMap.height/2;
    var altitudeCtx = planet.altitudeMap.getContext('2d');
    var altitudePix = altitudeCtx.getImageData(xTex, yTex, 1, 1).data;
    // get red channel of pixel data
    return planet.minAltitude+(planet.maxAltitude-planet.minAltitude)*altitudePix[0]/255;
}

Game.getAltitudeFromSphericalPosition = function(theta, phi, planet) {
    var newCoords = []; // normalized coordinates
    newCoords[0] = Math.sin(theta)*Math.sin(phi);
    newCoords[1] = -Math.sin(theta)*Math.cos(phi);
    newCoords[2] = Math.cos(theta);
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
    return Game.getAltitudeFromUv((u+1)/2, (v+1)/2, square, planet);
}

// compute new spherical coordinates and bearing
// given an initial set of spherical coordinates as an object with
// the attributes: 'theta', 'phi' and 'rho',
// rho being the distance to the center of the sphere
// and given an initial bearing
// and a distance to go through
Game.getNewSphericalPostion = function(sphericalPosition, bearing, distance) {
    var th = sphericalPosition.theta;
    var b = bearing;
    var d = distance/sphericalPosition.rho;
    var newTheta = Math.acos(Math.cos(th)*Math.cos(d)+Math.sin(th)*Math.sin(d)*Math.cos(b));
    var newPhi = sphericalPosition.phi+Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(th),
            Math.cos(d)-Math.cos(th)*Math.cos(newTheta));
    var newBearing;
    if (d >= 0)
        newBearing = Math.atan2(
                Math.sin(b)*Math.sin(d)*Math.sin(th),
                Math.cos(d)*Math.cos(newTheta)-Math.cos(th));
    else
        newBearing = Math.atan2(
                -Math.sin(b)*Math.sin(d)*Math.sin(th),
                -(Math.cos(d)*Math.cos(newTheta)-Math.cos(th)));
    return {
        'theta': newTheta,
        'phi': newPhi,
        'bearing': newBearing
    }
}

Game.moveObjects = function(deltaTime, planet) {
    var characters = Scene.objects;
    for (var i in characters) {
        var character = characters[i];
        Game.moveObject(character, deltaTime, planet);
    }
}

Game.applyGravity = function(deltaTime, planet) {
    var objects = Scene.objects;
    for (var i in objects) {
        objects[i].velocity[1] -= deltaTime*planet.gravity;
    }
}

Game.moveObject = function(object, deltaTime, planet) {
    // ground contact test
    if (object.altitude <= object.groundAltitude) {
        // touching the ground: apply actions
        object.velocity[0] = 0;
        var actions = object.currentActions;
        if (actions['jump'])
            object.velocity[1] = object.jumpSpeed;
        if (actions['left'])
            object.bearing -= deltaTime*object.angularSpeed;
        if (actions['right'])
            object.bearing += deltaTime*object.angularSpeed;
        if (actions['forward'])
            object.velocity[0] += object.speed;
        if (actions['back'])
            object.velocity[0] -= object.speed;
    } // else in the air: free fall
    var hd = deltaTime*object.velocity[0],
        vd = deltaTime*object.velocity[1];
    if (hd != 0) {
        var sphericalPosition = {
            'theta': object.sphericalPosition.theta,
            'phi': object.sphericalPosition.phi,
            'rho': planet.radius+object.altitude
        }
        var newSphericalPosition = Game.getNewSphericalPostion(sphericalPosition, object.bearing, hd);
        var newTheta = newSphericalPosition.theta;
        var newPhi = newSphericalPosition.phi;
        var newBearing = newSphericalPosition.bearing;
        var newGroundAltitude = Game.getAltitudeFromSphericalPosition(newTheta, newPhi, planet);
        if ((newGroundAltitude-object.altitude)/Math.abs(hd) <= Game.slopeThreshold) {
            object.sphericalPosition.theta = newTheta;
            object.sphericalPosition.phi = newPhi;
            object.bearing = newBearing;
            object.groundAltitude = newGroundAltitude;
        } else {
            object.velocity[0] = 0;
        }
    }
    newAltitude = Math.max(object.altitude+vd, object.groundAltitude);
    object.velocity[1] = (newAltitude-object.altitude)/deltaTime;
    object.altitude = newAltitude;
}
