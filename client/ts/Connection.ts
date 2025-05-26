import { View } from './View.js';
import { Controls } from './Controls.js';
import { Scene, CharacterData} from './Scene.js';

const wsUri = 'ws://' + window.location.hostname + ':8020';
let ws: WebSocket;

export const Connection = {
    characters: null as CharacterData[],
    clientId: -1,

    init() {
        ws = new WebSocket(wsUri);
        ws.onopen = onOpen;
        ws.onclose = onClose;
        ws.onmessage = onMessage;
        ws.onerror = onError;
    },

    send(message: string | ArrayBuffer | Blob | ArrayBufferView<ArrayBufferLike>) {
        ws.send(message);
    }
}

function onOpen(_evt: Event) {
    console.info("Connected to WebSocket server");
}

function onClose(_evt: CloseEvent) {
    console.info("Disconnected from WebSocket server");
}

function onMessage(evt: { data: string; }) {
    const m = JSON.parse(evt.data);
    switch (m.action) {
        case 'acceptConnection':
            Connection.clientId = m.clientId;
            Connection.characters = m.characters;
            View.init(); // set up Three.js scene
            Controls.init();
            Scene.init(); // populate scene with objects
            break;
        case 'putNewCharacter':
            if (Scene.objects != undefined)
                Scene.createCharacter(m.characterId, m.characterData);
            else
                console.warn('Tried to add a new character while scene was not fully loaded')
            break;
        case 'removeCharacter':
            if (Scene.objects != undefined)
                Scene.removeCharacter(m.characterId);
            else
                console.warn('Tried to remove a character while scene was not fully loaded')
            break;
        case 'updateState':
            if (Scene.objects != undefined) {
                for (let i in m.characterStates) {
                    const character = Scene.objects[i];
                    const state = m.characterStates[i];
                    character.bearing = state.bearing;
                    character.sphericalPosition = state.sphericalPosition;
                    character.altitude = state.altitude;
                    character.groundAltitude = state.groundAltitude;
                    character.velocity = state.velocity;
                    character.currentActions = state.currentActions;
                }
            }
            break;
        default:
            console.warn('Unexpected Websocket response: ' + m.action);
    }
}

function onError(evt: Event) {
    console.error('WebSocket error: ' + evt);
}