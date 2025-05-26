import * as THREE from "three";
import { View } from './View.js';
import { Game } from './Game.js';
import { Connection } from './Connection.js';
import { Geom, SphericalPosition } from './Geom.js';

type Table = { width?: number; height?: number; data?: number[]; };

export type CharacterData = {
    bearing: number;
    sphericalPosition: SphericalPosition;
    altitude: number;
};

export type Node = {
    subBlocks: Node[];
    faceBufferInd: number[];
    name: string;
    neighbors: { [x: number]: Node[]; };
}

type BlockData = {
    parentNode: Node;
    planet: Planet;
    id: number;
    square: number[];
    sqrUvBounds: number[];
    name: string;
}

export class Planet {
    radius = 100;
    minAltitude = -2.5;
    maxAltitude = 2.5;
    gravity = .0001;
    blocksPerSide = 8; // The number of blocks in a square is the square of this.

    /* Mapping of each square to its orthogonal axis and direction in world space
        +--+--+--+
        |x-|z+|x+|
        +--+--+--+
        |y-|z-|y+|
        +--+--+--+ */

    // coordInds[k][i][j] gives the axis, in local square space, (u, v, w)
    // representing the k-th world-space dimension (x, y, z) for square [i, j].
    // coordSigns[k][i][j] is the direction of that axis.
    coordInds = [
        [[1, 2], [1, 0], [1, 2]],
        [[2, 1], [0, 1], [2, 1]],
        [[0, 0], [2, 2], [0, 0]]];
    coordSigns = [
        [[1, -1], [1, 1], [1, 1]],
        [[-1, 1], [1, 1], [1, 1]],
        [[-1, 1], [-1, 1], [1, -1]]];

    // squareInds[dim][pos] are the indices of the square orthogonal to the dim
    // axis and on the positive (resp. negative) side if pos is 1 (resp. 0).
    // uSigns[dim][pos] represents the direction of the first axis of
    // that square in world space.
    squareInds = [
        [[0, 1], [2, 1]],
        [[0, 0], [2, 0]],
        [[1, 0], [1, 1]]];

    uSigns = [[-1, 1], [1, 1], [1, -1]];
    blockLoadDistance = 3; // must be at least 1
    blockUnloadDistance = 5; // must be at least 2 more than blockLoadDistance
    blocks: { [id: number]: Node; } = {};
    terrainVisitor: TerrainVisitor = new TerrainVisitor(this);
    material: THREE.MeshBasicMaterial;
    altitudeMap: Table = {};

    constructor() {
        // altitude
        const planet = this;
        const img = new Image;
        img.onload = () => {
            planet.setAltitudeMap(img);
            Scene.makeWorld(); // populate scene with objects and update terrain
        };
        img.src = 'img/altitude.png';

        // view: material
        const diffuseTexture = new THREE.TextureLoader().load("img/map.png");
        this.material = new THREE.MeshBasicMaterial({ map: diffuseTexture });
    }

    setAltitudeMap(img: HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        this.altitudeMap.width = img.width;
        this.altitudeMap.height = img.height;

        // copy only red channel of img into altitudeMap
        const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
        this.altitudeMap.data = [];
        for (let i = 0; i < imgData.length / 4; i++) {
            this.altitudeMap.data[i] = imgData[4 * i];
        }
    }

    updateTerrain(uv: number[], square: number[]) {
        const blockInd = Game.getBlockIndFromUv(uv, this);

        // unload far away blocks
        let id: number;
        // @ts-ignore I know my key is a number
        for (id in this.blocks) {
            const j = id % this.blocksPerSide;
            let tmp = (id - j) / this.blocksPerSide;
            const i = tmp % this.blocksPerSide;
            tmp = (tmp - i) / this.blocksPerSide;
            const jSquare = tmp % 2;
            const iSquare = (tmp - jSquare) / 2;
            const d = this.blockDistance(blockInd, square, [i, j], [iSquare, jSquare]);
            if (d > this.blockUnloadDistance)
                this.terrainVisitor.deleteBlockNode(null, id, id + '/');
        }

        // load all blocks within a radius of blockLoadDistance
        for (let i = -this.blockLoadDistance; i <= this.blockLoadDistance; i++) {
            for (let j = -this.blockLoadDistance; j <= this.blockLoadDistance; j++) {
                const indSquare = this.blockAdd(blockInd, square, [i, j]);
                if (indSquare == null)
                    continue;
                const ind = indSquare[0];
                const sqr = indSquare[1];
                id = this.getBlockIdFromInd(ind, sqr);
                if (this.blocks[id] != undefined)
                    continue; // block already exists

                // schedule block creation after render
                const sqrUvBounds = [
                    ind[0] / this.blocksPerSide, ind[1] / this.blocksPerSide,
                    (ind[0] + 1) / this.blocksPerSide, (ind[1] + 1) / this.blocksPerSide
                ];
                this.createBlockLater(null, id, sqr, sqrUvBounds, id + '/');
            }
        }

        // visit all existing blocks and refine every leaf down to the required depth
        this.terrainVisitor.square = square;
        this.terrainVisitor.uv = uv;
        // @ts-ignore I know my key is a number
        for (id in this.blocks) {
            const node = this.blocks[id];
            const j = id % this.blocksPerSide;
            let tmp = (id - j) / this.blocksPerSide;
            const i = tmp % this.blocksPerSide;
            tmp = (tmp - i) / this.blocksPerSide;
            const jSquare = tmp % 2;
            const iSquare = (tmp - jSquare) / 2;
            const sqrUvBounds = [
                i / this.blocksPerSide, j / this.blocksPerSide,
                (i + 1) / this.blocksPerSide, (j + 1) / this.blocksPerSide
            ];
            this.terrainVisitor.visitBlockNode(
                node,
                0,
                id + '/',
                [i, j],
                [iSquare, jSquare],
                sqrUvBounds);
        }
    }

    createBlockLater(
        parentNode: Node, id: number, square: number[], sqrUvBounds: number[], name: string) {
        Game.taskList.push({
            handler: Scene.createBlock,
            data: {
                planet: this,
                parentNode: parentNode,
                id: id,
                square: square,
                sqrUvBounds: sqrUvBounds, name: name
            }
        });
    }

    // returns the distance between uv and the nearest point on the given uv bounds
    // in UV units
    uvToBoundsDistance(
        uv: number[], square0: number[], sqrUvBounds: number[], square1: number[]) {
        if (square0[0] == square1[0] && square0[1] == square1[1]) {
            return Geom.pointToBoundsDistance(uv, sqrUvBounds);
        } else {
            const coords: number[] = [];
            coords[0] = uv[0] - 0.5;
            coords[1] = uv[1] - 0.5;
            coords[2] = 0.5;
            const posOnCube = this.getUnorientedCoordinates(coords, square0);
            coords[0] = sqrUvBounds[0] - 0.5;
            coords[1] = sqrUvBounds[1] - 0.5;
            const minOnCube = this.getUnorientedCoordinates(coords, square1);
            coords[0] = sqrUvBounds[2] - 0.5;
            coords[1] = sqrUvBounds[3] - 0.5;
            const maxOnCube = this.getUnorientedCoordinates(coords, square1);
            return Geom.pointToBoundsDistance(posOnCube, minOnCube.concat(maxOnCube));
        }
    }

    // returns the distance in terms of blocks between two blocks
    blockDistance(ind0: number[], square0: number[], ind1: number[], square1: number[]) {
        if (square0[0] == square1[0] && square0[1] == square1[1])
            return Geom.dist(ind0, ind1, 0);
        else {
            const coords: number[] = [];
            coords[0] = ind0[0] - this.blocksPerSide / 2 + 0.5;
            coords[1] = ind0[1] - this.blocksPerSide / 2 + 0.5;
            coords[2] = this.blocksPerSide / 2;
            const a = this.getUnorientedCoordinates(coords, square0);
            coords[0] = ind1[0] - this.blocksPerSide / 2 + 0.5;
            coords[1] = ind1[1] - this.blocksPerSide / 2 + 0.5;
            const b = this.getUnorientedCoordinates(coords, square1);
            return Geom.dist(a, b, 0);
        }
    }

    // Return the index and square of the block at the postion of the block at index ind
    // in the given square, translated by t
    // t is a translation vector in terms of block indices
    // coordinates in t must be less than blocksPerSide
    blockAdd(ind: number[], square: number[], t: number[]) {
        const i = ind[0] + t[0];
        const j = ind[1] + t[1];
        let coordsOutBounds = 0;
        let sideInd: number[] = []; // index of the result on a side square
        if (i < 0) {
            sideInd = [-1, j, this.blocksPerSide + i];
            coordsOutBounds++;
        } else if (i >= this.blocksPerSide) {
            sideInd = [this.blocksPerSide, j, 2 * this.blocksPerSide - i - 1];
            coordsOutBounds++;
        }
        if (j < 0) {
            sideInd = [i, -1, this.blocksPerSide + j];
            coordsOutBounds++;
        } else if (j >= this.blocksPerSide) {
            sideInd = [i, this.blocksPerSide, 2 * this.blocksPerSide - j - 1];
            coordsOutBounds++;
        }
        if (!coordsOutBounds)
            return [[i, j], square];
        else if (coordsOutBounds > 1)
            return null; // such a block doesn't exist
        else {
            // convert sideInd into absolute coordinates
            for (let iCoord = 0; iCoord < 3; iCoord++)
                sideInd[iCoord] -= (this.blocksPerSide - 1) / 2;
            const coords = this.getUnorientedCoordinates(sideInd, square);

            // find square
            // find biggest coordinate
            let wInd = 0;
            let w = 0;
            for (let dim = 0; dim < 3; dim++) {
                if (Math.abs(coords[dim]) > Math.abs(w)) {
                    w = coords[dim];
                    wInd = dim;
                }
            }
            const resSquare = this.squareInds[wInd][Number(w >= 0)];

            // convert coords into resSquare coordinate system
            const blockInd = this.getOrientedCoordinates(coords, resSquare);
            for (let iCoord = 0; iCoord < 3; iCoord++)
                blockInd[iCoord] += (this.blocksPerSide - 1) / 2;

            return [[blockInd[0], blockInd[1]], resSquare];
        }
    }

    getBlockIdFromInd(ind: number[], square: number[]) {
        const squareId = square[0] * 2 + square[1];
        return (squareId * this.blocksPerSide + ind[0]) * this.blocksPerSide + ind[1];
    }

    getUnorientedCoordinates(coords: number[], square: number[]) {
        const res: number[] = [];
        const i = square[0];
        const j = square[1];
        for (let k = 0; k < 3; k++)
            res[k] = this.coordSigns[k][i][j] * coords[this.coordInds[k][i][j]];
        return res;
    }

    getOrientedCoordinates(coords: number[], square: number[]) {
        const res: number[] = [];
        const i = square[0];
        const j = square[1];
        for (let k = 0; k < 3; k++)
            res[this.coordInds[k][i][j]] = this.coordSigns[k][i][j] * coords[k];
        return res;
    }
}

// helper class grouping information needed when visiting a planet's terrain
// and the recursive methods to do so
class TerrainVisitor {
    planet: Planet;

    // maximum distance, in UV units, at which blocks at 0-depth are loaded
    // The distance at which blocks at maximum depth are loaded is 0
    // and the distance at other depths is determined linearly from these rules
    loadDist = 0.1;

    // in UV coordinates
    // Blocks are unloaded unloadOffset further away than the distance at which
    // they're loaded, regardless of the depth
    unloadOffset = 0.05;

    depthMax = 4;

    uv = null; // UV coordinates of the player on the square
    square = null; // square where the player is located

    constructor(planet: Planet) {
        this.planet = planet;
    }

    // recursively delete block and all its branches, also removing any representation
    // from the view
    deleteBlockNode(parentNode: Node | null, ind: number, path: string) {
        const blockList = parentNode ? parentNode.subBlocks : Scene.planet!.blocks;
        const node = blockList[ind];
        for (let i in node.subBlocks)
            this.deleteBlockNode(node, Number(i), path + String(i));
        node.subBlocks = [];
        View.remove(node);
        Scene.setChild(parentNode, ind, null);
    }

    // recursively visit block to load/unload the sub-blocks that need to be
    visitBlockNode(
        node: Node,
        depth: number,
        path: string,
        blockInd: number[],
        square: number[],
        sqrUvBounds: number[]) {
        // compute distance
        const d = this.planet.uvToBoundsDistance(this.uv!, this.square!, sqrUvBounds, square);
        // add 1 to depthMax because weightedDist must not be 0
        const weightedDist = this.loadDist * (1 - depth / (1 + this.depthMax));

        if (node.subBlocks.length) {
            // block has children

            if (!View.hasMesh(node)) {
                console.error('Block has children but no mesh');
                return;
            }

            // decide if sub-blocks should be deleted
            if (d > weightedDist + this.unloadOffset) {

                // node is too far - delete its children if possible
                let anyNodeInScene = false;
                let mayUnrefine = true;
                let i: number;
                // @ts-ignore I know the keys are only numbers
                for (i in node.subBlocks) {
                    const subBlock = node.subBlocks[i];
                    anyNodeInScene ||= View.isShown(subBlock);
                    let iNei: number;
                    // @ts-ignore I know the keys are numbers
                    for (iNei in subBlock.neighbors) {
                        if (subBlock.neighbors[iNei].length == 2) {
                            mayUnrefine = false;
                            break;
                        }
                    }
                    if (!mayUnrefine) break;
                }

                if (anyNodeInScene && mayUnrefine) {
                    // merge neighbors from its children
                    // and connect the obtained neighbors

                    // first reset parent node neighbors
                    let i: number;
                    for (i = 0; i < 4; i++) Scene.setNeighbors(node, i, []);

                    // @ts-ignore I know the keys are only numbers
                    for (i in node.subBlocks) {
                        const x = i % 2;
                        const y = (i - x) / 2;
                        const childXNeighbors = node.subBlocks[i].neighbors[x];
                        // since mayUnrefine is true, all sub-blocks have at most
                        // 1 neighbor on each side
                        if (childXNeighbors.length) {
                            const xNeighbors = node.neighbors[x];
                            // We may already have added 1 neighbor to the parent node.
                            // Check it doesn't already have the neighbor we're about
                            // to add
                            if (!xNeighbors.length ||
                                xNeighbors[0] !== childXNeighbors[0]) {
                                Scene.addNeighbor(node, x, childXNeighbors[0]);
                                Scene.setNeighbors(childXNeighbors[0], 1 - x, [node]);
                                // if we've added 2 neighbors on the same side,
                                // those neighbors must have coarser sides
                                if (xNeighbors.length == 2) {
                                    xNeighbors[0].faceBufferInd[0] = 2 * (1 - x);
                                    View.updateBlockFaceBuffer(xNeighbors[0]);
                                    xNeighbors[1].faceBufferInd[0] = 2 * (1 - x);
                                    View.updateBlockFaceBuffer(xNeighbors[1]);
                                }
                            }
                        }
                        const childYNeighbors = node.subBlocks[i].neighbors[2 + y];
                        if (childYNeighbors.length) {
                            const yNeighbors = node.neighbors[2 + y];
                            if (!yNeighbors.length ||
                                yNeighbors[0] !== childYNeighbors[0]) {
                                Scene.addNeighbor(node, 2 + y, childYNeighbors[0]);
                                Scene.setNeighbors(childYNeighbors[0], 3 - y, [node]);
                                if (yNeighbors.length == 2) {
                                    yNeighbors[0].faceBufferInd[1] = 2 * (1 - y);
                                    View.updateBlockFaceBuffer(yNeighbors[0]);
                                    yNeighbors[1].faceBufferInd[1] = 2 * (1 - y);
                                    View.updateBlockFaceBuffer(yNeighbors[1]);
                                }
                            }
                        }
                    }

                    // delete children
                    // @ts-ignore I know the keys are numbers
                    for (i in node.subBlocks)
                        this.deleteBlockNode(node, i, path + String(i));

                    node.subBlocks = [];

                    // show parent block
                    View.addBlock(node);
                    node.name = path;
                }

            } else if (node.subBlocks.length == 4) {
                // block is not too far and has all its children

                const nodeInScene = View.isShown(node);
                const facesAreFine =
                    node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
                const mayRefine = nodeInScene && facesAreFine;

                // if we're going to show the children node, hide the parent
                if (mayRefine)
                    View.hide(node);

                // visit children nodes
                // don't visit sub-blocks until all four are available
                for (let i = 0; i < 4; i++) {
                    // if node block was shown in scene (and now hidden),
                    // connect the 4 sub-blocks' neighbors and show them
                    if (mayRefine) {
                        // connect internal neighbors
                        const x = i % 2;
                        const y = (i - x) / 2;
                        Scene.setNeighbors(node.subBlocks[i], 1 - x,
                            [node.subBlocks[2 * y + (1 - x)]]);
                        Scene.setNeighbors(node.subBlocks[i], 3 - y,
                            [node.subBlocks[2 * (1 - y) + x]]);

                        // connect external neighbors
                        const xNeighbors = node.neighbors[x];
                        switch (xNeighbors.length) {
                            case 1:
                                Scene.setNeighbors(node.subBlocks[i], x, [xNeighbors[0]]);
                                node.subBlocks[i].faceBufferInd[0] = 2 * x;
                                if (y == 0)
                                    Scene.setNeighbors(xNeighbors[0], 1 - x, [
                                        node.subBlocks[x],
                                        node.subBlocks[2 + x]]);
                                break;
                            case 2:
                                Scene.setNeighbors(node.subBlocks[i], x, [xNeighbors[y]]);
                                Scene.setNeighbors(xNeighbors[y], 1 - x, [node.subBlocks[i]]);
                                xNeighbors[y].faceBufferInd[0] = 1;
                                View.updateBlockFaceBuffer(xNeighbors[y]);
                                break;
                        }
                        const yNeighbors = node.neighbors[2 + y];
                        switch (yNeighbors.length) {
                            case 1:
                                Scene.setNeighbors(node.subBlocks[i], 2 + y, [yNeighbors[0]]);
                                node.subBlocks[i].faceBufferInd[1] = 2 * y;
                                if (x == 0)
                                    Scene.setNeighbors(yNeighbors[0], 3 - y, [
                                        node.subBlocks[2 * y],
                                        node.subBlocks[2 * y + 1]]);
                                break;
                            case 2:
                                Scene.setNeighbors(node.subBlocks[i], 2 + y, [yNeighbors[x]]);
                                Scene.setNeighbors(yNeighbors[x], 3 - y, [node.subBlocks[i]]);
                                yNeighbors[x].faceBufferInd[1] = 1;
                                View.updateBlockFaceBuffer(yNeighbors[x]);
                                break;
                        }

                        if (node.subBlocks[i].faceBufferInd[0] != 1 ||
                            node.subBlocks[i].faceBufferInd[1] != 1)
                            View.updateBlockFaceBuffer(node.subBlocks[i]);

                        View.addBlock(node.subBlocks[i]);
                        node.subBlocks[i].name = path + String(i);
                    }

                    // split sqrUvBounds into 4 quarters based on i
                    const childSqrUvBounds: number[] = Geom.getBoundsQuarter(sqrUvBounds, i);
                    this.visitBlockNode(
                        node.subBlocks[i],
                        depth + 1,
                        path + String(i),
                        blockInd,
                        square,
                        childSqrUvBounds);
                }
            }
        } else if (d <= weightedDist) {
            const facesAreFine =
                node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
            let surrounded = true; // surrounded by neighbors on all sides
            for (let iNei = 0; iNei < 4; iNei++)
                surrounded &&= !!node.neighbors[iNei].length;
            if (facesAreFine && surrounded)
                // block has no child and is near enough
                // refine it by spawning 4 children
                for (let i = 0; i < 4; i++) {
                    // schedule block creation after render
                    this.planet.createBlockLater(
                        node,
                        i,
                        square,
                        Geom.getBoundsQuarter(sqrUvBounds, i),
                        path + String(i));
                }
        }
    }
}

export class Character {
    // characteristics
    speed = .007;
    angularSpeed = .002;
    jumpSpeed = .02;
    eyeAltitude = 1;
    size = {
        "width": .4,
        "height": 1
    };

    // state
    bearing: number;
    sphericalPosition: SphericalPosition;
    altitude: number;
    groundAltitude: number;
    velocity = [0, 0];
    currentActions = {};
    balloonText = '';

    // view
    model: THREE.Mesh;
    balloonModel: THREE.Mesh;

    constructor(data: CharacterData) {
        this.bearing = data.bearing;
        this.sphericalPosition = data.sphericalPosition;
        this.altitude = data.altitude;
        this.groundAltitude = this.altitude;

        this.model = View.addCharacter(this.size.width, this.size.height);
    }

    updateBalloon(text: string) {
        if (text != this.balloonText) {
            this.balloonText = text;
            if (text) {
                View.makeBalloon(text, this);
            } else {
                if (this.balloonModel)
                    this.model.remove(this.balloonModel);
                this.balloonModel = null;
            }
        }
    }
}

export const Scene = {
    planet: null as Planet | null,
    objects: null as Character[],
    player: null as Character,

    init() {
        Scene.planet = new Planet; // will in turn call makeWorld asynchronously
    },

    createCharacter(characterId: string, characterData: CharacterData) {
        Scene.objects[characterId] = new Character(characterData);
    },

    removeCharacter(characterId: number) {
        const character = Scene.objects[characterId];
        View.removeModel(character.model);
        delete Scene.objects[characterId];
    },

    makeWorld() {
        Scene.objects = [];
        for (let i in Connection.characters)
            Scene.createCharacter(i, Connection.characters[i]);
        Connection.characters = null; // We won't need it anymore.

        Scene.player = Scene.objects[Connection.clientId];

        // calling getSquareUvFromSphericalPosition because the square uvs have not been
        // computed client-side
        const sphericalPosition = Scene.player.sphericalPosition;
        const squareUv = Game.getSquareUvFromSphericalPosition(
            sphericalPosition.theta, sphericalPosition.phi, Scene.planet);
        Scene.planet!.updateTerrain(squareUv.uv, squareUv.square);
        if (View.onPlayerSetup)
            View.onPlayerSetup(Scene.player);
        Game.init();
    },

    setChild(node: Node, ind: string | number, child: Node) {
        const blockList = node ? node.subBlocks : this.planet.blocks;
        if (View['removeChild'])
            View['removeChild'](node, blockList[ind]);
        if (child) blockList[ind] = child;
        else delete blockList[ind];
        if (View['addChild'])
            View['addChild'](node, child);
    },

    createBlock(data: BlockData) {
        const blockList = data.parentNode ? data.parentNode.subBlocks : data.planet.blocks;

        // check block list still exists
        if (!blockList) {
            console.error('Creating block in non-existent list');
            return;
        }
        // check block doesn't already exist
        if (blockList[data.id])
            return;

        // create block
        const child = {
            subBlocks: [],
            faceBufferInd: [1, 1],
            neighbors: [[], [], [], []],
            name: data.name
        };
        View.makeBlock(child, data.square, data.sqrUvBounds, data.planet, data.name);
        Scene.setChild(data.parentNode, data.id, child);
        const curBlock = blockList[data.id];

        // if block is not top-level, there is nothing else to do
        if (data.parentNode)
            return;

        if (curBlock.name != data.id + '/') {
            console.error('Block', curBlock.name, ' != ', data.id + '/');
            return;
        }

        // show this top-level block right away and connect neighbors
        // iNei represents -x, +x, -y, +y
        View.addBlock(curBlock);
        for (let iNei = 0; iNei < 4; iNei++) {
            let dir = iNei % 2;
            let dim = (iNei - dir) / 2;
            const bps = data.planet.blocksPerSide
            const j = data.id % bps;
            let tmp = (data.id - j) / bps;
            const i = tmp % bps;
            tmp = (tmp - i) / bps;
            const jSquare = tmp % 2;
            const iSquare = (tmp - jSquare) / 2;
            let t = [0, 0];
            t[dim] = 2 * dir - 1;
            const indSqr = data.planet.blockAdd([i, j], [iSquare, jSquare], t);
            if (indSqr == null)
                continue;

            // express translation vector in new square space
            if (iSquare != indSqr[1][0] || jSquare != indSqr[1][1]) {
                // we moved to another square, so the translation vector is
                // flipped over an edge of the cube
                t = [0, 0, -Math.abs(t[0]) - Math.abs(t[1])];

                const tWorld =
                    data.planet.getUnorientedCoordinates(t, [iSquare, jSquare]);
                t = data.planet.getOrientedCoordinates(tWorld, indSqr[1]);
                delete t[2];
            }

            const id = data.planet.getBlockIdFromInd(indSqr[0], indSqr[1]);
            const neighbor = data.planet.blocks[id];
            if (!neighbor)
                continue; // no neighbor here

            dim = Number(!t[0]);
            dir = Number(t[dim] < 0); // reverse direction for neighbor
            const iNeiRev = 2 * dim + dir; // reverse neighbor index

            // set this node's neighbors and
            // set it as neighbor of its neighbors
            Scene.setNeighbors(curBlock, iNei, [neighbor]); // by default
            Scene.setNeighbors(neighbor, iNeiRev, [curBlock]);
            if (neighbor.subBlocks.length == 4) {
                // magic formulas that give the indices of the two
                // facing neighbor sub-blocks in the given direction
                const idA = (1 + dim) * dir;
                const idB = idA + 2 - dim;
                const nodeInScene = View.isShown(neighbor);
                // only if parent neighbor is not shown,
                // set its children as neighbors
                if (!nodeInScene)
                    Scene.setNeighbors(curBlock, iNei, [
                        neighbor.subBlocks[idA],
                        neighbor.subBlocks[idB]]);
                Scene.setNeighbors(neighbor.subBlocks[idA], iNeiRev, [curBlock]);
                Scene.setNeighbors(neighbor.subBlocks[idB], iNeiRev, [curBlock]);
            } else if (neighbor.subBlocks.length)
                console.error('A block has sub-blocks but not 4.');
        }
    },

    setNeighbors(node: Node, ind: number, neighbors: Node[]) {
        if (!node) {
            console.error('Setting neighbors of an undefined node');
            return;
        }
        if (View['removeNeighbors'])
            View['removeNeighbors'](node, node.neighbors[ind]);
        node.neighbors[ind] = neighbors;
        if (View['addNeighbors'])
            View['addNeighbors'](node, neighbors);
    },

    addNeighbor(node: Node, ind: string | number, neighbor: Node) {
        if (!node) {
            console.error('Adding neighbors to an undefined node');
            return;
        }
        node.neighbors[ind].push(neighbor);
        if (View['addNeighbors'])
            View['addNeighbors'](node, [neighbor]);
    }
}