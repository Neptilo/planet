var express = require('express');
var path = require('path');
var enableWs = require('express-ws');

Server = {};

Server.init = function() {
    let httpApp = express();

    let staticPath = path.join(__dirname, '../../client');

    // For now, the website is entirely static
    // So allow any file to be served directly
    httpApp.use(express.static(staticPath));
    
    httpApp.get('/', function (_req, res) {
        res.sendFile(path.join(staticPath, 'index.html'));
    });
    
    httpApp.use(function(err, _req, _res, _next) {
        console.error(err);
    });

    httpApp.listen(80, function () {
        console.info('HTTP app listening on port 80');
    });

    Server.wsApp = enableWs(express()).app;
    
    Server.wsApp.listen(8020, function () {
        console.info('WebSocket app listening on port 8020');
    });

    Server.clientNumber = 0;
    Server.activeConnections = [];
}

Server.setOnConnection = function(callback) {
    Server.wsApp.ws('/', callback);
}