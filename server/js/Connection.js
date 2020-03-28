Connection = {};

Connection.init = function() {
    Server.setOnConnection(function(ws, _req) {
        Connection.onConnection(ws);
    });
    Connection.tick();
}

Connection.onConnection = function(ws) {
    console.info('Connected client #%s', Server.clientNumber);
    // generate new character data
    var theta = Math.PI/2;//Math.PI*Math.random();
    var phi = Math.PI/2;//2*Math.PI*Math.random();
    var altitude = Game.getAltitudeFromSphericalPosition(theta, phi, Scene.planet);
    var characterData = {
        'sphericalPosition': {
            'theta': theta,
            'phi': phi
        },
        'altitude': altitude,
        'bearing': 2*Math.PI*Math.random()
    };

    // update characters data
    Scene.characters[Server.clientNumber] = new Scene.Character(characterData);

    var message;

    // tell new client about the configuration of the world
    message = {
        'action': 'acceptConnection',
        'clientId': Server.clientNumber,
        'characters': Scene.characters
    }
    ws.send(JSON.stringify(message));

    // tell other clients about the newcomer
    message = {
        'action': 'putNewCharacter',
        'characterId': Server.clientNumber,
        'characterData': characterData
    };
    for (var i in Server.activeConnections) {
        var client = Server.activeConnections[i];
        client.send(JSON.stringify(message));
    }

    // update active connections
    Server.activeConnections[Server.clientNumber++] = ws;

    ws.on('message', function(message) {
        Connection.onMessage(message, ws);
    });
    ws.on('close', function(code) {

        // find client id
        var clientId;
        for (var i in Server.activeConnections) {
            if (Server.activeConnections[i] == ws) {
                clientId = i;
                break;
            }
        }
        console.info('Disconnected client #%s', clientId);
        delete Scene.characters[clientId];

        // update active connections
        delete Server.activeConnections[clientId];

        // tell other clients that this one left
        var message = {
            'action': 'removeCharacter',
            'characterId': clientId
        };
        for (var i in Server.activeConnections)
        Server.activeConnections[i].send(JSON.stringify(message));
    });
}

Connection.onMessage = function(message, ws) {
    var m = JSON.parse(message);

    // find client id
    var clientId;
    for (var i in Server.activeConnections) {
        if (Server.activeConnections[i] == ws) {
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
        state.altitude = character.altitude;
        state.groundAltitude = character.groundAltitude;
        state.velocity = character.velocity;
        state.currentActions = character.currentActions;
        characterStates[i] = state;
    }

    var message = {
        'action': 'updateState',
        'characterStates': characterStates
    }

    var readyStates = ['connecting', 'open', 'closing', 'closed'];
    for (var i in Server.activeConnections) {
        var client = Server.activeConnections[i];
        try {
            client.send(JSON.stringify(message));
        } catch (error) {
            console.error('Client #%s %s', i, readyStates[client.readyState]);
        }
    }
}
