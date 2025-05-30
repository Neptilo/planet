import { View } from './View.js';
import { Network } from './Network.js';

const characterActions = ['jump', 'left', 'forward', 'right', 'back'];

const cameraActions = ['zoomOut', 'zoomIn'];

export const Controls = {
    init() {
        document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;
        View.canvas!.addEventListener('wheel', handleMouseWheel, false);
    }
}
    
function sendActionMessage(action: string, on: boolean | string) {
    const message = {
        'action': 'setAction',
        'which': action,
        'value': on
    };
    Network.send(JSON.stringify(message));
}

function keyToAction(key: string) {
    // these are KeyboardEvent.key keywords
    switch (key) {
        case ' ':
            return 'jump';
        case 'PageUp':
            return 'zoomOut';
        case 'PageDown':
            return 'zoomIn';
        case 'ArrowLeft':
            return 'left';
        case 'ArrowUp':
            return 'forward';
        case 'ArrowRight':
            return 'right';
        case 'ArrowDown':
            return 'back';
        case 'Enter':
            return 'talk';
        default:
            return false;
    }
}

function switchAction(event: { key: string; }, on: boolean) {
    // check if we are editing the text box
    const input = document.getElementsByTagName('input')[0];
    if (input == document.activeElement && event.key != 'Enter')
        return;

    const action = keyToAction(event.key);
    if (action) {
        for (let i in characterActions) {
            if (action == characterActions[i]) {
                // wait for server agreement before moving
                // Scene.player.currentActions[action] = on;
                sendActionMessage(action, on);
                break;
            }
        }
        for (let i in cameraActions) {
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

function handleKeyDown(event: KeyboardEvent) {
    switchAction(event, true);
}

function handleKeyUp(event: KeyboardEvent) {
    switchAction(event, false);
}

function handleMouseWheel(e: WheelEvent) {
    const delta = e.deltaY || -e.detail;
    if (delta >= 0)
        View.camera!.zoomIn();
    else
        View.camera!.zoomOut();
}

function handleTextInput(event: Event) {
    const input = document.getElementsByTagName('input')[0];
    sendActionMessage('talk', input.value);
}