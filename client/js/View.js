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

// sqrUvBounds = [uMin, vMin, uMax, vMax]
View.makeBlock = function(square, sqrUvBounds, planet) {
    var geometry = new THREE.Geometry();
    var segments = 8;
    var uExtent = sqrUvBounds[2]-sqrUvBounds[0];
    var vExtent = sqrUvBounds[3]-sqrUvBounds[1];

    for (var iVertex = 0; iVertex <= segments; iVertex++) {
        var uSquare = sqrUvBounds[0]+uExtent*iVertex/segments;
        var u = 2*uSquare-1;
        for (var jVertex = 0; jVertex <= segments; jVertex++) {
            var vSquare = sqrUvBounds[1]+vExtent*jVertex/segments;
            var v = 2*vSquare-1;
            var altitude = Game.getAltitudeFromUv(
                [uSquare, vSquare], [square[0], square[1]], planet);
            var fac = (planet.radius+altitude)/Math.sqrt(1+u*u+v*v);
            var coords = [fac*u, fac*v, fac];
            var vtx = planet.getUnorientedCoordinates(coords, square);
            geometry.vertices.push(new THREE.Vector3(vtx[0], vtx[1], vtx[2]));
        }
    }

    var debug = false;
    for (var iFace = 0; iFace < segments; iFace++) {
        var uTex = (square[0]+sqrUvBounds[0]+uExtent*iFace/segments)/3;
        var nextUTex = (square[0]+sqrUvBounds[0]+uExtent*(iFace+1)/segments)/3;
        if (debug) {
            uTex = (square[0]+iFace/segments)/3;
            nextUTex = (square[0]+(iFace+1)/segments)/3;
        }
        for (var jFace = 0; jFace < segments; jFace++) {
            var vTex = (square[1]+sqrUvBounds[1]+vExtent*jFace/segments)/2;
            var nextVTex = (square[1]+sqrUvBounds[1]+vExtent*(jFace+1)/segments)/2;
            if (debug) {
                vTex = (square[1]+jFace/segments)/2;
                nextVTex = (square[1]+(jFace+1)/segments)/2;
            }
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

View.makeBalloon = function(text, character) {
    // constants
    var defAspectRatio = 4/3;
    var fontSize = 50; // in px, when drawing on the texture
    var margin = 30;
    var textureWidth = 1024; // texture dimensions must be powers of two
    var textureHeight = 512;

    // image where we will render the text
    var img = new Image();
    img.customData = {};

    // prepare HTML paragraph with multiline text
    var paragraph = document.createElement('p');
    paragraph.style.width = String(textureWidth-2*margin)+'px';
    paragraph.style.font = String(fontSize)+'px sans-serif';
    paragraph.style.margin = String(margin)+'px';
    paragraph.style.textAlign = 'center';
    paragraph.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    // wrap the text inside a span to be able to measure its real size
    var span = document.createElement('span');
    paragraph.appendChild(span);
    span.innerText = text;

    // render it to compute its dimensions
    document.body.appendChild(paragraph);

    // in general, the used width and height are less than the total texture size
    img.customData.usedTextureHeight =
        Math.min(textureHeight, span.offsetHeight+2*margin);
    img.customData.usedTextureWidth =
        Math.min(
            textureWidth,
            Math.max(
                span.offsetWidth+2*margin,
                img.customData.usedTextureHeight*defAspectRatio));
    img.customData.margin = margin;

    // we're done using span's dimensions
    document.body.removeChild(paragraph);

    // draw the HTML paragraph on a canvas
    img.customData.canvas = document.createElement('canvas');
    img.customData.canvas.width = textureWidth;
    img.customData.canvas.height = textureHeight;
    img.customData.character = character;

    var data =
        '<svg xmlns="http://www.w3.org/2000/svg" '+
        'width="'+textureWidth+'" '+
        'height="'+textureHeight+'">'+
        '<foreignObject width="100%" height="100%">'+
        paragraph.outerHTML+
        '</foreignObject>'+
        '</svg>';
            
    img.onload = View.onBalloonImgLoad;
    img.src = "data:image/svg+xml," + encodeURIComponent(data);
}

View.onBalloonImgLoad = function() {
    var data = this.customData;
    var ctx = data.canvas.getContext('2d');
    var textureWidth = data.canvas.width;
    var textureHeight = data.canvas.height;

    // fill texture background with an extra margin everywhere possible
    // to avoid visible borders
    ctx.fillStyle = 'white';
    ctx.fillRect(
        0.5*(textureWidth-data.usedTextureWidth)-data.margin,
        0, // can't add a top margin
        data.usedTextureWidth+2*data.margin,
        data.usedTextureHeight+data.margin);

    ctx.drawImage(this, 0, 0);
    
    var texture = new THREE.Texture(data.canvas);
    texture.needsUpdate = true;

    // build geometry
    var geometry = new THREE.BufferGeometry();
    var balloonWidth = 0.023*data.usedTextureWidth;
    var balloonHeight = 0.023*data.usedTextureHeight;
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
    var uWidth = data.usedTextureWidth/textureWidth;
    var vHeight = data.usedTextureHeight/textureHeight;
    var uMin = 0.5*(1-uWidth);
    var uMax = 0.5*(1+uWidth);
    var uMarginWidth = data.margin/textureWidth;
    var vMin = 1-vHeight;
    var vMarginHeight = data.margin/textureHeight;
    var textureCoordinates = new Float32Array([
        // for the tail of the balloon, take color from margin where there is no text
        0.5, 1-vMarginHeight,  0.5+uMarginWidth, 1,  0.5, 1,
        uMax, vMin,            uMax, 1,              uMin, 1,
        uMin, 1,               uMin, vMin,           uMax, vMin
    ]);
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(textureCoordinates, 2));

    // build material
    var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: View.balloonAlphaMax
    });

    if (data.character.balloonModel)
        data.character.model.remove(data.character.balloonModel);

    data.character.balloonModel = new THREE.Mesh(geometry, material);
    data.character.balloonModel.rotation.order = 'YXZ';
    var balloonScale = data.character.balloonModel.scale;
    balloonScale.x = balloonScale.y = balloonScale.z = 0.12;
    data.character.balloonModel.position.y = 0.5+0.3*balloonScale.x;

    data.character.model.add(data.character.balloonModel);
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