Game = {};

Game.init = function() {
    Game.lastTime = 0;
    Game.tick();
}

Game.tick = function() {
    requestAnimationFrame(Game.tick, 15);
    var timeNow = new Date().getTime();
    if (Game.lastTime != 0) {
        var deltaTime = timeNow-Game.lastTime;
        Controls.handleActions(deltaTime);
    }
    Game.lastTime = timeNow;

    // update scene
    for (var i in Scene.objects) {
        var character = Scene.objects[i];
        // +.5 for each coordinate because of the way of constructing the planet
        // should be removed afterwards
        character.model.position.x = (Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.sin(character.sphericalPosition.phi);
        character.model.position.y = -(Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.cos(character.sphericalPosition.phi);
        character.model.position.z = (Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.cos(character.sphericalPosition.theta);
        character.model.rotation.z = character.sphericalPosition.phi;
        character.model.rotation.x = character.sphericalPosition.theta+Math.PI/2; // because of the way the plane is created
        character.model.rotation.y = -character.bearing;
    }

    View.sun.position.x = Scene.player.model.position.x-1;
    View.sun.position.y = Scene.player.model.position.y-1;
    View.sun.position.z = Scene.player.model.position.z-1;

    View.pivot.rotation.x = View.camera.elevation-Math.PI/2;

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