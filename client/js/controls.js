function sendActionMessage(movement, on) {
    var message = {
        'action': 'setAction',
        'which': movement,
        'value': on
    };
    doSend(JSON.stringify(message));
}

function keyToAction(key) {
    switch (key) {
        case 33: // page up
            return 'zoomOut';
            break;
        case 34: // page down
            return 'zoomIn';
            break;
        case 37: // left arrow
            return 'left';
            break;
        case 38: // up arrow
            return 'forward';
            break;
        case 39: // right arrow
            return 'right';
            break;
        case 40: // down arrow
            return 'back';
            break;
        default:
            return false;
    }
}

function handleKeyDown(event) {
    var action = keyToAction(event.keyCode);
    player.currentActions[action] = true;
    sendActionMessage(action, true);
}

function handleKeyUp(event) {
    var action = keyToAction(event.keyCode);
    player.currentActions[action] = false;
    sendActionMessage(action, false);
}

function handleActions(world) {
    var characters = world.objects;
    for (var i in characters) {
        var character = characters[i];
        var actions = character.currentActions;
        if (actions['left'])
            character.bearing -= character.angularSpeed;
        if (actions['right'])
            character.bearing += character.angularSpeed;
        if (actions['forward'])
            character.move(character.speed, world.radius);
        if (actions['back'])
            character.move(-character.speed, world.radius);
    }
    var actions = player.currentActions;
    if (actions['zoomOut'])
        camera.zoomOut();
    if (actions['zoomIn'])
        camera.zoomIn();
}

function handleMouseWheel(e) {
    var e = window.event || e; // old IE
    var delta = e.wheelDelta || -e.detail;
    if (delta >= 0)
        camera.zoomIn();
    else
        camera.zoomOut();
}
