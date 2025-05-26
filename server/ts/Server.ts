import express from 'express';
import path from 'path';
import enableWs from 'express-ws';
import { fileURLToPath } from 'url';

let wsApp: enableWs.Application;
export const Server = {
    clientNumber: 0,
    activeConnections: [] as any[],

    init() {
        let httpApp = express();
        const serverDirName = path.dirname(fileURLToPath(import.meta.url));
        let staticPath = path.join(serverDirName, '../../client');

        // For now, the website is entirely static
        // So allow any file to be served directly
        httpApp.use(express.static(staticPath));

        httpApp.get('/', function (_req, res) {
            res.sendFile(path.join(staticPath, 'index.html'));
        });

        httpApp.use(function (err, _req, _res, _next) {
            console.error(err);
        });

        httpApp.listen(80, function () {
            console.info('HTTP app listening on port 80');
        });

        wsApp = enableWs(express()).app;

        wsApp.listen(8020, function () {
            console.info('WebSocket app listening on port 8020');
        });
    },

    setOnConnection(callback: enableWs.WebsocketRequestHandler) {
        wsApp.ws('/', callback);
    }
}