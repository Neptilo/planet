import { Server } from './Server.js';
import { Network } from './Network.js';
import { Game } from './Game.js';
import { Scene } from './scene/Scene.js';

Scene.init();
Server.init(); // remove this to use an external HTTP server
Network.init();
Game.init();
