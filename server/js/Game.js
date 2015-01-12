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

Game.getAltitudeFromUv = function(uSquare, vSquare, square, altitudeMap, minAltitude, maxAltitude) {
    var xTex = Math.round((altitudeMap.width-1)*(square[0]+uSquare)/3);
    var yTex = Math.round((altitudeMap.height/2-1)*(1-vSquare));
    if (square[1] == 0) yTex += altitudeMap.height/2;
    var altitudeCtx = altitudeMap.getContext('2d');
    var altitudePix = altitudeCtx.getImageData(xTex, yTex, 1, 1).data;
    // get red channel of pixel data
    return minAltitude+(maxAltitude-minAltitude)*altitudePix[0]/255;
}
