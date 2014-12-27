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

    View.ambient = new THREE.AmbientLight(0x222222);
    View.scene.add(View.ambient);
}

View.makePlanet = function(radius) {
    var geometry = new THREE.SphereGeometry(radius, radius, radius);
    var texture = THREE.ImageUtils.loadTexture("img/crate.gif");
    var material = new THREE.MeshPhongMaterial({map: texture});
    var model = new THREE.Mesh(geometry, material);
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
