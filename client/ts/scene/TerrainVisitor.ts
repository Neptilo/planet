import { Planet } from './Planet.js';
import { Scene, Node } from './Scene.js';
import { View } from '../View.js';
import { Geom } from '../Geom.js';

// helper class grouping information needed when visiting a planet's terrain
// and the recursive methods to do so
export class TerrainVisitor {
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
