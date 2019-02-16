[Presentation videos for each version](https://www.youtube.com/playlist?list=PLBaRm1Pdp3BGxmX-5eu4P_Jk0iKddUIq9)

Installation
============

Server
------

Install nginx:
```bash
sudo apt update
sudo apt install nginx
```

Add the provided Websocket configuration file `websocket.conf` in `/etc/nginx/conf.d`

Set Nginx server root in `/etc/nginx/sites-available/default` as `<repository-folder>/client` so the server knows where to look for `index.html` when a client connects to it.

Install nodejs:
`sudo apt install nodejs`

Install npm:
`sudo apt install npm`

Install websocket:
Run this command from the repository folder: `npm install ws`

Or install it globally and create a local link to the global installation:
```bash
sudo npm install -g ws
npm link ws
```

Install node-canvas:

First install dependencies: `sudo apt install libcairo2-dev libjpeg-dev libgif-dev libpango1.0-dev`

Run this command from the repository folder: `npm install canvas`

Or install it globally and create a local link to the global installation:
```bash
sudo npm install -g canvas
npm link canvas
```

To run the game
===============

if the nginx server hasn't been reloaded after changing its configuration, do it now:
`sudo nginx -s reload`

find the server's IP address typing "ifconfig" in a console

replace the one in `client/js/Connection.js` with it

run the game on the server: `node server/js/main.js`

open the game from a client: type the server's IP in the address bar of
a browser.
