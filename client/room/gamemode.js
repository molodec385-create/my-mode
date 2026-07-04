import { DisplayValue, StateProp } from 'pixelcombats/room';
import { Players, Properties, GameMode, Rooms, Ui, Timers, Teams, Damage, Build } from 'pixelcombats/room';

// ==========================================
// 1. НАСТРОЙКА ПАРАМЕТРОВ ИЗ GAMEMODE.JSON
// ==========================================
var EnableTDM = Rooms.Current.Parameters.GetBool("EnableTDM");
var EnablePeace = Rooms.Current.Parameters.GetBool("EnablePeace");
var EnableEditor = Rooms.Current.Parameters.GetBool("EnableEditor");
var LoosenBlocks = Rooms.Current.Parameters.GetBool("LoosenBlocks");

// Включаем всплывающие окна (PopUp)
Rooms.Current.PopupsEnable = true;

// Настройка физики блоков (если включено в параметрах)
if (LoosenBlocks) {
    Build.GetContext().Physics.Enabled = true;
}

// ==========================================
// 2. СОЗДАНИЕ КОМАНД И ЛОГИКА РЕЖИМОВ
// ==========================================
// Синяя команда (для TDM или как основная)
Teams.Add("Blue", "Teams/Blue", { b: 1 });
var blueTeam = Teams.Get("Blue");

// Красная команда (включается только если активен TDM)
if (EnableTDM) {
    Teams.Add("Red", "Teams/Red", { r: 1 });
}
var redTeam = Teams.Get("Red");

// Настройка бессмертия (Мирный режим)
if (EnablePeace) {
    Damage.GetContext().DamageOut.Value = false; // Отключаем урон на сервере
}

// Настройка блоков Редактора
if (EnableEditor) {
    Build.GetContext().BlocksSet.Value = Build.BlocksSet.All; // Разрешаем все блоки
} else {
    Build.GetContext().BlocksSet.Value = Build.BlocksSet.None; // Запрещаем строить/ломать
}

// ==========================================
// 3. ОТСЛЕЖИВАНИЕ СОСТОЯНИЙ И ИГРОВОЙ ЦИКЛ
// ==========================================

// Ожидание перед стартом
GameMode.OnWaiting.Add(function () {
    Ui.GetContext().Hint.Value = "hint.waiting"; // Выводит: "Ожидание синхронизации Амальгамы..."
});

// Старт матча
GameMode.OnStart.Add(function () {
    Ui.GetContext().Hint.Value = "hint.battle"; // Выводит: "Матч начался! Конфигурация применена."
    
    // Спавним всех игроков при старте
    for (var iter = Players.GetEnumerator(); iter.MoveNext();) {
        var pl = iter.Current;
        pl.Spawns.Spawn();
    }
});

// Конец раунда
GameMode.OnEnd.Add(function () {
    Ui.GetContext().Hint.Value = "hint.end"; // Выводит: "Раунд завершен!"
});

// ==========================================
// 4. СОБЫТИЯ ИГРОКОВ
// ==========================================

// Вход нового игрока на сервер
Players.OnPlayerConnected.Add(function (player) {
    // Показываем описание режима на языке игрока при входе
    player.PopUp("mode.description");

    // Распределение по командам
    if (EnableTDM) {
        // Если TDM включен — балансим по очереди в Синюю и Красную
        if (blueTeam.Count <= redTeam.Count) {
            blueTeam.Add(player);
        } else {
            redTeam.Add(player);
        }
    } else {
        // Если TDM выключен — все залетают в Синюю команду
        blueTeam.Add(player);
    }
});

// Спавн игрока
Players.OnPlayerSpawn.Add(function (player) {
    // Если включен режим редактора, выдаем инструмент создания блоков
    if (EnableEditor) {
        player.Inventory.Main.SetBuildBlocksFormat();
    }
});

// Смерть игрока (авто-респавн через 4 секунды)
Players.OnPlayerDeath.Add(function (player) {
    Timers.Get("Respawn_" + player.Id).Start(4, function () {
        player.Spawns.Spawn();
    });
});
