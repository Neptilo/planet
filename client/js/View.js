View = {}

View.resolution = 1;
View.balloonAlphaMax = 0.75;
View.blockSegments = 8; // must be even for a proper block stitching

View.init = function(container) {
    if (!container)
        container = document.body;

    View.scene = new THREE.Scene();

    var width = container.clientWidth;
    var height = container.clientHeight;
    View.camera = new View.PlayerCamera(width, height);

    View.renderer = new THREE.WebGLRenderer();
    View.renderer.shadowMap.enabled = true;
    View.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    window.onresize = function(event) {
        View.renderer.setSize(
            View.resolution*width,
            View.resolution*height);
        View.camera.aspect = width/height;
        View.camera.updateProjectionMatrix();
    };
    window.onresize();
    View.renderer.setClearColor(0x7EC0EE, 1);
    View.canvas = View.renderer.domElement;
    View.canvas.style.display = 'block';
    container.appendChild(View.canvas);

    View.pivot = new THREE.Object3D();
    View.pivot.add(View.camera);
    View.pivot.rotation.x = View.camera.elevation-0.5*Math.PI;

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

    // create 9 face buffers with different combinations of special borders
    // The special borders are designed so that blocks stitch seamlessly with
    // neighbors with lower LOD.
    // iBuf and jBuf define which special borders to use
    View.blockFaceBuffers = [];
    var segments = View.blockSegments;
    for (var iBuf = 0; iBuf < 3; iBuf++) {
        // 0 means left, 1 none, 2 right

        var bufs = [];
        for (var jBuf = 0; jBuf < 3; jBuf++) {
            // 0 means bottom, 1 none, 2 top

            var buf = [];

            // if true, the square is split along the first diagonal: /
            // if false, along the second diagonal: \
            var even = true;

            for (var iFace = 0; iFace < segments; iFace++) {
                for (var jFace = 0; jFace < segments; jFace++) {
                    var decimateLeft = iFace == 0 && iBuf == 0;
                    var decimateRight = iFace == segments-1 && iBuf == 2;
                    var decimateBottom = jFace == 0 && jBuf == 0;
                    var decimateTop = jFace == segments-1 && jBuf == 2;
                    if (even) {
                        if (!decimateRight)
                            buf.push(new THREE.Face3(
                                (segments+1)*iFace+jFace,
                                (segments+1)*(iFace+1+Number(decimateBottom))+jFace,
                                (segments+1)*(iFace+1)+jFace+1));
                        if (!decimateTop)
                            buf.push(new THREE.Face3(
                                (segments+1)*iFace+jFace,
                                (segments+1)*(iFace+1)+jFace+1,
                                (segments+1)*iFace+jFace+1+Number(decimateLeft)));
                    } else {
                        if (!decimateBottom && !decimateLeft)
                            buf.push(new THREE.Face3(
                                (segments+1)*iFace+jFace,
                                (segments+1)*(iFace+1)+jFace,
                                (segments+1)*iFace+jFace+1));
                        buf.push(new THREE.Face3(
                            (segments+1)*iFace+jFace+1,
                            (segments+1)*(iFace+1)+jFace,
                            (segments+1)*(iFace+1+Number(decimateTop))
                                         +jFace+1+Number(decimateRight)));
                    }
                    even = !even;
                }
                even = !even;
            }
            bufs.push(buf);
        }
        View.blockFaceBuffers.push(bufs);
    }
}

View.onPlayerSetup = function(player) {
    player.model.add(View.pivot);
    View.pivot.position.y = player.eyeAltitude-player.size.height/2;
    View.sun.target = player.model;
}

// sqrUvBounds = [uMin, vMin, uMax, vMax]
View.makeBlock = function(square, sqrUvBounds, planet, name) {
    var geometry = new THREE.Geometry();
    var segments = View.blockSegments;
    var uExtent = sqrUvBounds[2]-sqrUvBounds[0];
    var vExtent = sqrUvBounds[3]-sqrUvBounds[1];

    // jailbreak THREE.Geometry to store custom vertexUvs buffer
    geometry.vertexUvs = [];
    
    // vertices and their texture UVs
    var debug = false;
    for (var iVert = 0; iVert <= segments; iVert++) {
        var uSquare = sqrUvBounds[0]+uExtent*iVert/segments;
        var u = 2*uSquare-1;
        for (var jVert = 0; jVert <= segments; jVert++) {

            // vertex
            var vSquare = sqrUvBounds[1]+vExtent*jVert/segments;
            var v = 2*vSquare-1;
            var altitude = Game.getAltitudeFromUv(
                [uSquare, vSquare], [square[0], square[1]], planet);
            var fac = (planet.radius+altitude)/Math.sqrt(1+u*u+v*v);
            var coords = [fac*u, fac*v, fac];
            var vtx = planet.getUnorientedCoordinates(coords, square);
            geometry.vertices.push(new THREE.Vector3(vtx[0], vtx[1], vtx[2]));

            // UV
            if (debug) {
                var uSquareTmp = uSquare;
                uSquare = iVert/segments;
                vSquare = jVert/segments;
            }
            var uTex = (square[0]+uSquare)/3;
            var vTex = (square[1]+vSquare)/2;
            if (debug) uSquare = uSquareTmp;
            geometry.vertexUvs.push(new THREE.Vector2(uTex, vTex));
        }
    }

    // faces
    var defaultFaceBuffer = View.blockFaceBuffers[1][1];
    geometry.faces = new Array(defaultFaceBuffer.length);
    for (i in defaultFaceBuffer)
    {
        geometry.faces[i] = defaultFaceBuffer[i].clone();
        geometry.faces[i].color.setRGB(Math.random(), Math.random(), Math.random());
    }
    // face texture UVs
    View.updateFaceVertexUvs(geometry);

    // normals
    View.computeVertexNormals(geometry);
    View.updateFaceVertexNormals(geometry);

    var model = new THREE.Mesh(geometry, planet.material.clone());
    model.receiveShadow = true;
    model.castShadow = true;
    model.name = name;
    return model;
}

View.addBlock = function(block) {
    View.scene.add(block.mesh);
}

View.updateBlockFaceBuffer = function(block) {
    var mat = block.mesh.material;

    var geometry = block.mesh.geometry;

    // copy face buffer from the appropriate face buffer template
    var fbi = block.faceBufferInd;
    var faceBuffer = View.blockFaceBuffers[fbi[0]][fbi[1]];
    geometry.faces = new Array(faceBuffer.length);
    for (i in faceBuffer)
        geometry.faces[i] = faceBuffer[i].clone();
    geometry.elementsNeedUpdate = true;

    // update buffers that depend on it
    View.updateFaceVertexUvs(geometry);
    View.updateFaceVertexNormals(geometry);
}

// update geometry.faceVertexUvs[0] from the custom geometry.vertexUvs
View.updateFaceVertexUvs = function(geometry) {
    geometry.faceVertexUvs[0] = new Array(geometry.faces.length);
    var uvs = geometry.vertexUvs;
    for (var iFace in geometry.faces) {
        var face = geometry.faces[iFace];
        var faceUvs = [
            uvs[face.a],
            uvs[face.b],
            uvs[face.c]];
        geometry.faceVertexUvs[0][iFace] = faceUvs;
    }
}

// compute vertex normals by averaging geometry's face normals
// and store them in a custom vertexNormals buffer
View.computeVertexNormals = function(geometry) {
    geometry.vertexNormals = new Array(geometry.vertices.length);
    var vn = geometry.vertexNormals;
    for (var v in geometry.vertices) vn[v] = new THREE.Vector3();

    // vertex normals weighted by triangle areas
    // http://www.iquilezles.org/www/articles/normals/normals.htm
    var cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (var f in geometry.faces) {
        var face = geometry.faces[f];
        var vA = geometry.vertices[face.a];
        var vB = geometry.vertices[face.b];
        var vC = geometry.vertices[face.c];
        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab);
        vn[face.a].add(cb);
        vn[face.b].add(cb);
        vn[face.c].add(cb);
    }

    for (var v in geometry.vertices) vn[v].normalize();
}

// update the vertexNormals buffers stored in each face of geometry
// from the custom geometry.vertexNormals
View.updateFaceVertexNormals = function(geometry) {
    var vn = geometry.vertexNormals;
    for (var f in geometry.faces) {
        var face = geometry.faces[f];
        var fvn = face.vertexNormals;
        fvn[0] = vn[face.a];
        fvn[1] = vn[face.b];
        fvn[2] = vn[face.c];
    }
    geometry.normalsNeedUpdate = true;
}

View.addCharacter = function(width, height) {
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
    model.rotation.order = 'ZXY';
    View.scene.add(model);
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

View.remove = function(model) {
    View.scene.remove(model);
}

View.isShown = function(model) {
    return model.parent === View.scene;
}

View.update = function() {
    for (var i in Scene.objects) {
        var character = Scene.objects[i];
        
        // +.5 for each coordinate because of the way of constructing the planet
        // should be removed afterwards
        character.model.position.x =
            (Scene.planet.radius+character.altitude+.5)*
            Math.sin(character.sphericalPosition.theta)*
            Math.sin(character.sphericalPosition.phi);
        character.model.position.y =
            -(Scene.planet.radius+character.altitude+.5)*
            Math.sin(character.sphericalPosition.theta)*
            Math.cos(character.sphericalPosition.phi);
        character.model.position.z =
            (Scene.planet.radius+character.altitude+.5)
            *Math.cos(character.sphericalPosition.theta);

        // +PI/2 because of the way the plane is created
        character.model.rotation.z = character.sphericalPosition.phi;
        character.model.rotation.x = character.sphericalPosition.theta+Math.PI/2;
        character.model.rotation.y = -character.bearing;

        character.updateBalloon(character.currentActions['talk']);
        if (character.balloonModel) {
            character.balloonModel.rotation.y =
                Scene.player.model.rotation.y-character.model.rotation.y;
            character.balloonModel.rotation.x = View.pivot.rotation.x;

            // calculate distance between character and player
            var charDist =
                character.model.position.distanceTo(Scene.player.model.position);

            // distance value for which the maximum alpha is reached
            var dDef = View.PlayerCamera.defaultDistance;
            var dNear = 1; // minimum distance for which a balloon is still visible
            var dFar = 12; // maximum distance for which a balloon is still visible
            var d = charDist+View.camera.distance;

            // This formula yields an opacity of balloonAlphaMax when d == dDef,
            // and a null opacity when d == dNear or dFar
            // So balloons are more transparent when too close or too far from camera
            var dLim;
            if (d <= dDef) {
                dLim = dNear;
            } else {
                dLim = dFar;
            }
            var deltaRatio = (d-dDef)/(dLim-dDef);
            character.balloonModel.material.opacity =
                View.balloonAlphaMax*(1-deltaRatio*deltaRatio);
        }
    }

    View.sun.position.x = Scene.player.model.position.x+4;
    View.sun.position.y = Scene.player.model.position.y;
    View.sun.position.z = Scene.player.model.position.z;

    View.camera.applyActions();
    View.camera.position.z = View.camera.distance;

    View.renderer.render(View.scene, View.camera);
}

View.PlayerCamera = function(width, height) {
    THREE.PerspectiveCamera.call(this, 45, width/height, .1, 100);
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