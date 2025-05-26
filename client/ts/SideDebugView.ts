import { View } from './View.js';
import { DebugView } from './DebugView.js';
import { Node, Planet } from './Scene.js'

export const UserView = { ...View };

View.init = function () {
    const userView = document.createElement('div');
    const debugView = document.createElement('div');
    userView.style.height = '100%';
    userView.style.flex = '50%';
    debugView.style.height = '100%';
    debugView.style.flex = '50%';
    document.body.appendChild(userView);
    document.body.appendChild(debugView);
    document.body.style.display = 'flex';
    UserView.init(userView);
    DebugView.init(debugView);
}

View.makeBlock = function (
    node: Node,
    square: number[],
    sqrUvBounds: number[],
    planet: Planet,
    name: string
) {
    UserView.makeBlock(node, square, sqrUvBounds, planet, name);
    DebugView.makeBlock(node, square, sqrUvBounds, planet, name);
}

View.addBlock = function (block) {
    UserView.addBlock(block);
    DebugView.addBlock(block);
}

View.updateBlockFaceBuffer = function (block) {
    UserView.updateBlockFaceBuffer(block);
}

View['addNeighbors'] = function (node: Node, neighbors: Node[]) {
    const debugNeighbors: Node[] = [];
    for (let iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(neighbors[iNei]);
    DebugView.addNeighbors(node, debugNeighbors);
}

View['removeNeighbors'] = function (node: Node, neighbors: Node[]) {
    const debugNeighbors: Node[] = [];
    for (let iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(neighbors[iNei]);
    DebugView.removeNeighbors(node, debugNeighbors);
}

View['addChild'] = function (node: Node, child: Node) {
    DebugView.addChild(node, child);
}

View['removeChild'] = function (node: Node, child: Node) {
    DebugView.removeChild(node, child);
}

View.hide = function (node: Node) {
    UserView.hide(node);
    DebugView.hide(node);
}

View.remove = function (node: Node) {
    UserView.remove(node);
    DebugView.remove(node);
}

View.isShown = function (node: Node) {
    return UserView.isShown(node);
}

View.update = function () {
    UserView.update();
    DebugView.update();
}
