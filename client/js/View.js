View = {}

View.resolution = 1;
View.balloonAlphaMax = 0.75;

View.init = function() {
    View.scene = new THREE.Scene();

    View.camera = new View.PlayerCamera();

    View.renderer = new THREE.WebGLRenderer();
    View.renderer.shadowMap.enabled = true;
    View.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    window.onresize = function(event) {
        View.renderer.setSize(
            View.resolution*window.innerWidth,
            View.resolution*window.innerHeight);
        View.camera.aspect = window.innerWidth/window.innerHeight;
        View.camera.updateProjectionMatrix();
    };
    window.onresize();
    View.renderer.setClearColor(0x7EC0EE, 1);
    View.canvas = View.renderer.domElement;
    View.canvas.style.display = 'block';
    document.body.appendChild(View.canvas);
    document.body.style.margin = '0';

    View.pivot = new THREE.Object3D();
    View.pivot.add(View.camera);

    // lighting
    View.sun = new THREE.DirectionalLight(0xffffff, 1);
    View.sun.shadow.camera.near = .1;
    View.sun.castShadow = true;
    View.sun.shadow.camera.left = -16;
    View.sun.shadow.camera.right = 16;
    View.sun.shadow.camera.top = 16;
    View.sun.shadow.camera.bottom = -16;
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
    var texture = new THREE.TextureLoader().load("img/man.png");
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

View.makeBalloon = function(text) {
    // constants
    var balloonHeight = 3; // in world units
    var minBalloonWidth = 4;
    var fontSize = 50; // in px, when drawing on the texture
    
    // prepare texture with text
    // the full height of the texture is used, but not the full width
    var canvas = document.createElement('canvas');
    canvas.width = 1024; // texture dimensions must be powers of two
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    var margin = canvas.height-2*fontSize;
    ctx.font = String(fontSize)+'px sans-serif';
    var textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'white';
    var usedTextureWidth = Math.min(canvas.width,
        Math.max(textWidth+2*margin, canvas.height*minBalloonWidth/balloonHeight));
    ctx.fillRect(0, 0, usedTextureWidth, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillText(text, (usedTextureWidth-textWidth)/2, margin+fontSize);
    var texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    // build geometry
    var geometry = new THREE.BufferGeometry();
    var balloonWidth = balloonHeight*usedTextureWidth/canvas.height;
    var vertices = new Float32Array([
        // tail of the balloon
        0, 0, 0,
        1, 1, 0,
        0, 1, 0,
        // upper-right triangle
        balloonWidth/2, 1, 0,
        balloonWidth/2, balloonHeight+1, 0,
        -balloonWidth/2, balloonHeight+1, 0,
        // lower-left triangle
        -balloonWidth/2, balloonHeight+1, 0,
        -balloonWidth/2, 1, 0,
        balloonWidth/2, 1, 0
    ]);
    var uMax = usedTextureWidth/canvas.width;
    var textureCoordinates = new Float32Array([
        // for the tail of the balloon, take color from margin where there is no text
        0, 0,     margin/canvas.width, 1,  0, 1,
        uMax, 0,  uMax, 1,                 0, 1,
        0, 1,     0, 0,                    uMax, 0
    ]);
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(textureCoordinates, 2));

    // build material
    var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: View.balloonAlphaMax
    });
    var mesh = new THREE.Mesh(geometry, material);

    return mesh;
}

View.PlayerCamera = function() {
    THREE.PerspectiveCamera.call(this, 45, window.innerWidth/window.innerHeight, .1, 100);
    this.distance = View.PlayerCamera.defaultDistance;
    this.elevation = Math.PI*0.4;
    this.currentActions = {};
}

View.PlayerCamera.prototype = new THREE.PerspectiveCamera();

View.PlayerCamera.defaultDistance = 4;

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