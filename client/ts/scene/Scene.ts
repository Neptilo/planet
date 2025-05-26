import { View } from '../View.js';
import { Game } from '../Game.js';
import { Network } from '../Network.js';
import { SphericalPosition } from '../Geom.js';
import { Planet } from './Planet.js';
import { Character } from './Character.js';

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
        for (let i in Network.characters)
            Scene.createCharacter(i, Network.characters[i]);
        Network.characters = null; // We won't need it anymore.

        Scene.player = Scene.objects[Network.clientId];

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
        View.makeBlock(data.square, data.sqrUvBounds, data.planet, data.name);
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