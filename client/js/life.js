var scene = new THREE.Scene();
var camera = new PlayerCamera();
var renderer = new THREE.WebGLRenderer();
renderer.shadowMapEnabled = true;
renderer.shadowMapType = THREE.PCFSoftShadowMap;
var resolution = 1;
renderer.setSize(resolution*window.innerWidth, resolution*window.innerHeight);
var canvas = renderer.domElement;
canvas.style.display = 'block';
document.body.appendChild(canvas);

// controls
document.onkeydown = handleKeyDown;
document.onkeyup = handleKeyUp;
if (canvas.addEventListener) {
    // IE9, Chrome, Safari, Opera
    canvas.addEventListener('mousewheel', handleMouseWheel, false);
    // Firefox
    canvas.addEventListener('DOMMouseScroll', handleMouseWheel, false);
} else {
    // IE6/7/8
    canvas.attachEvent('onmousewheel', handleMouseWheel);
}

// populate scene with objects
var world = new World();
scene.add(world.model);
var character = new Character();
character.model.rotation.order = 'ZXY';
world.model.add(character.model);
var pivot = new THREE.Object3D();
character.model.add(pivot);
pivot.position.y = character.eyeAltitude-character.size.height/2;
pivot.add(camera);

// lighting
var sun = new THREE.DirectionalLight(0xffffff, 1);
sun.shadowCameraNear = .1;
sun.castShadow = true;
sun.shadowCameraLeft = -16;
sun.shadowCameraRight = 16;
sun.shadowCameraTop = 16;
sun.shadowCameraBottom = -16;
sun.target = character.model;
world.model.add(sun);

var ambient = new THREE.AmbientLight(0x222222);
scene.add(ambient);

function render() {
    requestAnimationFrame(render);

    handleKeys();

    character.model.position.x = (world.radius+character.sphericalPosition.altitude)*Math.sin(character.sphericalPosition.theta)*Math.sin(character.sphericalPosition.phi);
    character.model.position.y = -(world.radius+character.sphericalPosition.altitude)*Math.sin(character.sphericalPosition.theta)*Math.cos(character.sphericalPosition.phi);
    character.model.position.z = (world.radius+character.sphericalPosition.altitude)*Math.cos(character.sphericalPosition.theta);
    character.model.rotation.z = character.sphericalPosition.phi;
    character.model.rotation.x = character.sphericalPosition.theta+Math.PI/2; // because of the way the plane is created
    character.model.rotation.y = -character.bearing;

    sun.position.x = character.model.position.x-1;
    sun.position.y = character.model.position.y-1;
    sun.position.z = character.model.position.z-1;

    pivot.rotation.x = camera.elevation-Math.PI/2;

    camera.position.z = camera.distance;

    renderer.render(scene, camera);
}

render();
