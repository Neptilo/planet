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
            character.move(deltaTime*character.speed);
        if (actions['back'])
            character.move(-deltaTime*character.speed);
    }
}
