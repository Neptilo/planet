import { View } from './View.js';
import { Connection } from './Connection.js';

const characterActions = ['jump', 'left', 'forward', 'right', 'back'];

const cameraActions = ['zoomOut', 'zoomIn'];

export const Controls = {
    init() {
        document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;
        // IE9, Chrome, Safari, Opera
        View.canvas!.addEventListener('mousewheel', handleMouseWheel, false);
        // Firefox
        View.canvas!.addEventListener('DOMMouseScroll', handleMouseWheel, false);
    }
}
    
function sendActionMessage(action, on) {
    var message = {
        'action': 'setAction',
        'which': action,
        'value': on
    };
    Connection.send(JSON.stringify(message));
}

function keyToAction(key) {
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

function switchAction(event, on) {
    // check if we are editing the text box
    var input = document.getElementsByTagName('input')[0];
    if (input == document.activeElement && event.key != 'Enter')
        return;

    var action = keyToAction(event.key);
    if (action) {
        for (var i in characterActions) {
            if (action == characterActions[i]) {
                // wait for server agreement before moving
                // Scene.player.currentActions[action] = on;
                sendActionMessage(action, on);
                break;
            }
        }
        for (var i in cameraActions) {
            if (action == cameraActions[i]) {
                View.camera!.currentActions[action] = on;
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
                sendActionMessage('talk', ''); // on the server

                input.oninput = handleTextInput;
            }
        }
    }
}

function handleKeyDown(event) {
    switchAction(event, true);
}

function handleKeyUp(event) {
    switchAction(event, false);
}

function handleMouseWheel(e) {
    var delta = e.wheelDelta || -e.detail;
    if (delta >= 0)
        View.camera!.zoomIn();
    else
        View.camera!.zoomOut();
}

function handleTextInput(event) {
    var input = document.getElementsByTagName('input')[0];
    sendActionMessage('talk', input.value);
}