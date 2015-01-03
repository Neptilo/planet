Connection = {};

Connection.wsUri = "ws://127.0.0.1:8020";

Connection.init = function() {
    Connection.ws = new WebSocket(Connection.wsUri);
    Connection.ws.onopen = Connection.onOpen;
    Connection.ws.onclose = Connection.onClose;
    Connection.ws.onmessage = Connection.onMessage;
    Connection.ws.onerror = Connection.onError;
}

Connection.onOpen = function(evt) {
    console.log("Connected to WebSocket server");
}

Connection.onClose = function(evt) {
    console.log("Disconnected from WebSocket server");
}

Connection.onMessage = function(evt) {
    var m = JSON.parse(evt.data);
    switch (m.action) {
        case 'acceptConnection':
            Connection.clientId = m.clientId;
            Connection.characters = m.characters;
            View.init(); // set up Three.js scene
            Controls.init();
            Scene.init(); // populate scene with objects
            Game.init();
            break;
        case 'putNewCharacter':
            Scene.createCharacter(m.characterId, m.characterData);
            break;
        case 'removeCharacter':
            Scene.removeCharacter(m.characterId);
            break;
        case 'updateState':
            for (var i in m.characterStates) {
                var character = Scene.objects[i];
                var state = m.characterStates[i];
                character.bearing = state.bearing;
                character.sphericalPosition = state.sphericalPosition;
                character.currentActions = state.currentActions;
            }
            break;
        default:
            console.log('Unexpected Websocket response: '+m.action);
    }
}

Connection.onError = function(evt) {
    console.log('WebSocket error: ' + evt.data);
}

Connection.send = function(message) {
    console.log("WebSocket client sent: " + message);
    Connection.ws.send(message);
}
