import { View } from './View.js';
import { DebugView } from './DebugView.js';
import { Node } from './scene/Scene.js'
import { Planet } from "./scene/Planet.js";

export const UserView = { ...View };

View.init = () => {
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

View.makeBlock = (
    square: number[],
    sqrUvBounds: number[],
    planet: Planet,
    name: string
) => {
    UserView.makeBlock(square, sqrUvBounds, planet, name);
    DebugView.makeBlock(square, sqrUvBounds, planet, name);
}

View.addBlock = (block) => {
    UserView.addBlock(block);
    DebugView.addBlock(block);
}

View.updateBlockFaceBuffer = (block) => {
    UserView.updateBlockFaceBuffer(block);
}

View['addNeighbors'] = (node: Node, neighbors: Node[]) => {
    const debugNeighbors: Node[] = [];
    for (let iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(neighbors[iNei]);
    DebugView.addNeighbors(node, debugNeighbors);
}

View['removeNeighbors'] = (node: Node, neighbors: Node[]) => {
    const debugNeighbors: Node[] = [];
    for (let iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(neighbors[iNei]);
    DebugView.removeNeighbors(node, debugNeighbors);
}

View['addChild'] = (node: Node, child: Node) => {
    DebugView.addChild(node, child);
}

View['removeChild'] = (node: Node, child: Node) => {
    DebugView.removeChild(node, child);
}

View.hide = (node: Node) => {
    UserView.hide(node);
    DebugView.hide(node);
}

View.remove = (node: Node) => {
    UserView.remove(node);
    DebugView.remove(node);
}

View.isShown = (node: Node) => {
    return UserView.isShown(node);
}

View.update = () => {
    UserView.update();
    DebugView.update();
}
