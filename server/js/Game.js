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
        Game.handleMovements();
    }
    Game.lastTime = timeNow;
}

Game.handleMovements = function() {
    for (var i in Scene.characters) {
        var character = Scene.characters[i];
        var actions = character.currentActions;
        if (actions['left'])
            character.bearing -= character.angularSpeed;
        if (actions['right'])
            character.bearing += character.angularSpeed;
        if (actions['forward'])
            character.move(character.speed);
        if (actions['back'])
            character.move(-character.speed);
    }
}
