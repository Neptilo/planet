[Here](https://www.youtube.com/playlist?list=PLBaRm1Pdp3BGxmX-5eu4P_Jk0iKddUIq9) are presentation videos for each version.

# Installation

Install nodejs and npm:

* On Linux, run `sudo apt install nodejs npm`.
* On Mac, assuming you have Homebrew installed, run `brew install node`.
* On Windows, download NPM online and install it.

On Linux, you must install dependencies for the node-canvas module to work: `sudo apt install libcairo2-dev libjpeg-dev libgif-dev libpango1.0-dev`

Install modules required to run the server apps: run this command from the repository folder: `npm install`

Finally, build the app: `npm run build`.

If you only want to build the server, run `npm run build:server`.

If you only want to build the client, run `npm run build:client`.

# Run the game

Start the server: `npm run server`.

Open the game from a client: type the server's IP in the address bar of
a browser, e.g. `127.0.0.1`.
