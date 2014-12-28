Connection = {};

Connection.init = function() {
    Connection.clientNumber = 0;
    Connection.activeConnections = {};
    var WebSocketServer = require('ws');
    var wss = new WebSocketServer.Server({port: 8010});
    console.log('Server started');

    wss.on('connection', Connection.onConnection);
}

Connection.onConnection = function(ws) {
    // generate new character data
    var characterData = {
        'sphericalPosition': {
            'altitude': .5, // because of the way of constructing the planet. This should be removed afterwards.
            'theta': Math.PI/2,//Math.PI*Math.random(),
            'phi': 0.01*Connection.clientNumber//2*Math.PI*Math.random()
        },
        'bearing': Math.PI/2,//2*Math.PI*Math.random()
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
    }
    for (var i in Connection.activeConnections) {
        var client = Connection.activeConnections[i];
        client.send(JSON.stringify(message));
    }

    // update active connections
    Connection.activeConnections[Connection.clientNumber++] = ws;

    ws.on('message', function(message) {
        Connection.onMessage(message, ws);
    }
);
}

Connection.onMessage = function(message, ws) {
    console.log('Received from client: %s', message);
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
            // tell everyone that this guy made an action
            var message = {
                'action': 'setAction',
                'characterId': clientId,
                'which': m.which,
                'value': m.value
            };
            // If it is the end of a movement, include position and bearing informations to the message.
            if (!m.value) {
                message.position = character.sphericalPosition;
                message.bearing = character.bearing;
            }
            for (var i in Connection.activeConnections) {
                var client = Connection.activeConnections[i];
                console.log(JSON.stringify(message));
                client.send(JSON.stringify(message));
            }
            break;
        default:
            console.log('Received unexpected action');
    }
}
