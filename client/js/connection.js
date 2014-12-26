var wsUri = "ws://192.168.1.17:8020";
var clientId;
var characters;

function init() {
    websocket = new WebSocket(wsUri);
    websocket.onopen = onOpen;
    websocket.onclose = onClose;
    websocket.onmessage = onMessage;
    websocket.onerror = onError;
}

function onOpen(evt) {
    console.log("Connected to WebSocket server");
}

function onClose(evt) {
    console.log("Disconnected from WebSocket server");
}

function onMessage(evt) {
    console.log('WebSocket server responded: '+evt.data);
    var m = JSON.parse(evt.data);
    switch (m.action) {
        case 'acceptConnection':
            clientId = m.clientId;
            characters = m.characters;
            run();
            break;
        case 'putNewCharacter':
            createCharacter(m.characterId, m.characterData, world);
            break;
        case 'setAction':
            world.objects[m.characterId].currentActions[m.which] = m.value;
            break;
        default:
            console.log('Unexpected Websocket response: '+m.action);
    }
}

function onError(evt) {
    console.log('WebSocket error: ' + evt.data);
}

function doSend(message) {
    console.log("WebSocket client sent: " + message);
    websocket.send(message);
}

init();
