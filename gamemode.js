import { Teams, ScoreInfo } from 'pixel_combats/room';

// Логика бесконечных патронов
room.on("Shoot", (event) => {
    // 28: РПК-74, 36: МАК-11, 85: РПГ-7
    const infiniteAmmoIds = [28, 36, 85]; 
    if (infiniteAmmoIds.includes(event.weapon.id)) {
        event.weapon.ammo = event.weapon.maxAmmo;
    }
});
