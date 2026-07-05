// расчёт очков за убийство по категории оружия и хедшоту (аналог TDM, без модификатора длины карты)

const CATEGORY_SCORES = {
    melee: { head: 192, body: 120 },
    pistol: { head: 120, body: 96 },
    grenade: { head: 168, body: 108 },
    smg: { head: 132, body: 84 },
    shotgun: { head: 144, body: 90 },
    rifle: { head: 150, body: 96 },
    sniper: { head: 240, body: 144 },
    lmg: { head: 150, body: 96 },
};

// маппинг ID оружия -> категория
const WEAPON_CATEGORY = {
    // Pistols
    1: 'pistol', 3: 'pistol', 17: 'pistol', 27: 'pistol',
    // SMG
    9: 'smg', 15: 'smg', 16: 'smg', 36: 'smg', 31: 'smg', 29: 'smg',
    // Rifles
    2: 'rifle', 14: 'rifle', 21: 'rifle', 22: 'rifle',
    // LMG
    4: 'lmg', 32: 'lmg',
    // Shotguns
    7: 'shotgun', 30: 'shotgun', 33: 'shotgun',
    // Snipers
    13: 'sniper', 18: 'sniper', 28: 'sniper', 34: 'sniper', 35: 'sniper',
    // Melee (в т.ч. нож зомби)
    6: 'melee', 11: 'melee', 12: 'melee', 19: 'melee', 20: 'melee', 24: 'melee', 38: 'melee',
    // Explosives / граната
    10: 'grenade', 25: 'grenade', 26: 'grenade', 37: 'grenade',
};

function getWeaponCategory(weaponId) {
    return WEAPON_CATEGORY[weaponId] || 'rifle';
}

// возвращает количество очков за килл данным оружием
export function calcKillScore(weaponId, isHeadshot) {
    const category = getWeaponCategory(weaponId);
    const base = isHeadshot ? CATEGORY_SCORES[category].head : CATEGORY_SCORES[category].body;
    return base;
}
