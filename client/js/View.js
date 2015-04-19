View = {}

View.resolution = 1;

View.init = function() {
    View.scene = new THREE.Scene();

    View.camera = new View.PlayerCamera();

    View.renderer = new THREE.WebGLRenderer();
    View.renderer.shadowMapEnabled = true;
    View.renderer.shadowMapType = THREE.PCFSoftShadowMap;
    View.renderer.setSize(
            View.resolution*window.innerWidth,
            View.resolution*window.innerHeight);
    View.renderer.setClearColor(0x7EC0EE, 1);
    View.canvas = View.renderer.domElement;
    View.canvas.style.display = 'block';
    document.body.appendChild(View.canvas);
    document.body.style.margin = '0';

    View.pivot = new THREE.Object3D();
    View.pivot.add(View.camera);

    // lighting
    View.sun = new THREE.DirectionalLight(0xffffff, 1);
    View.sun.shadowCameraNear = .1;
    View.sun.castShadow = true;
    View.sun.shadowCameraLeft = -16;
    View.sun.shadowCameraRight = 16;
    View.sun.shadowCameraTop = 16;
    View.sun.shadowCameraBottom = -16;
    View.scene.add(View.sun);

    View.ambient = new THREE.AmbientLight(0x000420);
    View.scene.add(View.ambient);
}

View.makeBlock = function(square, blockId, planet) {
    var geometry = new THREE.Geometry();
    var segments = 32;

    for (var iVertex = 0; iVertex <= segments; iVertex++) {
        var uSquare = (blockId[0]+iVertex/segments)/planet.blocksPerSide;
        var u = 2*uSquare-1;
        for (var jVertex = 0; jVertex <= segments; jVertex++) {
            var vSquare = (blockId[1]+jVertex/segments)/planet.blocksPerSide;
            var v = 2*vSquare-1;
            var altitude = Game.getAltitudeFromUv([uSquare, vSquare], [square[0], square[1]], planet);
            var fac = (planet.radius+altitude)/Math.sqrt(1+u*u+v*v);
            var coords = [fac*u, fac*v, fac];
            var vtx = planet.getUnorientedCoordinates(coords, square);
            geometry.vertices.push(new THREE.Vector3(vtx[0], vtx[1], vtx[2]));
        }
    }

    for (var iFace = 0; iFace < segments; iFace++) {
        var uTex = (square[0]+(blockId[0]+iFace/segments)/planet.blocksPerSide)/3;
        var nextUTex = (square[0]+(blockId[0]+(iFace+1)/segments)/planet.blocksPerSide)/3;
        for (var jFace = 0; jFace < segments; jFace++) {
            var vTex = (square[1]+(blockId[1]+jFace/segments)/planet.blocksPerSide)/2;
            var nextVTex = (square[1]+(blockId[1]+(jFace+1)/segments)/planet.blocksPerSide)/2;
            geometry.faces.push(new THREE.Face3(
                        (segments+1)*iFace+jFace,
                        (segments+1)*(iFace+1)+jFace,
                        (segments+1)*(iFace+1)+jFace+1));
            geometry.faces.push(new THREE.Face3(
                        (segments+1)*iFace+jFace,
                        (segments+1)*(iFace+1)+jFace+1,
                        (segments+1)*iFace+jFace+1));
            geometry.faceVertexUvs[0][2*(segments*iFace+jFace)] = [
                new THREE.Vector2(uTex, vTex),
                new THREE.Vector2(nextUTex, vTex),
                new THREE.Vector2(nextUTex, nextVTex)];
            geometry.faceVertexUvs[0][2*(segments*iFace+jFace)+1] = [
                new THREE.Vector2(uTex, vTex),
                new THREE.Vector2(nextUTex, nextVTex),
                new THREE.Vector2(uTex, nextVTex)];
        }
    }

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    var model = new THREE.Mesh(geometry, planet.material);
    model.receiveShadow = true;
    model.castShadow = true;
    return model;
}

View.makeCharacter = function(width, height) {
    var geometry = new THREE.PlaneGeometry(width, height);
    var widthRatio = 254/256;
    var heightRatio = 640/1024;
    var uvs = [];
    uvs.push(new THREE.Vector2(widthRatio, 0));
    uvs.push(new THREE.Vector2(0, 0));
    uvs.push(new THREE.Vector2(0, heightRatio));
    uvs.push(new THREE.Vector2(widthRatio, heightRatio));
    geometry.faceVertexUvs[0] = [];
    geometry.faceVertexUvs[0].push([uvs[2], uvs[1], uvs[3]]);
    geometry.faceVertexUvs[0].push([uvs[1], uvs[0], uvs[3]]);
    var texture = THREE.ImageUtils.loadTexture("img/man.png");
    var material = new THREE.MeshPhongMaterial({map: texture});
    material.alphaTest = .9;
    material.side = THREE.DoubleSide;
    var model = new THREE.Mesh(geometry, material);
    model.receiveShadow = true;
    var boxGeometry = new THREE.BoxGeometry(width/2, height, .1);
    var invisibleMaterial = new THREE.MeshBasicMaterial({transparent: true, opacity: 0});
    var box = new THREE.Mesh(boxGeometry, invisibleMaterial);
    model.add(box);
    box.castShadow = true;
    return model;
}

View.PlayerCamera = function() {
    THREE.PerspectiveCamera.call(this, 45, window.innerWidth/window.innerHeight, .1, 100);
    this.distance = 4;
    this.elevation = Math.PI/2.5;
    this.currentActions = {};
}

View.PlayerCamera.prototype = new THREE.PerspectiveCamera();

View.PlayerCamera.prototype.zoomIn = function() {
    this.distance *= .9;
}

View.PlayerCamera.prototype.zoomOut = function() {
    this.distance += .5/(this.distance+1/this.distance);
}

View.PlayerCamera.prototype.applyActions = function() {
    if (this.currentActions['zoomOut'])
        this.zoomOut();
    if (this.currentActions['zoomIn'])
        this.zoomIn();
}