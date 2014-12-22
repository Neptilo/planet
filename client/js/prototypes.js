function World() {
    this.radius = 100;

    var geometry = new THREE.SphereGeometry(100, 100, 100);
    var texture = THREE.ImageUtils.loadTexture("img/crate.gif");
    var material = new THREE.MeshPhongMaterial({map: texture});
    this.model = new THREE.Mesh(geometry, material);
    this.model.receiveShadow = true;
    this.model.castShadow = true;
}

function Character() {
    this.speed = .1;
    this.angularSpeed = .02;
    this.bearing = -Math.PI/2;
    this.eyeAltitude = 1;
    this.sphericalPosition = {
        "altitude": .5, // because of the way of constructing the plane. This should be removed afterwards.
        "theta": Math.PI/2,
        "phi": 0
    };
    this.size = {
        "width": .4,
        "height": 1
    };
    
    var geometry = new THREE.PlaneGeometry(this.size.width, this.size.height);
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
    this.model = new THREE.Mesh(geometry, material);
    this.model.receiveShadow = true;
    var boxGeometry = new THREE.BoxGeometry(this.size.width/2, this.size.height, .1);
    var invisibleMaterial = new THREE.Material({transparent: true, opacity: 0});
    var box = new THREE.Mesh(boxGeometry, invisibleMaterial);
    this.model.add(box);
    box.castShadow = true;
}

Character.prototype.move = function(speed) {
    var theta = this.sphericalPosition.theta;
    var b = this.bearing;
    var d = speed/(world.radius+this.sphericalPosition.altitude+this.eyeAltitude);
    var newTheta = Math.acos(Math.cos(theta)*Math.cos(d)+Math.sin(theta)*Math.sin(d)*Math.cos(b));
    var dTheta = newTheta-theta;
    this.sphericalPosition.theta = newTheta;
    this.sphericalPosition.phi += Math.atan2(
            Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.cos(d)-Math.cos(theta)*Math.cos(newTheta));
    this.bearing = Math.atan2(
            Math.sign(d)*Math.sin(b)*Math.sin(d)*Math.sin(theta),
            Math.sign(d)*(Math.cos(d)*Math.cos(newTheta)-Math.cos(theta)));
}

function PlayerCamera() {
    THREE.PerspectiveCamera.call(this, 45, window.innerWidth/window.innerHeight, .1, 100);
    this.distance = 4;
    this.elevation = Math.PI/2.5;
}

PlayerCamera.prototype = new THREE.PerspectiveCamera();

PlayerCamera.prototype.zoomIn = function() {
    this.distance *= .9;
}

PlayerCamera.prototype.zoomOut = function() {
    this.distance += .5/(this.distance+1/this.distance);
}
