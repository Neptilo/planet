Connection = {};

Connection.wsUri = "ws://192.168.1.17:8020";

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
    console.log('WebSocket server responded: '+evt.data);
    var m = JSON.parse(evt.data);
    switch (m.action) {
        case 'acceptConnection':
            Connection.clientId = m.clientId;
            Connection.characters = m.characters;
            View.init(); // set up Three.js scene
            Controls.init();
            Scene.init(); // populate scene with objects
            Game.render();
            break;
        case 'putNewCharacter':
            Scene.createCharacter(m.characterId, m.characterData);
            break;
        case 'setAction':
            var character = Scene.objects[m.characterId];
            character.currentActions[m.which] = m.value;
            if (m.position != undefined)
                character.sphericalPosition = m.position;
            if (m.bearing != undefined)
                character.bearing = m.bearing;
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
