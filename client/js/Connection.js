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
    console.info("Connected to WebSocket server");
}

Connection.onClose = function(evt) {
    console.info("Disconnected from WebSocket server");
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
                for (var i in m.characterStates) {
                    var character = Scene.objects[i];
                    var state = m.characterStates[i];
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
            console.warn('Unexpected Websocket response: '+m.action);
    }
}

Connection.onError = function(evt) {
    console.error('WebSocket error: ' + evt.data);
}

Connection.send = function(message) {
    Connection.ws.send(message);
}
