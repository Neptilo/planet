require('./Server.js');
require('./Connection.js');
require('./Game.js');
require('./Scene.js');

Scene.init();
Server.init(); // remove this to use an external HTTP server
Connection.init();
Game.init();
