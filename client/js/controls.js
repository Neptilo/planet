var currentlyPressedKeys = {};

function handleKeyDown(event) {
    currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
    currentlyPressedKeys[event.keyCode] = false;
}

function handleKeys() {
    if (currentlyPressedKeys[37]) {
        // Left cursor key
        player.bearing -= player.angularSpeed;
    }
    if (currentlyPressedKeys[39]) {
        // Right cursor key
        player.bearing += player.angularSpeed;
    }
    if (currentlyPressedKeys[38]) {
        // Up cursor key
        player.move(player.speed);
    }
    if (currentlyPressedKeys[40]) {
        // Down cursor key
        player.move(-player.speed);
    }
    if (currentlyPressedKeys[33]) {
        // Page up
        camera.zoomOut();
    }
    if (currentlyPressedKeys[34]) {
        // Page down
        camera.zoomIn();
    }
}

function handleMouseWheel(e) {
    var e = window.event || e; // old IE
    var delta = e.wheelDelta || -e.detail;
    if (delta >= 0)
        camera.zoomIn();
    else
        camera.zoomOut();
}
