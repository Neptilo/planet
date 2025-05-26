import { Server } from './Server.js';
import { Game } from './Game.js';
import { Scene } from './scene/Scene.js';
import { Character, CharacterData } from './scene/Character.js';
import type { WebSocket } from 'ws';

export type CharacterState = CharacterData & {
    groundAltitude: number;
    velocity: number[];
    currentActions: object;
};

export const Network = {
    init() {
        Server.setOnConnection(function (ws, _req) {
            onConnection(ws);
        });
        tick();
    },

    onMessage(message: string, ws: WebSocket) {
        const m = JSON.parse(message);

        // find client id
        let clientId: string;
        for (let i in Server.activeConnections) {
            if (Server.activeConnections[i] == ws) {
                clientId = i;
                break;
            }
        }

        switch (m.action) {
            case 'setAction':
                const character = Scene.characters[clientId];
                character.currentActions[m.which] = m.value;
                break;
            default:
                console.warn('Received unexpected action');
        }
    }
}

function onConnection(ws: WebSocket) {
    console.info('Connected client #%s', Server.clientNumber);
    // generate new character data
    const theta = Math.PI / 2;//Math.PI*Math.random();
    const phi = Math.PI / 2;//2*Math.PI*Math.random();
    const altitude = Game.getAltitudeFromSphericalPosition(theta, phi, Scene.planet);
    const characterData = {
        'sphericalPosition': {
            'theta': theta,
            'phi': phi,
            'rho': 0
        },
        'altitude': altitude,
        'bearing': 2 * Math.PI * Math.random()
    };

    // update characters data
    Scene.characters[Server.clientNumber] = new Character(characterData);

    let message: {
        action: string;
        clientId?: number;
        characters?: { [clientId: string]: Character };
        characterId?: number;
        characterData?: CharacterData;
    };

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
    for (let i in Server.activeConnections) {
        const client = Server.activeConnections[i];
        client.send(JSON.stringify(message));
    }

    // update active connections
    Server.activeConnections[Server.clientNumber++] = ws;

    ws.on('message', function (message: string) {
        Network.onMessage(message, ws);
    });
    ws.on('close', function (code: number) {

        // find client id
        let clientId: string;
        for (let i in Server.activeConnections) {
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
        const message = {
            'action': 'removeCharacter',
            'characterId': clientId
        };
        for (let i in Server.activeConnections)
            Server.activeConnections[i].send(JSON.stringify(message));
    });
}

function tick() {
    setTimeout(tick, 45);
    updateState();
}

function updateState() {
    const characterStates = {};
    for (let i in Scene.characters) {
        const character = Scene.characters[i];
        const state: CharacterState = {
            bearing: character.bearing,
            sphericalPosition: character.sphericalPosition,
            altitude: character.altitude,
            groundAltitude: character.groundAltitude,
            velocity: character.velocity,
            currentActions: character.currentActions
        };
        characterStates[i] = state;
    }

    const message = {
        'action': 'updateState',
        'characterStates': characterStates
    }

    const readyStates = ['connecting', 'open', 'closing', 'closed'];
    for (let i in Server.activeConnections) {
        const client = Server.activeConnections[i];
        try {
            client.send(JSON.stringify(message));
        } catch (error) {
            console.error('Client #%s %s', i, readyStates[client.readyState]);
        }
    }
}
