import * as THREE from "three";
import { View } from './View.js';
import { Game } from './Game.js';
import { Connection } from './Connection.js';
import { Geom } from './Geom.js';

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
    blocks: { [x: number]: any; } = {};
    terrainVisitor: TerrainVisitor = new TerrainVisitor(this);
    material: THREE.MeshBasicMaterial;
    altitudeMap: any = {};

    constructor() {
        // altitude
        var planet = this;
        var img = new Image;
        img.onload = function () {
            planet.setAltitudeMap(this);
            Scene.makeWorld(); // populate scene with objects and update terrain
        };
        img.src = 'img/altitude.png';

        // view: material
        var diffuseTexture = new THREE.TextureLoader().load("img/map.png");
        this.material = new THREE.MeshBasicMaterial({ map: diffuseTexture });
    }

    setAltitudeMap(img) {
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        this.altitudeMap.width = img.width;
        this.altitudeMap.height = img.height;

        // copy only red channel of img into altitudeMap
        var imgData = ctx.getImageData(0, 0, img.width, img.height).data;
        this.altitudeMap.data = [];
        for (var i = 0; i < imgData.length / 4; i++) {
            this.altitudeMap.data[i] = imgData[4 * i];
        }
    }

    updateTerrain(uv: any, square: any) {
        var blockInd = Game.getBlockIndFromUv(uv, this);

        // unload far away blocks
        let id: number;
        // @ts-ignore I know my key is a number
        for (id in this.blocks) {
            var j = id % this.blocksPerSide;
            var tmp = (id - j) / this.blocksPerSide;
            var i = tmp % this.blocksPerSide;
            tmp = (tmp - i) / this.blocksPerSide;
            var jSquare = tmp % 2;
            var iSquare = (tmp - jSquare) / 2;
            var d = this.blockDistance(blockInd, square, [i, j], [iSquare, jSquare]);
            if (d > this.blockUnloadDistance)
                this.terrainVisitor.deleteBlockNode(null, id, id + '/');
        }

        // load all blocks within a radius of blockLoadDistance
        for (var i = -this.blockLoadDistance; i <= this.blockLoadDistance; i++) {
            for (var j = -this.blockLoadDistance; j <= this.blockLoadDistance; j++) {
                var indSquare = this.blockAdd(blockInd, square, [i, j]);
                if (indSquare == null)
                    continue;
                var ind = indSquare[0];
                var sqr = indSquare[1];
                id = this.getBlockIdFromInd(ind, sqr);
                if (this.blocks[id] != undefined)
                    continue; // block already exists

                // schedule block creation after render
                var sqrUvBounds = [
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
            var node = this.blocks[id];
            var j = id % this.blocksPerSide;
            var tmp = (id - j) / this.blocksPerSide;
            var i = tmp % this.blocksPerSide;
            tmp = (tmp - i) / this.blocksPerSide;
            var jSquare = tmp % 2;
            var iSquare = (tmp - jSquare) / 2;
            var sqrUvBounds = [
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
        parentNode: null, id: number, square: any, sqrUvBounds: number[], name: string) {
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
        uv: number[], square0: any[], sqrUvBounds: number[], square1: any[]) {
        if (square0[0] == square1[0] && square0[1] == square1[1]) {
            return Geom.pointToBoundsDistance(uv, sqrUvBounds);
        } else {
            var coords: number[] = [];
            coords[0] = uv[0] - 0.5;
            coords[1] = uv[1] - 0.5;
            coords[2] = 0.5;
            var posOnCube = this.getUnorientedCoordinates(coords, square0);
            coords[0] = sqrUvBounds[0] - 0.5;
            coords[1] = sqrUvBounds[1] - 0.5;
            var minOnCube = this.getUnorientedCoordinates(coords, square1);
            coords[0] = sqrUvBounds[2] - 0.5;
            coords[1] = sqrUvBounds[3] - 0.5;
            var maxOnCube = this.getUnorientedCoordinates(coords, square1);
            return Geom.pointToBoundsDistance(posOnCube, minOnCube.concat(maxOnCube));
        }
    }

    // returns the distance in terms of blocks between two blocks
    blockDistance(ind0: number[], square0: any[], ind1: number[], square1: any[]) {
        if (square0[0] == square1[0] && square0[1] == square1[1])
            return Geom.dist(ind0, ind1, 0);
        else {
            var coords: number[] = [];
            coords[0] = ind0[0] - this.blocksPerSide / 2 + 0.5;
            coords[1] = ind0[1] - this.blocksPerSide / 2 + 0.5;
            coords[2] = this.blocksPerSide / 2;
            var a = this.getUnorientedCoordinates(coords, square0);
            coords[0] = ind1[0] - this.blocksPerSide / 2 + 0.5;
            coords[1] = ind1[1] - this.blocksPerSide / 2 + 0.5;
            var b = this.getUnorientedCoordinates(coords, square1);
            return Geom.dist(a, b, 0);
        }
    }

    // Return the index and square of the block at the postion of the block at index ind
    // in the given square, translated by t
    // t is a translation vector in terms of block indices
    // coordinates in t must be less than blocksPerSide
    blockAdd(ind: any[], square: any, t: any[]) {
        var i = ind[0] + t[0];
        var j = ind[1] + t[1];
        var coordsOutBounds = 0;
        var sideInd: any[] = []; // index of the result on a side square
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
            var coords = this.getUnorientedCoordinates(sideInd, square);

            // find square
            // find biggest coordinate
            var wInd = 0;
            var w = 0;
            for (var dim = 0; dim < 3; dim++) {
                if (Math.abs(coords[dim]) > Math.abs(w)) {
                    w = coords[dim];
                    wInd = dim;
                }
            }
            var resSquare = this.squareInds[wInd][Number(w >= 0)];

            // convert coords into resSquare coordinate system
            var blockInd = this.getOrientedCoordinates(coords, resSquare);
            for (let iCoord = 0; iCoord < 3; iCoord++)
                blockInd[iCoord] += (this.blocksPerSide - 1) / 2;

            return [[blockInd[0], blockInd[1]], resSquare];
        }
    }

    getBlockIdFromInd(ind: number[], square: number[]) {
        var squareId = square[0] * 2 + square[1];
        return (squareId * this.blocksPerSide + ind[0]) * this.blocksPerSide + ind[1];
    }

    getUnorientedCoordinates(coords: number[], square: any[]) {
        var res: number[] = [];
        var i = square[0];
        var j = square[1];
        for (var k = 0; k < 3; k++)
            res[k] = this.coordSigns[k][i][j] * coords[this.coordInds[k][i][j]];
        return res;
    }

    getOrientedCoordinates(coords: number[], square: any[]) {
        var res: number[] = [];
        var i = square[0];
        var j = square[1];
        for (var k = 0; k < 3; k++)
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

    constructor(planet: any) {
        this.planet = planet;
    }

    // recursively delete block and all its branches, also removing any representation
    // from the view
    deleteBlockNode(parentNode: { subBlocks: any; } | null, ind: number, path: string) {
        var blockList = parentNode ? parentNode.subBlocks : Scene.planet!.blocks;
        var node = blockList[ind];
        View.remove(node.mesh);
        for (var i in node.subBlocks)
            this.deleteBlockNode(node, Number(i), path + String(i));
        node.subBlocks = [];
        Scene.setChild(parentNode, ind, null);
    }

    // recursively visit block to load/unload the sub-blocks that need to be
    visitBlockNode(node, depth: number, path: string, blockInd: any, square: any, sqrUvBounds: number[]) {
        // compute distance
        var d = this.planet.uvToBoundsDistance(this.uv!, this.square!, sqrUvBounds, square);
        // add 1 to depthMax because weightedDist must not be 0
        var weightedDist = this.loadDist * (1 - depth / (1 + this.depthMax));

        if (node.subBlocks.length) {
            // block has children

            if (!node.mesh) {
                console.error('Block has children but no mesh');
                return;
            }

            // decide if sub-blocks should be deleted
            if (d > weightedDist + this.unloadOffset) {

                // node is too far - delete its children if possible
                var anyNodeInScene = false;
                var mayUnrefine = true;
                let i: number;
                // @ts-ignore I know the keys are only numbers
                for (i in node.subBlocks) {
                    var subBlock = node.subBlocks[i];
                    anyNodeInScene ||= View.isShown(subBlock.mesh);
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
                        var x = i % 2;
                        var y = (i - x) / 2;
                        var childXNeighbors = node.subBlocks[i].neighbors[x];
                        // since mayUnrefine is true, all sub-blocks have at most
                        // 1 neighbor on each side
                        if (childXNeighbors.length) {
                            var xNeighbors = node.neighbors[x];
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
                        var childYNeighbors = node.subBlocks[i].neighbors[2 + y];
                        if (childYNeighbors.length) {
                            var yNeighbors = node.neighbors[2 + y];
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

                var nodeInScene = View.isShown(node.mesh);
                var facesAreFine =
                    node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
                var mayRefine = nodeInScene && facesAreFine;

                // if we're going to show the children node, hide the parent
                if (mayRefine)
                    View.remove(node.mesh);

                // visit children nodes
                // don't visit sub-blocks until all four are available
                for ( i = 0; i < 4; i++) {
                    // if node block was shown in scene (and now hidden),
                    // connect the 4 sub-blocks' neighbors and show them
                    if (mayRefine) {
                        // connect internal neighbors
                        var x = i % 2;
                        var y = (i - x) / 2;
                        Scene.setNeighbors(node.subBlocks[i], 1 - x,
                            [node.subBlocks[2 * y + (1 - x)]]);
                        Scene.setNeighbors(node.subBlocks[i], 3 - y,
                            [node.subBlocks[2 * (1 - y) + x]]);

                        // connect external neighbors
                        var xNeighbors = node.neighbors[x];
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
                        var yNeighbors = node.neighbors[2 + y];
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
                    var childSqrUvBounds: number[] = Geom.getBoundsQuarter(sqrUvBounds, i);
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
            var facesAreFine =
                node.faceBufferInd[0] == 1 && node.faceBufferInd[1] == 1;
            var surrounded = true; // surrounded by neighbors on all sides
            for (let iNei = 0; iNei < 4; iNei++)
                surrounded &&= !!node.neighbors[iNei].length;
            if (facesAreFine && surrounded)
                // block has no child and is near enough
                // refine it by spawning 4 children
                for (var i = 0; i < 4; i++) {
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

class Character {
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
    bearing: any;
    sphericalPosition: any;
    altitude: any;
    groundAltitude: any;
    velocity = [0, 0];
    currentActions = {};
    balloonText = '';

    // view
    model: THREE.Mesh;
    balloonModel;

    constructor(data: { bearing: any; sphericalPosition: any; altitude: any; }) {
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
    objects: null as any,
    player: null as any,

    init() {
        Scene.planet = new Planet; // will in turn call makeWorld asynchronously
    },

    createCharacter(characterId: string, characterData: any) {
        Scene.objects[characterId] = new Character(characterData);
    },

    removeCharacter(characterId: string | number) {
        var character = Scene.objects[characterId];
        View.remove(character.model);
        delete Scene.objects[characterId];
    },

    makeWorld() {
        Scene.objects = [];
        for (var i in Connection.characters)
            Scene.createCharacter(i, Connection.characters[i]);
        Connection.characters = null; // We won't need it anymore.

        Scene.player = Scene.objects[Connection.clientId];

        // calling getSquareUvFromSphericalPosition because the square uvs have not been
        // computed client-side
        var sphericalPosition = Scene.player.sphericalPosition;
        var squareUv = Game.getSquareUvFromSphericalPosition(
            sphericalPosition.theta, sphericalPosition.phi, Scene.planet);
        Scene.planet!.updateTerrain(squareUv.uv, squareUv.square);
        if (View.onPlayerSetup)
            View.onPlayerSetup(Scene.player);
        Game.init();
    },

    setChild(node: { subBlocks: any; } | null, ind: string | number, child: any) {
        var blockList = node ? node.subBlocks : this.planet.blocks;
        if (View['removeChild'])
            View['removeChild'](node, blockList[ind]);
        if (child) blockList[ind] = child;
        else delete blockList[ind];
        if (View['addChild'])
            View['addChild'](node, child);
    },

    createBlock(data) {
        var blockList = data.parentNode ? data.parentNode.subBlocks : data.planet.blocks;

        // check block list still exists
        if (!blockList) {
            console.error('Creating block in non-existent list');
            return;
        }
        // check block doesn't already exist
        if (blockList[data.id])
            return;

        // create block
        Scene.setChild(
            data.parentNode,
            data.id,
            {
                mesh: View.makeBlock(
                    data.square, data.sqrUvBounds, data.planet, data.name),
                subBlocks: [],
                faceBufferInd: [1, 1],
                neighbors: [[], [], [], []],
                name: data.name
            });
        var curBlock = blockList[data.id];

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
        for (var iNei = 0; iNei < 4; iNei++) {
            var dir = iNei % 2;
            var dim = (iNei - dir) / 2;
            var bps = data.planet.blocksPerSide
            var j = data.id % bps;
            var tmp = (data.id - j) / bps;
            var i = tmp % bps;
            tmp = (tmp - i) / bps;
            var jSquare = tmp % 2;
            var iSquare = (tmp - jSquare) / 2;
            var t = [0, 0];
            t[dim] = 2 * dir - 1;
            var indSqr = data.planet.blockAdd([i, j], [iSquare, jSquare], t);
            if (indSqr == null)
                continue;

            // express translation vector in new square space
            if (iSquare != indSqr[1][0] || jSquare != indSqr[1][1]) {
                // we moved to another square, so the translation vector is
                // flipped over an edge of the cube
                t = [0, 0, -Math.abs(t[0]) - Math.abs(t[1])];

                var tWorld =
                    data.planet.getUnorientedCoordinates(t, [iSquare, jSquare]);
                t = data.planet.getOrientedCoordinates(tWorld, indSqr[1]);
                delete t[2];
            }

            var id = data.planet.getBlockIdFromInd(indSqr[0], indSqr[1]);
            var neighbor = data.planet.blocks[id];
            if (!neighbor)
                continue; // no neighbor here

            dim = Number(!t[0]);
            dir = Number(t[dim] < 0); // reverse direction for neighbor
            var iNeiRev = 2 * dim + dir; // reverse neighbor index

            // set this node's neighbors and
            // set it as neighbor of its neighbors
            Scene.setNeighbors(curBlock, iNei, [neighbor]); // by default
            Scene.setNeighbors(neighbor, iNeiRev, [curBlock]);
            if (neighbor.subBlocks.length == 4) {
                // magic formulas that give the indices of the two
                // facing neighbor sub-blocks in the given direction
                var idA = (1 + dim) * dir;
                var idB = idA + 2 - dim;
                var nodeInScene = View.isShown(neighbor.mesh);
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

    setNeighbors(node: { neighbors: { [x: string]: any; }; }, ind: string | number, neighbors: any) {
        if (View['removeNeighbors'])
            View['removeNeighbors'](node, node.neighbors[ind]);
        node.neighbors[ind] = neighbors;
        if (View['addNeighbors'])
            View['addNeighbors'](node, neighbors);
    },

    addNeighbor(node: { neighbors: { [x: string]: any[]; }; }, ind: string | number, neighbor: any) {
        node.neighbors[ind].push(neighbor);
        if (View['addNeighbors'])
            View['addNeighbors'](node, [neighbor]);
    }
}