var Canvas = require('canvas');
var fs = require('fs');

function onReadFile(err, data) {
	if (err) throw err;
	var img = new Canvas.Image;
	img.src = data;
	var origCanvas = new Canvas(img.width, img.height);
	var origCtx = origCanvas.getContext('2d');
	origCtx.drawImage(img, 0, 0);

	var newCanvas = new Canvas(img.width-1, img.height-2);
	var newCtx = newCanvas.getContext('2d');
	var squareWidth = (img.width-1)/3;
	var squareHeight = (img.height-2)/2;
	var square;

	// copy original squares
	square = origCtx.getImageData(0, 0, squareWidth, squareHeight);
	newCtx.putImageData(square, 0, 0);
	square = origCtx.getImageData(squareWidth, 0, squareWidth, squareHeight);
	newCtx.putImageData(square, squareWidth, 0);
	square = origCtx.getImageData(2*squareWidth, 1, squareWidth, squareHeight);
	newCtx.putImageData(square, 2*squareWidth, 0);
	square = origCtx.getImageData(0, squareHeight+2, squareWidth, squareHeight);
	newCtx.putImageData(square, 0, squareHeight);
	square = origCtx.getImageData(squareWidth, squareHeight+1, squareWidth, squareHeight);
	newCtx.putImageData(square, squareWidth, squareHeight);
	square = origCtx.getImageData(2*squareWidth, squareHeight+1, squareWidth, squareHeight);
	newCtx.putImageData(square, 2*squareWidth, squareHeight);
	square = null;

	var out = fs.createWriteStream(__dirname + '/out.png');
	var stream = newCanvas.pngStream();

	stream.on('data', function(chunk){
		out.write(chunk);
	});
}

fs.readFile(__dirname + '/in.png', onReadFile);
