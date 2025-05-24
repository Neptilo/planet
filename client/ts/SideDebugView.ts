import { View } from './View.js';
import { DebugView } from './DebugView.js';

export const UserView = {...View};

View.init = function() {
    var userView = document.createElement('div');
    var debugView = document.createElement('div');
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

View.makeBlock = function(square, sqrUvBounds, planet, name): THREE.Mesh[] | THREE.Mesh {
    return [
        UserView.makeBlock(square, sqrUvBounds, planet, name) as THREE.Mesh,
        DebugView.makeBlock(square, sqrUvBounds, planet, name)];
}

View.addBlock = function(block) {
    UserView.addBlock(View['getUserNode'](block));
    DebugView.addBlock(View['getDebugNode'](block));
}

View.updateBlockFaceBuffer = function(block) {
    UserView.updateBlockFaceBuffer(View['getUserNode'](block));
}

View['addNeighbors'] = function(node, neighbors) {
    var debugNeighbors: any[] = [];
    for (var iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(View['getDebugNode'](neighbors[iNei]));
    DebugView.addNeighbors(View['getDebugNode'](node), debugNeighbors);
}

View['removeNeighbors'] = function(node, neighbors) {
    var debugNeighbors: any[] = [];
    for (var iNei = 0; iNei < neighbors.length; ++iNei)
        debugNeighbors.push(View['getDebugNode'](neighbors[iNei]));
    DebugView.removeNeighbors(View['getDebugNode'](node), debugNeighbors);
}

View['addChild'] = function(node, child) {
    DebugView.addChild(View['getDebugNode'](node), View['getDebugNode'](child));
}

View['removeChild'] = function(node, child) {
    DebugView.removeChild(View['getDebugNode'](node), View['getDebugNode'](child));
}

View['getUserNode'] = function(node) {
    return node ? {
        mesh: node.mesh[0],
        faceBufferInd: node.faceBufferInd
    } : null;
}

View['getDebugNode'] = function(node) {
    return node ? {mesh: node.mesh[1]} : null;
}

View.remove = function(model) {
    if (model instanceof Array) {
        UserView.remove(model[0]);
        DebugView.remove(model[1]);
    } else {
        UserView.remove(model);
        DebugView.remove(model);
    }
}

View.isShown = function(model) {
    return UserView.isShown(model[0]);
}

View.update = function() {
    UserView.update();
    DebugView.update();
}
