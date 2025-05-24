import * as THREE from "three";

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let canvas: HTMLCanvasElement;
let camAngle: 0;
let ambient: THREE.AmbientLight;

export const DebugView = {

    init(container) {
        scene = new THREE.Scene();

        var width = container.clientWidth;
        var height = container.clientHeight;
        camera =
            new THREE.PerspectiveCamera(45, width / height, .1, 100);
        scene.add(camera);
        camera.position.set(3.5, 0, 0);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer();
        window.onresize = function (event) {
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        window.onresize(new UIEvent(''));
        renderer.setClearColor(0, 1);
        canvas = renderer.domElement;
        canvas.style.display = 'block';
        container.appendChild(canvas);

        // lighting
        ambient = new THREE.AmbientLight(0x000420);
        scene.add(ambient);

        camAngle = 0;
    },

    makeBlock(square, sqrUvBounds, planet, name): THREE.Mesh {
        var uSquare = 0.5 * (sqrUvBounds[0] + sqrUvBounds[2]);
        var vSquare = 0.5 * (sqrUvBounds[1] + sqrUvBounds[3]);
        var u = 2 * uSquare - 1;
        var v = 2 * vSquare - 1;
        var altitude = Math.log(1 / (sqrUvBounds[2] - sqrUvBounds[0]));
        var fac = (0.6 + 0.2 * altitude) / Math.sqrt(1 + u * u + v * v);
        var coords = [fac * u, fac * v, fac];
        var vtx = planet.getUnorientedCoordinates(coords, square);
        var geometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        var color = new THREE.Color(1.4 - 0.4 * altitude, 0.2, 0.8);
        var material = new THREE.MeshBasicMaterial({ color: color });
        var model = new THREE.Mesh(geometry, material);
        model.name = name;
        model.position.set(vtx[0], vtx[1], vtx[2]);
        return model;
    },

    addBlock(block) {
        scene.add(block.mesh);
    },

    addNeighbors(node, neighbors) {
        for (var iNei = 0; iNei < neighbors.length; ++iNei) {
            var neighbor = neighbors[iNei];
            var posDiff = neighbor.mesh.position.clone().sub(node.mesh.position);
            var geometry = new THREE.Geometry();
            geometry.vertices.push(new THREE.Vector3(), posDiff.multiplyScalar(.5));
            var material = new THREE.LineBasicMaterial({ color: 0xFF0000 });
            var line = new THREE.Line(geometry, material);
            line.name = 'n' + neighbor.mesh.name; // to find it later
            node.mesh.add(line);
        }
    },

    removeNeighbors(node, neighbors) {
        if (!neighbors) return;
        for (var iNei = 0; iNei < neighbors.length; ++iNei) {
            var neighbor = neighbors[iNei];
            var toRemove = node.mesh.getObjectByName('n' + neighbor.mesh.name);
            if (!toRemove) continue;
            node.mesh.remove(toRemove);
        }
    },

    addChild(node, child) {
        if (!node || !child) return;
        var posDiff = child.mesh.position.clone().sub(node.mesh.position);
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(), posDiff);
        var material = new THREE.LineBasicMaterial({ color: 0x00FF00 });
        var line = new THREE.Line(geometry, material);
        line.name = 'c' + child.mesh.name; // to find it later
        node.mesh.add(line);
    },

    removeChild(node, child) {
        if (!node || !child) return;
        var toRemove = node.mesh.getObjectByName('c' + child.mesh.name);
        if (!toRemove) return;
        node.mesh.remove(toRemove);
    },

    remove(model) {
        scene.remove(model);
    },

    isShown(model) {
        return model.parent === scene;
    },

    update() {
        camAngle += 0.07;
        camera.position.z = 0.04 * Math.cos(0.45 * camAngle);
        camera.position.y = 0.04 * Math.sin(camAngle);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }
}