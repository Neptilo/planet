Controls = {};

Controls.characterActions = ['jump', 'left', 'forward', 'right', 'back'];

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
    
Controls.sendActionMessage = function(action, on) {
    var message = {
        'action': 'setAction',
        'which': action,
        'value': on
    };
    Connection.send(JSON.stringify(message));
}

Controls.keyToAction = function(key) {
    // these are KeyboardEvent.key keywords
    switch (key) {
        case ' ':
            return 'jump';
            break;
        case 'PageUp':
            return 'zoomOut';
            break;
        case 'PageDown':
            return 'zoomIn';
            break;
        case 'ArrowLeft':
            return 'left';
            break;
        case 'ArrowUp':
            return 'forward';
            break;
        case 'ArrowRight':
            return 'right';
            break;
        case 'ArrowDown':
            return 'back';
            break;
        case 'Enter':
            return 'talk';
            break;
        default:
            return false;
    }
}

Controls.switchAction = function(event, on) {
    // check if we are editing the text box
    var input = document.getElementsByTagName('input')[0];
    if (input == document.activeElement && event.key != 'Enter')
        return;

    var action = Controls.keyToAction(event.key);
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
        if (action == 'talk' && on) {
            input.hidden = !input.hidden; // open or close message box
            if (input.hidden) {
                input.blur();
                input.oninput = null;
            } else {
                input.focus();

                // clear text
                input.value = ''; // in the text bar
                Controls.sendActionMessage('talk', ''); // on the server

                input.oninput = Controls.handleTextInput;
            }
            input.onpropertychange = input.oninput; // for IE8
        }
    }
}

Controls.handleKeyDown = function(event) {
    Controls.switchAction(event, true);
}

Controls.handleKeyUp = function(event) {
    Controls.switchAction(event, false);
}

Controls.handleMouseWheel = function(e) {
    var e = window.event || e; // old IE
    var delta = e.wheelDelta || -e.detail;
    if (delta >= 0)
        View.camera.zoomIn();
    else
        View.camera.zoomOut();
}

Controls.handleTextInput = function(event) {
    var input = document.getElementsByTagName('input')[0];
    Controls.sendActionMessage('talk', input.value);
}