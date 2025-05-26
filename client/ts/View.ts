import * as THREE from "three";
import { Game } from './Game.js';
import { Character, Planet, Scene, Node } from './Scene.js';

type BalloonImgData = {
    canvas?: HTMLCanvasElement;
    usedTextureWidth?: number;
    usedTextureHeight?: number;
    margin?: number;
    character?: Character;
}

const resolution = 1;
const balloonAlphaMax = 0.75;
const blockSegments = 8; // must be even for a proper block stitching

let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let pivot: THREE.Object3D;
let sun: THREE.DirectionalLight;
let ambient: THREE.AmbientLight;
let blockFaceBuffers: THREE.Face3[][][];
let nodeToMeshMap = new Map<string, THREE.Mesh>();

class PlayerCamera extends THREE.PerspectiveCamera {
    distance: number;
    elevation: number;
    currentActions: { [action: string]: boolean; };
    static defaultDistance = 4;

    constructor(width: number, height: number) {
        super(45, width / height, .1, 100);
        this.distance = PlayerCamera.defaultDistance;
        this.elevation = Math.PI * 0.4;
        this.currentActions = {};
    }

    zoomIn() {
        this.distance *= .9;
    }

    zoomOut() {
        this.distance += .5 / (this.distance + 1 / this.distance);
    }

    applyActions() {
        if (this.currentActions['zoomOut'])
            this.zoomOut();
        if (this.currentActions['zoomIn'])
            this.zoomIn();
    }
}

export const View = {
    camera: null as PlayerCamera | null,
    canvas: null as HTMLCanvasElement | null,
    init(container?: HTMLElement) {
        if (!container)
            container = document.body;

        scene = new THREE.Scene();

        const width = container.clientWidth;
        const height = container.clientHeight;
        View.camera = new PlayerCamera(width, height);

        renderer = new THREE.WebGLRenderer();
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        window.onresize = function () {
            renderer.setSize(
                resolution * width,
                resolution * height);
            View.camera!.aspect = width / height;
            View.camera!.updateProjectionMatrix();
        };
        window.onresize(new UIEvent(''));
        renderer.setClearColor(0x7EC0EE, 1);
        View.canvas = renderer.domElement;
        View.canvas.style.display = 'block';
        container.appendChild(View.canvas);

        pivot = new THREE.Object3D();
        pivot.add(View.camera);
        pivot.rotation.x = View.camera.elevation - 0.5 * Math.PI;

        // lighting
        sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.shadow.camera.near = .1;
        sun.castShadow = true;
        sun.shadow.camera.left = -16;
        sun.shadow.camera.right = 16;
        sun.shadow.camera.top = 16;
        sun.shadow.camera.bottom = -16;
        scene.add(sun);

        ambient = new THREE.AmbientLight(0x000420);
        scene.add(ambient);

        // create 9 face buffers with different combinations of special borders
        // The special borders are designed so that blocks stitch seamlessly with
        // neighbors with lower LOD.
        // iBuf and jBuf define which special borders to use
        blockFaceBuffers = [];
        const segments = blockSegments;
        for (let iBuf = 0; iBuf < 3; iBuf++) {
            // 0 means left, 1 none, 2 right

            const bufs: THREE.Face3[][] = [];
            for (let jBuf = 0; jBuf < 3; jBuf++) {
                // 0 means bottom, 1 none, 2 top

                const buf: THREE.Face3[] = [];

                // if true, the square is split along the first diagonal: /
                // if false, along the second diagonal: \
                let even = true;

                for (let iFace = 0; iFace < segments; iFace++) {
                    for (let jFace = 0; jFace < segments; jFace++) {
                        const decimateLeft = iFace == 0 && iBuf == 0;
                        const decimateRight = iFace == segments - 1 && iBuf == 2;
                        const decimateBottom = jFace == 0 && jBuf == 0;
                        const decimateTop = jFace == segments - 1 && jBuf == 2;
                        if (even) {
                            if (!decimateRight)
                                buf.push(new THREE.Face3(
                                    (segments + 1) * iFace + jFace,
                                    (segments + 1) * (iFace + 1 + Number(decimateBottom)) + jFace,
                                    (segments + 1) * (iFace + 1) + jFace + 1));
                            if (!decimateTop)
                                buf.push(new THREE.Face3(
                                    (segments + 1) * iFace + jFace,
                                    (segments + 1) * (iFace + 1) + jFace + 1,
                                    (segments + 1) * iFace + jFace + 1 + Number(decimateLeft)));
                        } else {
                            if (!decimateBottom && !decimateLeft)
                                buf.push(new THREE.Face3(
                                    (segments + 1) * iFace + jFace,
                                    (segments + 1) * (iFace + 1) + jFace,
                                    (segments + 1) * iFace + jFace + 1));
                            buf.push(new THREE.Face3(
                                (segments + 1) * iFace + jFace + 1,
                                (segments + 1) * (iFace + 1) + jFace,
                                (segments + 1) * (iFace + 1 + Number(decimateTop))
                                + jFace + 1 + Number(decimateRight)));
                        }
                        even = !even;
                    }
                    even = !even;
                }
                bufs.push(buf);
            }
            blockFaceBuffers.push(bufs);
        }
    },

    onPlayerSetup(player: Character) {
        player.model.add(pivot);
        pivot.position.y = player.eyeAltitude - player.size.height / 2;
        sun.target = player.model;
    },

    // sqrUvBounds = [uMin, vMin, uMax, vMax]
    makeBlock(
        node: Node,
        square: number[],
        sqrUvBounds: number[],
        planet: Planet,
        name: string
    ) {
        const geometry = new THREE.Geometry();
        const segments = blockSegments;
        const uExtent = sqrUvBounds[2] - sqrUvBounds[0];
        const vExtent = sqrUvBounds[3] - sqrUvBounds[1];

        // jailbreak THREE.Geometry to store custom vertexUvs buffer
        geometry['vertexUvs'] = [];

        // vertices and their texture UVs
        const debug = false;
        for (let iVert = 0; iVert <= segments; iVert++) {
            let uSquare = sqrUvBounds[0] + uExtent * iVert / segments;
            const u = 2 * uSquare - 1;
            for (let jVert = 0; jVert <= segments; jVert++) {

                // vertex
                let vSquare = sqrUvBounds[1] + vExtent * jVert / segments;
                const v = 2 * vSquare - 1;
                const altitude = Game.getAltitudeFromUv(
                    [uSquare, vSquare], [square[0], square[1]], planet);
                const fac = (planet.radius + altitude) / Math.sqrt(1 + u * u + v * v);
                const coords = [fac * u, fac * v, fac];
                const vtx = planet.getUnorientedCoordinates(coords, square);
                geometry.vertices.push(new THREE.Vector3(vtx[0], vtx[1], vtx[2]));

                // UV
                let uSquareTmp: number;
                if (debug) {
                    uSquareTmp = uSquare;
                    uSquare = iVert / segments;
                    vSquare = jVert / segments;
                }
                const uTex = (square[0] + uSquare) / 3;
                const vTex = (square[1] + vSquare) / 2;
                if (debug) uSquare = uSquareTmp;
                geometry['vertexUvs'].push(new THREE.Vector2(uTex, vTex));
            }
        }

        // faces
        const defaultFaceBuffer = blockFaceBuffers[1][1];
        geometry.faces = new Array(defaultFaceBuffer.length);
        for (let i in defaultFaceBuffer) {
            geometry.faces[i] = defaultFaceBuffer[i].clone();
            geometry.faces[i].color.setRGB(Math.random(), Math.random(), Math.random());
        }
        // face texture UVs
        updateFaceVertexUvs(geometry);

        // normals
        computeVertexNormals(geometry);
        updateFaceVertexNormals(geometry);

        const model = new THREE.Mesh(geometry, planet.material.clone());
        model.receiveShadow = true;
        model.castShadow = true;
        model.name = name;
        nodeToMeshMap.set(name, model);
    },

    addBlock(block: Node) {
        scene.add(nodeToMeshMap.get(block.name));
    },

    updateBlockFaceBuffer(block: Node) {
        let mesh = nodeToMeshMap.get(block.name);
        const geometry = mesh.geometry as THREE.Geometry;

        // copy face buffer from the appropriate face buffer template
        const fbi = block.faceBufferInd;
        const faceBuffer = blockFaceBuffers[fbi[0]][fbi[1]];
        geometry.faces = new Array(faceBuffer.length);
        for (let i in faceBuffer)
            geometry.faces[i] = faceBuffer[i].clone();
        geometry.elementsNeedUpdate = true;

        // update buffers that depend on it
        updateFaceVertexUvs(geometry);
        updateFaceVertexNormals(geometry);
    },

    addCharacter(width: number, height: number) {
        const geometry = new THREE.PlaneGeometry(width, height);
        const widthRatio = 254 / 256;
        const heightRatio = 640 / 1024;
        const uvs: THREE.Vector2[] = [];
        uvs.push(new THREE.Vector2(widthRatio, 0));
        uvs.push(new THREE.Vector2(0, 0));
        uvs.push(new THREE.Vector2(0, heightRatio));
        uvs.push(new THREE.Vector2(widthRatio, heightRatio));
        geometry.faceVertexUvs[0] = [];
        geometry.faceVertexUvs[0].push([uvs[2], uvs[1], uvs[3]]);
        geometry.faceVertexUvs[0].push([uvs[1], uvs[0], uvs[3]]);
        const texture = new THREE.TextureLoader().load("img/man.png");
        const material = new THREE.MeshPhongMaterial({ map: texture });
        material.alphaTest = .9;
        material.side = THREE.DoubleSide;
        const model = new THREE.Mesh(geometry, material);
        model.receiveShadow = true;
        const boxGeometry = new THREE.BoxGeometry(width / 2, height, .1);
        const invisibleMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
        const box = new THREE.Mesh(boxGeometry, invisibleMaterial);
        model.add(box);
        box.castShadow = true;
        model.rotation.order = 'ZXY';
        scene.add(model);
        return model;
    },

    makeBalloon(text: string, character: Character) {
        // constants
        const defAspectRatio = 4 / 3;
        const fontSize = 50; // in px, when drawing on the texture
        const margin = 30;
        const textureWidth = 1024; // texture dimensions must be powers of two
        const textureHeight = 512;

        // image where we will render the text
        const img: HTMLImageElement & { customData?: BalloonImgData } = new Image();
        img.customData = {};

        // prepare HTML paragraph with multiline text
        const paragraph = document.createElement('p');
        paragraph.style.width = String(textureWidth - 2 * margin) + 'px';
        paragraph.style.font = String(fontSize) + 'px sans-serif';
        paragraph.style.margin = String(margin) + 'px';
        paragraph.style.textAlign = 'center';
        paragraph.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

        // wrap the text inside a span to be able to measure its real size
        const span = document.createElement('span');
        paragraph.appendChild(span);
        span.innerText = text;

        // render it to compute its dimensions
        document.body.appendChild(paragraph);

        // in general, the used width and height are less than the total texture size
        img.customData.usedTextureHeight =
            Math.min(textureHeight, span.offsetHeight + 2 * margin);
        img.customData.usedTextureWidth =
            Math.min(
                textureWidth,
                Math.max(
                    span.offsetWidth + 2 * margin,
                    img.customData.usedTextureHeight * defAspectRatio));
        img.customData.margin = margin;

        // we're done using span's dimensions
        document.body.removeChild(paragraph);

        // draw the HTML paragraph on a canvas
        img.customData.canvas = document.createElement('canvas');
        img.customData.canvas.width = textureWidth;
        img.customData.canvas.height = textureHeight;
        img.customData.character = character;

        const data =
            '<svg xmlns="http://www.w3.org/2000/svg" ' +
            'width="' + textureWidth + '" ' +
            'height="' + textureHeight + '">' +
            '<foreignObject width="100%" height="100%">' +
            paragraph.outerHTML +
            '</foreignObject>' +
            '</svg>';

        img.onload = onBalloonImgLoad;
        img.src = "data:image/svg+xml," + encodeURIComponent(data);
    },

    hide(node: Node) {
        View.removeModel(nodeToMeshMap.get(node.name));
    },

    remove(node: Node) {
        View.hide(node);
        nodeToMeshMap.delete(node.name);
    },

    removeModel(model: THREE.Object3D) {
        scene.remove(model);
    },

    isShown(node: Node) {
        return nodeToMeshMap.get(node.name).parent === scene;
    },

    update() {
        for (let i in Scene.objects) {
            const character = Scene.objects[i];

            // +.5 for each coordinate because of the way of constructing the planet
            // should be removed afterwards
            character.model.position.x =
                (Scene.planet!.radius + character.altitude + .5) *
                Math.sin(character.sphericalPosition.theta) *
                Math.sin(character.sphericalPosition.phi);
            character.model.position.y =
                -(Scene.planet!.radius + character.altitude + .5) *
                Math.sin(character.sphericalPosition.theta) *
                Math.cos(character.sphericalPosition.phi);
            character.model.position.z =
                (Scene.planet!.radius + character.altitude + .5)
                * Math.cos(character.sphericalPosition.theta);

            // +PI/2 because of the way the plane is created
            character.model.rotation.z = character.sphericalPosition.phi;
            character.model.rotation.x = character.sphericalPosition.theta + Math.PI / 2;
            character.model.rotation.y = -character.bearing;

            character.updateBalloon(character.currentActions['talk']);
            if (character.balloonModel) {
                character.balloonModel.rotation.y =
                    Scene.player.model.rotation.y - character.model.rotation.y;
                character.balloonModel.rotation.x = pivot.rotation.x;

                // calculate distance between character and player
                const charDist =
                    character.model.position.distanceTo(Scene.player.model.position);

                // distance value for which the maximum alpha is reached
                const dDef = PlayerCamera.defaultDistance;
                const dNear = 1; // minimum distance for which a balloon is still visible
                const dFar = 12; // maximum distance for which a balloon is still visible
                const d = charDist + View.camera!.distance;

                // This formula yields an opacity of balloonAlphaMax when d == dDef,
                // and a null opacity when d == dNear or dFar
                // So balloons are more transparent when too close or too far from camera
                const dLim = d <= dDef ? dNear : dFar;
                const deltaRatio = (d - dDef) / (dLim - dDef);
                (character.balloonModel.material as THREE.Material).opacity =
                    balloonAlphaMax * (1 - deltaRatio * deltaRatio);
            }
        }

        sun.position.x = Scene.player.model.position.x + 4;
        sun.position.y = Scene.player.model.position.y;
        sun.position.z = Scene.player.model.position.z;

        View.camera!.applyActions();
        View.camera!.position.z = View.camera!.distance;

        renderer.render(scene, View.camera!);
    },

    hasMesh(node: Node) {
        return nodeToMeshMap.has(node.name);
    }
}

// update geometry.faceVertexUvs[0] from the custom geometry.vertexUvs
function updateFaceVertexUvs(geometry: THREE.Geometry) {
    geometry.faceVertexUvs[0] = new Array(geometry.faces.length);
    const uvs = geometry['vertexUvs'];
    for (let iFace in geometry.faces) {
        const face = geometry.faces[iFace];
        const faceUvs = [
            uvs[face.a],
            uvs[face.b],
            uvs[face.c]];
        geometry.faceVertexUvs[0][iFace] = faceUvs;
    }
}

// compute vertex normals by averaging geometry's face normals
// and store them in a custom vertexNormals buffer
function computeVertexNormals(geometry: THREE.Geometry) {
    geometry['vertexNormals'] = new Array(geometry.vertices.length);
    const vn = geometry['vertexNormals'];
    for (let v in geometry.vertices) vn[v] = new THREE.Vector3();

    // vertex normals weighted by triangle areas
    // http://www.iquilezles.org/www/articles/normals/normals.htm
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let f in geometry.faces) {
        const face = geometry.faces[f];
        const vA = geometry.vertices[face.a];
        const vB = geometry.vertices[face.b];
        const vC = geometry.vertices[face.c];
        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab);
        vn[face.a].add(cb);
        vn[face.b].add(cb);
        vn[face.c].add(cb);
    }

    for (let v in geometry.vertices) vn[v].normalize();
}

// update the vertexNormals buffers stored in each face of geometry
// from the custom geometry['vertexNormals']
function updateFaceVertexNormals(geometry: THREE.Geometry) {
    const vn = geometry['vertexNormals'];
    for (let f in geometry.faces) {
        const face = geometry.faces[f];
        const fvn = face['vertexNormals'];
        fvn[0] = vn[face.a];
        fvn[1] = vn[face.b];
        fvn[2] = vn[face.c];
    }
    geometry.normalsNeedUpdate = true;
}

function onBalloonImgLoad() {
    const that = this as HTMLImageElement & { customData?: BalloonImgData };
    const data = that.customData;
    const ctx = data.canvas.getContext('2d');
    const textureWidth = data.canvas.width;
    const textureHeight = data.canvas.height;

    // fill texture background with an extra margin everywhere possible
    // to avoid visible borders
    ctx.fillStyle = 'white';
    ctx.fillRect(
        0.5 * (textureWidth - data.usedTextureWidth) - data.margin,
        0, // can't add a top margin
        data.usedTextureWidth + 2 * data.margin,
        data.usedTextureHeight + data.margin);

    ctx.drawImage(that, 0, 0);

    const texture = new THREE.Texture(data.canvas);
    texture.needsUpdate = true;

    // build geometry
    const geometry = new THREE.BufferGeometry();
    const balloonWidth = 0.023 * data.usedTextureWidth;
    const balloonHeight = 0.023 * data.usedTextureHeight;
    const vertices = new Float32Array([
        // tail of the balloon
        0, 0, 0,
        1, 1, 0,
        0, 1, 0,
        // upper-right triangle
        balloonWidth / 2, 1, 0,
        balloonWidth / 2, balloonHeight + 1, 0,
        -balloonWidth / 2, balloonHeight + 1, 0,
        // lower-left triangle
        -balloonWidth / 2, balloonHeight + 1, 0,
        -balloonWidth / 2, 1, 0,
        balloonWidth / 2, 1, 0
    ]);
    const uWidth = data.usedTextureWidth / textureWidth;
    const vHeight = data.usedTextureHeight / textureHeight;
    const uMin = 0.5 * (1 - uWidth);
    const uMax = 0.5 * (1 + uWidth);
    const uMarginWidth = data.margin / textureWidth;
    const vMin = 1 - vHeight;
    const vMarginHeight = data.margin / textureHeight;
    const textureCoordinates = new Float32Array([
        // for the tail of the balloon, take color from margin where there is no text
        0.5, 1 - vMarginHeight, 0.5 + uMarginWidth, 1, 0.5, 1,
        uMax, vMin, uMax, 1, uMin, 1,
        uMin, 1, uMin, vMin, uMax, vMin
    ]);
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(textureCoordinates, 2));

    // build material
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: balloonAlphaMax
    });

    if (data.character.balloonModel)
        data.character.model.remove(data.character.balloonModel);

    data.character.balloonModel = new THREE.Mesh(geometry, material);
    data.character.balloonModel.rotation.order = 'YXZ';
    const balloonScale = data.character.balloonModel.scale;
    balloonScale.x = balloonScale.y = balloonScale.z = 0.12;
    data.character.balloonModel.position.y = 0.5 + 0.3 * balloonScale.x;

    data.character.model.add(data.character.balloonModel);
}
