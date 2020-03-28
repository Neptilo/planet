[Presentation videos for each version](https://www.youtube.com/playlist?list=PLBaRm1Pdp3BGxmX-5eu4P_Jk0iKddUIq9)

Installation
============

Server
------

Install nodejs and npm:
On Linux, run `sudo apt install nodejs npm`
On Windows, download NPM online and install it.

Install modules required to run the server apps:
Run this command from the repository folder: `npm install express ws express-ws`

Or install it globally and create a local link to the global installation:
```bash
sudo npm install -g express ws express-ws
npm link express
npm link ws
npm link express-ws
```

Install node-canvas:

On Linux, you must install dependencies first: `sudo apt install libcairo2-dev libjpeg-dev libgif-dev libpango1.0-dev`

Run this command from the repository folder: `npm install canvas`

Or install it globally and create a local link to the global installation:
```bash
sudo npm install -g canvas
npm link canvas
```

To run the game
===============

Run the game on the server: `node server/js/main.js`

Open the game from a client: type the server's IP in the address bar of
a browser.
