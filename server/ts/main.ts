import { Server } from './Server.js';
import { Connection } from './Connection.js';
import { Game } from './Game.js';
import { Scene } from './Scene.js';

Scene.init();
Server.init(); // remove this to use an external HTTP server
Connection.init();
Game.init();
