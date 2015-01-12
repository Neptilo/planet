var Canvas = require('canvas');
var fs = require('fs');

function onReadFile(err, data) {
	if (err) throw err;
	var img = new Canvas.Image;
	img.src = data;
	var origCanvas = new Canvas(img.width, img.height);
	var origCtx = origCanvas.getContext('2d');
	origCtx.drawImage(img, 0, 0);

	var newCanvas = new Canvas(img.width+1, img.height+2);
	var newCtx = newCanvas.getContext('2d');
	var squareWidth = img.width/3;
	var squareHeight = img.height/2;
	var square, row, pix;

	// copy original squares
	square = origCtx.getImageData(0, 0, squareWidth, squareHeight);
	newCtx.putImageData(square, 0, 0);
	square = origCtx.getImageData(squareWidth, 0, squareWidth, squareHeight);
	newCtx.putImageData(square, squareWidth, 0);
	square = origCtx.getImageData(2*squareWidth, 0, squareWidth, squareHeight);
	newCtx.putImageData(square, 2*squareWidth, 1);
	square = origCtx.getImageData(0, squareHeight, squareWidth, squareHeight);
	newCtx.putImageData(square, 0, squareHeight+2);
	square = origCtx.getImageData(squareWidth, squareHeight, squareWidth, squareHeight);
	newCtx.putImageData(square, squareWidth, squareHeight+1);
	square = origCtx.getImageData(2*squareWidth, squareHeight, squareWidth, squareHeight);
	newCtx.putImageData(square, 2*squareWidth, squareHeight+1);
	square = null;

	// copy rows of pixels from original image
	row = origCtx.getImageData(0, 0, squareWidth, 1);
	newCtx.putImageData(row, 2*squareWidth, 2*squareHeight+1);
	for (var i = 0; i < squareWidth; i++) {
		pix = origCtx.getImageData(squareWidth+i, 0, 1, 1);
		newCtx.putImageData(pix, 3*squareWidth, 2*squareHeight+1-i);
	}
	row = origCtx.getImageData(2*squareWidth, squareHeight-1, squareWidth, 1);
	newCtx.putImageData(row, 0, squareHeight+1);
	for (var i = 1; i < squareWidth; i++) {
		pix = origCtx.getImageData(i, 2*squareHeight-1, 1, 1);
		newCtx.putImageData(pix, squareWidth-i, squareHeight);
	}
	for (var i = 0; i < squareWidth; i++) {
		pix = origCtx.getImageData(squareWidth+i, squareHeight, 1, 1);
		newCtx.putImageData(pix, 3*squareWidth, squareHeight-i);
	}
	for (var i = 0; i < squareWidth; i++) {
		pix = origCtx.getImageData(2*squareWidth+i, squareHeight, 1, 1);
		newCtx.putImageData(pix, 3*squareWidth-i, 0);
	}
	row = null;

	// copy columns of pixels from original image
	for (var i = 1; i < squareHeight; i++) {
		pix = origCtx.getImageData(0, i, 1, 1);
		newCtx.putImageData(pix, 2*squareWidth-i, 2*squareHeight+1);
	}
	for (var i = 0; i < squareHeight; i++) {
		pix = origCtx.getImageData(0, squareHeight+i, 1, 1);
		newCtx.putImageData(pix, 2*squareWidth-1-i, squareHeight);
	}

	// fill holes with individual pixels
	var d0, d1, d2, d; // pixel data
	d0 = origCtx.getImageData(2*squareWidth-1, 0, 1, 1).data;
	d1 = origCtx.getImageData(2*squareWidth, 0, 1, 1).data;
	d2 = origCtx.getImageData(3*squareWidth-1, squareHeight, 1, 1).data;
	pix = newCtx.createImageData(1, 1);
	d = pix.data;
	d[0] = Math.round((d0[0]+d1[0]+d2[0])/3);
	d[1] = Math.round((d0[1]+d1[1]+d2[1])/3);
	d[2] = Math.round((d0[2]+d1[2]+d2[2])/3);
	d[3] = Math.round((d0[3]+d1[3]+d2[3])/3);
	newCtx.putImageData(pix, 2*squareWidth, 0);
	newCtx.putImageData(pix, 3*squareWidth, squareHeight+1);
	d0 = origCtx.getImageData(0, squareHeight-1, 1, 1).data;
	d1 = origCtx.getImageData(squareWidth-1, 2*squareHeight-1, 1, 1).data;
	d2 = origCtx.getImageData(squareWidth, 2*squareHeight-1, 1, 1).data;
	pix = newCtx.createImageData(1, 1);
	d = pix.data;
	d[0] = Math.round((d0[0]+d1[0]+d2[0])/3);
	d[1] = Math.round((d0[1]+d1[1]+d2[1])/3);
	d[2] = Math.round((d0[2]+d1[2]+d2[2])/3);
	d[3] = Math.round((d0[3]+d1[3]+d2[3])/3);
	newCtx.putImageData(pix, 0, squareHeight);
	newCtx.putImageData(pix, squareWidth, 2*squareHeight+1);

	var out = fs.createWriteStream(__dirname + '/out.png');
	var stream = newCanvas.pngStream();

	stream.on('data', function(chunk){
		out.write(chunk);
	});
}

fs.readFile(__dirname + '/in.png', onReadFile);
