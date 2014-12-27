Controls = {};

Controls.characterActions = ['left', 'forward', 'right', 'back'];

Controls.cameraActions = ['zoomOut', 'zoomIn'];

Controls.init = function() {
    document.onkeydown = Controls.handleKeyDown;
    document.onkeyup = Controls.handleKeyUp;
    if (View.canvas.addEventListener) {
        // IE9, Chrome, Safari, Opera
        View.canvas.addEventListener('mousewheel', Controls.handleMouseWheel, false);
        // Firefox
        View.canvas.addEventListener('DOMMouseScroll', Controls.handleMouseWheel, false);
    } else {
        // IE6/7/8
        View.canvas.attachEvent('onmousewheel', Controls.handleMouseWheel);
    }
}
    
Controls.sendActionMessage = function(movement, on) {
    var message = {
        'action': 'setAction',
        'which': movement,
        'value': on
    };
    Connection.send(JSON.stringify(message));
}

Controls.keyToAction = function(key) {
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

Controls.switchAction = function(event, on) {
    var action = Controls.keyToAction(event.keyCode);
    if (action) {
        for (var i in Controls.characterActions) {
            if (action == Controls.characterActions[i]) {
                // wait for server agreement before moving
                // Scene.player.currentActions[action] = on;
                Controls.sendActionMessage(action, on);
                break;
            }
        }
        for (var i in Controls.cameraActions) {
            if (action == Controls.cameraActions[i]) {
                View.camera.currentActions[action] = on;
                break;
            }
        }
    }
}

Controls.handleKeyDown = function(event) {
    Controls.switchAction(event, true);
}

Controls.handleKeyUp = function(event) {
    Controls.switchAction(event, false);
}

Controls.handleActions = function() {
    var characters = Scene.objects;
    for (var i in characters) {
        var character = characters[i];
        var actions = character.currentActions;
        if (actions['left'])
            character.bearing -= character.angularSpeed;
        if (actions['right'])
            character.bearing += character.angularSpeed;
        if (actions['forward'])
            character.move(character.speed, Scene.planet.radius);
        if (actions['back'])
            character.move(-character.speed, Scene.planet.radius);
    }
    var actions = View.camera.currentActions;
    if (actions['zoomOut'])
        View.camera.zoomOut();
    if (actions['zoomIn'])
        View.camera.zoomIn();
}

Controls.handleMouseWheel = function(e) {
    var e = window.event || e; // old IE
    var delta = e.wheelDelta || -e.detail;
    if (delta >= 0)
        View.camera.zoomIn();
    else
        View.camera.zoomOut();
}
