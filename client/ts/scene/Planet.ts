import { TerrainVisitor } from './TerrainVisitor.js';
import { Scene, Node } from './Scene.js';
import { Game } from '../Game.js';
import { Geom } from '../Geom.js';
import * as THREE from "three";

type Table = { width?: number; height?: number; data?: number[]; };

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