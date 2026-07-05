// три команды режима "Постапокалипсис"
import { Color } from 'pixel_combats/basic';
import { Teams } from 'pixel_combats/room';

export const RED_NAME = "Red";
export const BLUE_NAME = "Blue";
export const ZOMBIES_NAME = "Zombies";

export const RED_DISPLAY = "Teams/Red";
export const BLUE_DISPLAY = "Teams/Blue";
export const ZOMBIES_DISPLAY = "Teams/Zombies";

// группы точек спавна: 1 и 2 — стандартные (как в TDM), 3 — выделенная зона зомби, если есть на карте
export const BLUE_SPAWN_GROUP = 1;
export const RED_SPAWN_GROUP = 2;
export const ZOMBIES_SPAWN_GROUP = 3;

export function create_red() {
    Teams.Add(RED_NAME, RED_DISPLAY, new Color(1, 0, 0, 0));
    const team = Teams.Get(RED_NAME);
    team.Spawns.SpawnPointsGroups.Add(RED_SPAWN_GROUP);
    return team;
}

export function create_blue() {
    Teams.Add(BLUE_NAME, BLUE_DISPLAY, new Color(0, 0, 1, 0));
    const team = Teams.Get(BLUE_NAME);
    team.Spawns.SpawnPointsGroups.Add(BLUE_SPAWN_GROUP);
    return team;
}

export function create_zombies() {
    Teams.Add(ZOMBIES_NAME, ZOMBIES_DISPLAY, new Color(0.15, 0.7, 0.15, 0));
    const team = Teams.Get(ZOMBIES_NAME);
    // отдельная зона зомби + фолбэк на общие зоны, если карта не поддерживает группу 3
    team.Spawns.SpawnPointsGroups.Add(ZOMBIES_SPAWN_GROUP);
    team.Spawns.SpawnPointsGroups.Add(RED_SPAWN_GROUP);
    team.Spawns.SpawnPointsGroups.Add(BLUE_SPAWN_GROUP);
    return team;
}
