import { Room, Players, Teams, Damage, Properties, Ui, Timers } from 'pixel-combats/room';

// 1. Создаем команды
const redTeam = Teams.Create("Red", "Красные", { r: 1, g: 0, b: 0 });
const blueTeam = Teams.Create("Blue", "Синие", { r: 0, g: 0, b: 1 });

// Разрешаем урон по врагам, но выключаем огонь по своим
Damage.FriendlyFire = false;

// 2. Настройки при старте комнаты
Room.OnStart.Add(function () {
    // Включаем бесконечный режим (убираем стандартные таймеры конца игры)
    Timers.Get("GameTimer").Start(999999); 
    
    // Выводим подсказку для игроков
    Ui.GetContext().Hint.Value = "Бесконечный ТДМ! Убей всех!";
});

// 3. Распределение игроков по командам при входе
Players.OnPlayerConnect.Add(function (player) {
    // Автоматический баланс: закидываем в команду, где меньше людей
    if (redTeam.Count <= blueTeam.Count) {
        redTeam.Add(player);
    } else {
        blueTeam.Add(player);
    }
});

// 4. Главное: Выдача оружия при каждом спавне
Players.OnPlayerSpawn.Add(function (player) {
    // Очищаем старый инвентарь (на всякий случай)
    player.Inventory.Clear();

    // Выдаем запрашиваемый набор оружия по внутренним ID игры:
    player.Inventory.Main.Set("M249SAW");   // Пулемет M249
    player.Inventory.Secondary.Set("MAC11"); // Пистолет-пулемет MAC-11
    player.Inventory.Melee.Set("Katana");    // Холодное оружие - Катана
    player.Inventory.Explosive.Set("RPG7");  // Ракетница RPG-7
    
    // Автоматически выбираем пулемет в руки при спавне
    player.Inventory.Main.Switch();
});

// 5. Обработка смертей и начисление очков
Properties.OnPlayerDead.Add(function (player, killer) {
    // Если игрока убил другой игрок (а не разбился сам)
    if (killer && killer !== player) {
        // Добавляем очко в статистику убийцы
        killer.Properties.Scores.Value += 1;
        
        // Добавляем очко команде убийцы
        killer.Team.Properties.Scores.Value += 1;
    }
    
    // Возрождаем игрока через 3 секунды после смерти
    Timers.Get("RespawnTimer_" + player.Id).Start(3).OnTimer.Add(function() {
        player.Spawns.Spawn();
    });
});

// 6. Если игрок вышел, убираем его из команды
Players.OnPlayerDisconnect.Add(function (player) {
    if (player.Team) {
        player.Team.Remove(player);
    }
});
