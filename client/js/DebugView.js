DebugView = {}

DebugView.init = function(container) {
    DebugView.scene = new THREE.Scene();

    var width = container.clientWidth;
    var height = container.clientHeight;
    DebugView.camera =
        new THREE.PerspectiveCamera(45, width/height, .1, 100);
    DebugView.scene.add(DebugView.camera);
    DebugView.camera.position.set(4, 0, 3);
    DebugView.camera.lookAt(0, 0, 0);

    DebugView.renderer = new THREE.WebGLRenderer();
    window.onresize = function(event) {
        DebugView.renderer.setSize(width, height);
        DebugView.camera.aspect = width/height;
        DebugView.camera.updateProjectionMatrix();
    };
    window.onresize();
    DebugView.renderer.setClearColor(0, 1);
    DebugView.canvas = DebugView.renderer.domElement;
    DebugView.canvas.style.display = 'block';
    container.appendChild(DebugView.canvas);

    // lighting
    DebugView.ambient = new THREE.AmbientLight(0x000420);
    DebugView.scene.add(DebugView.ambient);

    DebugView.camAngle = 0;
}

DebugView.makeBlock = function(square, sqrUvBounds, planet, name) {
    var uSquare = 0.5*(sqrUvBounds[0]+sqrUvBounds[2]);
    var vSquare = 0.5*(sqrUvBounds[1]+sqrUvBounds[3]);
    var u = 2*uSquare-1;
    var v = 2*vSquare-1;
    var altitude = 0.2*Math.log(1/(sqrUvBounds[2]-sqrUvBounds[0]));
    var fac = (0.6+altitude)/Math.sqrt(1+u*u+v*v);
    var coords = [fac*u, fac*v, fac];
    var vtx = planet.getUnorientedCoordinates(coords, square);
    var geometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    var color = new THREE.Color(altitude, 0.8, 1);
    var material = new THREE.MeshBasicMaterial({color: color});
    var model = new THREE.Mesh(geometry, material);
    model.name = name;
    model.position.set(vtx[0], vtx[1], vtx[2]);
    return model;
}

DebugView.addBlock = function(block) {
    DebugView.scene.add(block.mesh);
}

DebugView.addNeighbors = function(node, neighbors) {
    for (var iNei = 0; iNei < neighbors.length; ++iNei) {
        var neighbor = neighbors[iNei];
        var posDiff = neighbor.mesh.position.clone().sub(node.mesh.position);
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(), posDiff.multiplyScalar(.5));
        var material = new THREE.LineBasicMaterial({color: 0xFF0000});
        var line = new THREE.Line(geometry, material);
        line.name = 'n'+neighbor.mesh.name; // to find it later
        node.mesh.add(line);
    }
}

DebugView.removeNeighbors = function(node, neighbors) {
    if (!neighbors) return;
    for (var iNei = 0; iNei < neighbors.length; ++iNei) {
        var neighbor = neighbors[iNei];
        var toRemove = node.mesh.getObjectByName('n'+neighbor.mesh.name);
        if (!toRemove) continue;
        node.mesh.remove(toRemove);
    }
}

DebugView.addChild = function(node, child) {
    if (!node || !child) return;
    var posDiff = child.mesh.position.clone().sub(node.mesh.position);
    var geometry = new THREE.Geometry();
    geometry.vertices.push(new THREE.Vector3(), posDiff);
    var material = new THREE.LineBasicMaterial({color: 0x00FF00});
    var line = new THREE.Line(geometry, material);
    line.name = 'c'+child.mesh.name; // to find it later
    node.mesh.add(line);
}

DebugView.removeChild = function(node, child) {
    if (!node || !child) return;
    var toRemove = node.mesh.getObjectByName('c'+child.mesh.name);
    if (!toRemove) return;
    node.mesh.remove(toRemove);
}

DebugView.remove = function(model) {
    DebugView.scene.remove(model);
}

DebugView.isShown = function(model) {
    return model.parent === DebugView.scene;
}

DebugView.update = function() {
    DebugView.camAngle += 0.01;
    DebugView.camera.position.x = 4*Math.cos(DebugView.camAngle);
    DebugView.camera.position.y = 4*Math.sin(DebugView.camAngle);
    DebugView.camera.lookAt(0,0,0);
    DebugView.renderer.render(DebugView.scene, DebugView.camera);
}