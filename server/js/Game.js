Game = {}

Game.init = function() {
    Game.lastTime = 0;
    Game.tick();
}

Game.tick = function() {
    setTimeout(Game.tick, 15);
    var timeNow = new Date().getTime();
    if (Game.lastTime != 0) {
        var deltaTime = timeNow-Game.lastTime;
        Game.handleMovements(deltaTime);
    }
    Game.lastTime = timeNow;
}

Game.handleMovements = function(deltaTime) {
    for (var i in Scene.characters) {
        var character = Scene.characters[i];
        var actions = character.currentActions;
        if (actions['left'])
            character.bearing -= deltaTime*character.angularSpeed;
        if (actions['right'])
            character.bearing += deltaTime*character.angularSpeed;
        if (actions['forward'])
            character.move(deltaTime*character.speed, Scene.planet);
        if (actions['back'])
            character.move(-deltaTime*character.speed, Scene.planet);
    }
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