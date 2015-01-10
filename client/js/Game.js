Game = {};

Game.init = function() {
    Game.lastTime = 0;
    Game.tick();
}

Game.tick = function() {
    requestAnimationFrame(Game.tick, 15);
    var timeNow = new Date().getTime();
    if (Game.lastTime != 0) {
        var deltaTime = timeNow-Game.lastTime;
        Controls.handleActions(deltaTime);
    }
    Game.lastTime = timeNow;

    // update scene
    for (var i in Scene.objects) {
        var character = Scene.objects[i];
        // +.5 for each coordinate because of the way of constructing the planet
        // should be removed afterwards
        character.model.position.x = (Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.sin(character.sphericalPosition.phi);
        character.model.position.y = -(Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.sin(character.sphericalPosition.theta)*Math.cos(character.sphericalPosition.phi);
        character.model.position.z = (Scene.planet.radius+character.sphericalPosition.altitude+.5)*Math.cos(character.sphericalPosition.theta);
        character.model.rotation.z = character.sphericalPosition.phi;
        character.model.rotation.x = character.sphericalPosition.theta+Math.PI/2; // because of the way the plane is created
        character.model.rotation.y = -character.bearing;
    }

    View.sun.position.x = Scene.player.model.position.x-1;
    View.sun.position.y = Scene.player.model.position.y-1;
    View.sun.position.z = Scene.player.model.position.z-1;

    View.pivot.rotation.x = View.camera.elevation-Math.PI/2;

    View.camera.position.z = View.camera.distance;

    // animate

    View.renderer.render(View.scene, View.camera);
}
