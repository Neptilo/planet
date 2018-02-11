[Presentation videos for each version](https://www.youtube.com/playlist?list=PLBaRm1Pdp3BGxmX-5eu4P_Jk0iKddUIq9)

Installation
============

Server
------

Install nginx:
```bash
sudo apt-add-repository ppa:nginx/stable
sudo apt update
sudo apt install nginx
```

Add the provided Websocket configuration file `websocket.conf` in `etc/nginx/conf.d`
Set Nginx server root in `etc/nginx/sites-available/default` as `<repository-folder>/client` so the server knows where to look for `index.html` when a client connects to it.

Install nodejs

Install npm:
`sudo apt-get install npm`

Install node-canvas:
First install dependencies:
sudo apt install libcairo2-dev libjpeg-dev libgif-dev
Run this command from the repository folder: `npm install canvas`
Or install it globally and create a local link to the global installation:
```bash
sudo npm install -g canvas
npm link canvas
```

To run the game
===============

find the server's IP address typing "ifconfig" in a console
replace the one in stable/client/js/Connection.js with it
run the game on the server: `node stable/server/js/main.js`
open the game from a client: type the server's IP in the address bar of
a browser, or the address IP + "/stable" to get the last stable version.
