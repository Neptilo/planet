import * as THREE from "three";
import { Node } from "./scene/Scene.js";
import { Planet } from "./scene/Planet.js";

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let canvas: HTMLCanvasElement;
let camAngle: 0;
let ambient: THREE.AmbientLight;
let nodeToMeshMap = new Map<string, THREE.Mesh>();

export const DebugView = {

    init(container: HTMLDivElement) {
        scene = new THREE.Scene();

        const width = container.clientWidth;
        const height = container.clientHeight;
        camera =
            new THREE.PerspectiveCamera(45, width / height, .1, 100);
        scene.add(camera);
        camera.position.set(3, 0, 0);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer();
        window.onresize = () => {
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

    makeBlock(
        square: number[],
        sqrUvBounds: number[],
        planet: Planet,
        name: string
    ) {
        const uSquare = 0.5 * (sqrUvBounds[0] + sqrUvBounds[2]);
        const vSquare = 0.5 * (sqrUvBounds[1] + sqrUvBounds[3]);
        const u = 2 * uSquare - 1;
        const v = 2 * vSquare - 1;
        const altitude = Math.log(1 / (sqrUvBounds[2] - sqrUvBounds[0]));
        const fac = (0.6 + 0.03 * altitude) / Math.sqrt(1 + u * u + v * v);
        const coords = [fac * u, fac * v, fac];
        const vtx = planet.getUnorientedCoordinates(coords, square);
        const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
        const color = new THREE.Color(1.4 - 0.4 * altitude, 0.2, 0.8);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const model = new THREE.Mesh(geometry, material);
        model.name = name;
        model.position.set(vtx[0], vtx[1], vtx[2]);
        nodeToMeshMap.set(name, model);
    },

    addBlock(block: Node) {
        scene.add(nodeToMeshMap.get(block.name));
    },

    addNeighbors(node: Node, neighbors: Node[]) {
        const nodeMesh = nodeToMeshMap.get(node.name);
        for (let iNei = 0; iNei < neighbors.length; ++iNei) {
            const neighbor = neighbors[iNei];
            const neighborMesh = nodeToMeshMap.get(neighbor.name);
            const posDiff = neighborMesh.position.clone().sub(nodeMesh.position);
            const geometry = new THREE.Geometry();
            geometry.vertices.push(new THREE.Vector3(), posDiff.multiplyScalar(.5));
            const material = new THREE.LineBasicMaterial({ color: 0xFF0000 });
            const line = new THREE.Line(geometry, material);
            line.name = 'n' + neighbor.name; // to find it later
            nodeMesh.add(line);
        }
    },

    removeNeighbors(node: Node, neighbors: Node[]) {
        if (!neighbors) return;
        const nodeMesh = nodeToMeshMap.get(node.name);
        for (let iNei = 0; iNei < neighbors.length; ++iNei) {
            const neighbor = neighbors[iNei];
            const toRemove = nodeMesh.getObjectByName('n' + neighbor.name);
            if (!toRemove) continue;
            nodeMesh.remove(toRemove);
        }
    },

    addChild(node: Node, child: Node) {
        if (!node || !child) return;
        const nodeMesh = nodeToMeshMap.get(node.name);
        if (!nodeMesh) {
            console.error('Mesh to add a child to was not found');
            return;
        }
        const posDiff = nodeToMeshMap.get(child.name).position.clone().sub(nodeMesh.position);
        const geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(), posDiff);
        const material = new THREE.LineBasicMaterial({ color: 0x00FF00 });
        const line = new THREE.Line(geometry, material);
        line.name = 'c' + child.name; // to find it later
        nodeMesh.add(line);
    },

    removeChild(node: Node, child: Node) {
        if (!node || !child) return;
        const nodeMesh = nodeToMeshMap.get(node.name);
        if (!nodeMesh) {
            console.error('Mesh to remove was not found');
            return;
        }
        const toRemove = nodeMesh.getObjectByName('c' + child.name);
        if (!toRemove) return;
        nodeMesh.remove(toRemove);
    },

    hide(node: Node) {
        DebugView.removeModel(nodeToMeshMap.get(node.name));
    },

    remove(node: Node) {
        DebugView.hide(node);
        const mesh = nodeToMeshMap.get(node.name);

        // the only children that should still be there are the tree edge representations,
        // the ones whose name start with a letter
        for (let child of mesh.children)
            if (!isNaN(Number(child.name[0])))
                console.error('Removing node mesh that still has node children');

        nodeToMeshMap.delete(node.name);
    },

    removeModel(model: THREE.Object3D) {
        scene.remove(model);
    },

    isShown(model: { parent: THREE.Scene; }) {
        return model.parent === scene;
    },

    update() {
        camAngle += 0.03;
        camera.position.z = 0.1 * Math.cos(0.45 * camAngle);
        camera.position.y = 0.1 * Math.sin(camAngle);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }
}