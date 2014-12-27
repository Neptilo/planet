function Planet() {
    this.radius = 100;
}

function Character(data) {
    this.speed = .1;
    this.angularSpeed = .02;
    this.bearing = data.bearing;
    this.eyeAltitude = 1;
    this.sphericalPosition = data.sphericalPosition;
    this.size = {
        "width": .4,
        "height": 1
    };
    this.currentActions = {};
}

Character.prototype.move = function(speed) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(planet.radius+this.sphericalPosition.altitude+this.eyeAltitude);
    var newTheta = Math.acos(Math.cos(theta)*Math.cos(d)+Math.sin(theta)*Math.sin(d)*Math.cos(b));
    var dTheta = newTheta-theta;
    this.sphericalPosition.theta = newTheta;
    this.sphericalPosition.phi += Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));
    if (d >= 0)
        this.bearing = Math.atan2(
                Math.sin(b)*Math.sin(d)*Math.sin(theta),
                Math.cos(d)*Math.cos(newTheta)-Math.cos(theta));
    else
        this.bearing = Math.atan2(
                -Math.sin(b)*Math.sin(d)*Math.sin(theta),
                -(Math.cos(d)*Math.cos(newTheta)-Math.cos(theta)));
}

var WebSocketServer = require('ws').Server;
var clientNumber = 0;
var planet = new Planet();
var characters = [];
var activeConnections = {};
var wss = new WebSocketServer({port: 8010});
console.log("Server started");

wss.on('connection', function(ws) {
    // generate new character data
    var characterData = {
        'sphericalPosition': {
            'altitude': .5, // because of the way of constructing the plane. This should be removed afterwards.
            'theta': Math.PI/2,//Math.PI*Math.random(),
            'phi': 0.01*clientNumber//2*Math.PI*Math.random()
        },
        'bearing': Math.PI/2,//2*Math.PI*Math.random()
    };

    // update characters data
    characters[clientNumber] = new Character(characterData);

    var message;

    // tell new client about the configuration of the world
    message = {
        'action': 'acceptConnection',
        'clientId': clientNumber,
        'characters': characters
    }
    ws.send(JSON.stringify(message));

    // tell other clients about the newcomer
    message = {
        'action': 'putNewCharacter',
        'characterId': clientNumber,
        'characterData': characterData
    }
    for (var i in activeConnections) {
        var client = activeConnections[i];
        client.send(JSON.stringify(message));
    }

    // update active connections
    activeConnections[clientNumber++] = ws;

    ws.on('message', function(message) {
        console.log('Received from client: %s', message);
        var m = JSON.parse(message);

        // find client id
        var clientId;
        for (var i in activeConnections) {
            if (activeConnections[i] == ws) {
                clientId = i;
                break;
            }
        }

        switch (m.action) {
            case 'setAction':
                var character = characters[clientId];
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
                for (var i in activeConnections) {
                    var client = activeConnections[i];
                    console.log(JSON.stringify(message));
                    client.send(JSON.stringify(message));
                }
                break;
            default:
                console.log('Received unexpected action');
        }
    });
});

function handleMovements() {
    for (var i in characters) {
        var character = characters[i];
        var actions = character.currentActions;
        if (actions['left'])
            character.bearing -= character.angularSpeed;
        if (actions['right'])
            character.bearing += character.angularSpeed;
        if (actions['forward'])
            character.move(character.speed);
        if (actions['back'])
            character.move(-character.speed);
    }
}

var lastTime = 0;

function tick() {
    setTimeout(tick, 15);
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var deltaTime = timeNow-lastTime;
        handleMovements();
    }
    lastTime = timeNow;
}

tick();
