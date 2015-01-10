Connection = {};

Connection.init = function() {
    Connection.clientNumber = 0;
    Connection.activeConnections = [];
    var WebSocketServer = require('ws');
    var wss = new WebSocketServer.Server({port: 8010});
    console.info('Server started');

    wss.on('connection', Connection.onConnection);
    Connection.tick();
}

Connection.onConnection = function(ws) {
    console.info('Connected client #%s', Connection.clientNumber);
    // generate new character data
    var characterData = {
        'sphericalPosition': {
            'altitude': 0,
            'theta': Math.PI/4,//Math.PI*Math.random(),
            'phi': 0//.01*Connection.clientNumber//2*Math.PI*Math.random()
        },
        'bearing': 0,//2*Math.PI*Math.random()
    };

    // update characters data
    Scene.characters[Connection.clientNumber] = new Scene.Character(characterData);

    var message;

    // tell new client about the configuration of the world
    message = {
        'action': 'acceptConnection',
        'clientId': Connection.clientNumber,
        'characters': Scene.characters
    }
    ws.send(JSON.stringify(message));

    // tell other clients about the newcomer
    message = {
        'action': 'putNewCharacter',
        'characterId': Connection.clientNumber,
        'characterData': characterData
    };
    for (var i in Connection.activeConnections) {
        var client = Connection.activeConnections[i];
        client.send(JSON.stringify(message));
    }

    // update active connections
    Connection.activeConnections[Connection.clientNumber++] = ws;

    ws.on('message', function(message) {
        Connection.onMessage(message, ws);
    });
    ws.on('close', function(code) {

        // find client id
        var clientId;
        for (var i in Connection.activeConnections) {
            if (Connection.activeConnections[i] == ws) {
                clientId = i;
                break;
            }
        }
        console.info('Disconnected client #%s', clientId);
        delete Scene.characters[clientId];

        // update active connections
        delete Connection.activeConnections[clientId];

        // tell other clients that this one left
        var message = {
            'action': 'removeCharacter',
            'characterId': clientId
        };
        for (var i in Connection.activeConnections)
            Connection.activeConnections[i].send(JSON.stringify(message));
    });
}

Connection.onMessage = function(message, ws) {
    var m = JSON.parse(message);

    // find client id
    var clientId;
    for (var i in Connection.activeConnections) {
        if (Connection.activeConnections[i] == ws) {
            clientId = i;
            break;
        }
    }

    switch (m.action) {
        case 'setAction':
            var character = Scene.characters[clientId];
            character.currentActions[m.which] = m.value;
            break;
        default:
            console.warn('Received unexpected action');
    }
}

Connection.tick = function() {
    setTimeout(Connection.tick, 45);
    Connection.updateState();
}

Connection.updateState = function() {
    var characterStates = {};
    for (var i in Scene.characters) {
        var character = Scene.characters[i];
        var state = {};
        state.bearing = character.bearing;
        state.sphericalPosition = character.sphericalPosition;
        state.currentActions = character.currentActions;
        characterStates[i] = state;
    }

    var message = {
        'action': 'updateState',
        'characterStates': characterStates
    }

    for (var i in Connection.activeConnections) {
        var client = Connection.activeConnections[i];
        client.send(JSON.stringify(message));
    }
}
