// инвентарь и характеристики команд режима "Постапокалипсис"

export const ZOMBIE_HP_BASE = 100;
export const ZOMBIE_HP_BUFFED = 250; // базовое HP + 150
export const ZOMBIE_BUFF_THRESHOLD = 3;

// Red / Blue: полный арсенал, но без блоков (блоки в этом режиме не разрушаются и не строятся)
export function set_human_inventory(team) {
    const inv = team.Inventory;
    inv.Main.Value = true;
    inv.Secondary.Value = true;
    inv.Melee.Value = true;
    inv.Explosive.Value = true;
    inv.Build.Value = false;
}

// Zombies: только нож и граната
export function set_zombie_inventory(team) {
    const inv = team.Inventory;
    inv.Main.Value = false;
    inv.Secondary.Value = false;
    inv.Melee.Value = true;
    inv.Explosive.Value = true;
    inv.Build.Value = false;
}

export function apply_human_hp(team) {
    team.ContextedProperties.MaxHp.Value = 100;
}

// применяет/снимает баф HP зомби в зависимости от их количества
export function update_zombie_hp_buff(zombiesTeam) {
    const count = zombiesTeam.Players ? zombiesTeam.Players.length : 0;
    const buffed = count >= ZOMBIE_BUFF_THRESHOLD;
    zombiesTeam.ContextedProperties.MaxHp.Value = buffed ? ZOMBIE_HP_BUFFED : ZOMBIE_HP_BASE;
    return buffed;
}
