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

    View.pivot.rotation.x = View.camera.elevation-Math.PI/2;

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

        character.updateBalloon(character.currentActions['talk']);
        if (character.balloonModel) {
            character.balloonModel.rotation.y =
                Scene.player.model.rotation.y-character.model.rotation.y;
            character.balloonModel.rotation.x = View.pivot.rotation.x;

            // calculate distance between character and player
            var charDist =
                character.model.position.distanceTo(Scene.player.model.position);

            // distance value for which the maximum alpha is reached
            var dDef = View.PlayerCamera.defaultDistance;
            var dNear = 1; // minimum distance for which a balloon is still visible
            var dFar = 12; // maximum distance for which a balloon is still visible
            var d = charDist+View.camera.distance;

            // This formula yields an opacity of balloonAlphaMax when d == dDef,
            // and a null opacity when d == dNear or dFar
            // So balloons are more transparent when too close or too far from camera
            var dLim;
            if (d <= dDef) {
                dLim = dNear;
            } else {
                dLim = dFar;
            }
            var deltaRatio = (d-dDef)/(dLim-dDef);
            character.balloonModel.material.opacity =
                View.balloonAlphaMax*(1-deltaRatio*deltaRatio);
        }
    }

    View.sun.position.x = Scene.player.model.position.x+4;
    View.sun.position.y = Scene.player.model.position.y;
    View.sun.position.z = Scene.player.model.position.z;

    View.camera.applyActions();
    View.camera.position.z = View.camera.distance;

    // animate

    View.renderer.render(View.scene, View.camera);
}

Game.getAltitudeFromUv = function(uvSquare, square, planet) {
    var xTex = Math.round((planet.altitudeMap.width-1)*(square[0]+uvSquare[0])/3);
    var yTex = Math.round((planet.altitudeMap.height/2-1)*(1-uvSquare[1]));
    if (square[1] == 0) yTex += planet.altitudeMap.height/2;
    var altitudePix = planet.altitudeMap.data[planet.altitudeMap.width*yTex+xTex];
    return planet.minAltitude+(planet.maxAltitude-planet.minAltitude)*altitudePix/255;
}

Game.getSquareUvFromSphericalPosition = function(theta, phi, planet) {
    var newCoords = []; // normalized coordinates
    newCoords[0] = Math.sin(theta)*Math.sin(phi);
    newCoords[1] = -Math.sin(theta)*Math.cos(phi);
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
    var v = newCoords[vInd]/Math.abs(w);
    var uInd = 3-wInd-vInd; // the remaining coordinate
    var u = planet.uSigns[square[0]][square[1]]*newCoords[uInd]/Math.abs(w);
    return {
        'uv': [(u+1)/2, (v+1)/2],
        'square': square
    }
}

// better not call this and call getAltitudeFromUv directly if squareUv is available
Game.getAltitudeFromSphericalPosition = function(theta, phi, planet) {
    var squareUv = Game.getSquareUvFromSphericalPosition(theta, phi, planet);
    return Game.getAltitudeFromUv(squareUv.uv, squareUv.square, planet);
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

Game.getBlockIndFromUv = function(uv, planet) {
    return [Math.floor(uv[0]*planet.blocksPerSide), Math.floor(uv[1]*planet.blocksPerSide)];
}

// better not call this and call getBlockIndFromUv directly if squareUv is available
Game.getBlockIndFromSphericalPosition = function(theta, phi, planet) {
    var squareUv = Game.getSquareUvFromSphericalPosition(theta, phi, planet);
    return Game.getBlockIndFromUv(squareUv.uv, planet)
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
        var newSquareUv = Game.getSquareUvFromSphericalPosition(newTheta, newPhi, planet);
        var uv = newSquareUv.uv;
        var square = newSquareUv.square;
        var newGroundAltitude = Game.getAltitudeFromUv(uv, square, planet);
        if ((newGroundAltitude-object.altitude)/Math.abs(hd) <= Game.slopeThreshold) {
            object.sphericalPosition.theta = newTheta;
            object.sphericalPosition.phi = newPhi;
            object.bearing = newBearing;
            object.groundAltitude = newGroundAltitude;
            if (Scene.player === object)
                planet.updateTerrain(uv, square);
        } else {
            object.velocity[0] = 0;
        }
    }
    newAltitude = Math.max(object.altitude+vd, object.groundAltitude);
    object.velocity[1] = (newAltitude-object.altitude)/deltaTime;
    object.altitude = newAltitude;
}
