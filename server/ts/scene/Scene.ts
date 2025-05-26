import { Character } from './Character.js';
import { Planet } from './Planet.js';

export const Scene = {
    planet: null as Planet | null,
    characters: null as {[clientId: string]: Character},
    init() {
        Scene.planet = new Planet;
        Scene.characters = {};
    }
}