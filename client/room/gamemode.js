// ==========================================
// Ранняя инициализация (Вызывается на старте)
// ==========================================
Room.PopupsEnable = true;          // Включаем попапы строго на старте комнаты[span_5](start_span)[span_5](end_span)
Ui.ScoresTopViewEnable = true;     // Включаем счетчик очков над прицелом[span_6](start_span)[span_6](end_span)

// Настройка базовых параметров здоровья
contextedProperties.GetContext().MaxHp.Value = 100; // Стандартное HP для всех[span_7](start_span)[span_7](end_span)

// Создаем команды[span_8](start_span)[span_8](end_span)
Teams.Add("Blue", "Teams/Blue", { b: 1 }); // Выжившие
Teams.Add("Red", "Teams/Red", { r: 1 });   // Зомби

// Привязываем группы спавна (1 — для людей, 2 — для зомби)[span_9](start_span)[span_9](end_span)
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(2);

// Настройки урона и респавна
Damage.FriendlyFire = false; // Отключаем огонь по своим[span_10](start_span)[span_10](end_span)
Spawns.GetContext().RespawnTime.Value = 0; // Моментальный респавн[span_11](start_span)[span_11](end_span)

// Настройка таблицы лидеров[span_12](start_span)[span_12](end_span)
LeaderBoard.PlayerLeaderBoardValues = [
  { Value: "Kills", DisplayName: "Statistics/Kills", ShortDisplayName: "Statistics/KillsShort" },
  { Value: "Deaths", DisplayName: "Statistics/Deaths", ShortDisplayName: "Statistics/DeathsShort" }
];
LeaderBoard.PlayersWeightGetter.Set(function(player) {
  return player.Properties.Get("Kills").Value;
});

// Переменная состояния игры через контекст свойств комнаты[span_13](start_span)[span_13](end_span)
var stateProp = Properties.GetContext().Get("GameState");
stateProp.Value = "Waiting";

// Настраиваем UI подсказку[span_14](start_span)[span_14](end_span)
Ui.GetContext().Hint.Value = "Hint/Waiting";

// ==========================================
// ЛОГИКА ОБРАБОТКИ ИГРОКОВ
// ==========================================

// Вход в команду по запросу[span_15](start_span)[span_15](end_span)
Teams.OnRequestJoinTeam.Add(function(player, team) { 
    // Запрещаем ручной выбор команды, движок распределит сам
    if (stateProp.Value === "Waiting" || stateProp.Value === "Preparation") {
        Teams.Get("Blue").Add(player);
    } else {
        Teams.Get("Red").Add(player); // Опоздавшие идут за зомби
    }
});

// Авто-спавн при смене команды[span_16](start_span)[span_16](end_span)
Teams.OnPlayerChangeTeam.Add(function(player) { 
    player.Spawns.Spawn(); 
});

// Вход нового игрока в комнату[span_17](start_span)[span_17](end_span)
Players.OnPlayerConnect.Add(function(player) {
    player.PopUp("Pop/Welcome");
    
    // Если набралось 2+ игрока и мы в ожидании — запускаем подготовку
    if (stateProp.Value === "Waiting" && Players.Count >= 2) {
        StartPreparation();
    }
});

// Выход игрока[span_18](start_span)[span_18](end_span)
Players.OnPlayerDisconnect.Add(function(player) {
    player.Teams.Leave();
    if (stateProp.Value === "Active") {
        CheckWinConditions();
    }
});

// ==========================================
// УПРАВЛЕНИЕ ИГРОВЫМ ПРОЦЕССОМ (ТАЙМЕРЫ)
// ==========================================

var mainTimer = Timers.GetContext().Get("MainRoundTimer");

// Обработчик окончания таймеров[span_19](start_span)[span_19](end_span)
mainTimer.OnTimer.Add(function() {
    if (stateProp.Value === "Preparation") {
        StartActiveGame();
    } else if (stateProp.Value === "Active") {
        EndRound("Blue"); // Время вышло — Выжившие победили[span_20](start_span)[span_20](end_span)!
    }
});

function StartPreparation() {
    stateProp.Value = "Preparation";
    Ui.GetContext().Hint.Value = "Hint/Prep";
    
    // Переводим всех в команду выживших и даем полное оружие[span_21](start_span)[span_21](end_span)
    var allPlayers = Players.All;
    for (var i = 0; i < allPlayers.length; i++) {
        Teams.Get("Blue").Add(allPlayers[i]);
    }
    
    // Настраиваем инвентарь выживших (Все разрешено)[span_22](start_span)[span_22](end_span)
    var inv = Inventory.GetContext(Teams.Get("Blue"));
    inv.Main.Value = true;
    inv.Secondary.Value = true;
    inv.Melee.Value = true;
    inv.Explosive.Value = true;

    mainTimer.Restart(15); // 15 секунд на разбег[span_23](start_span)[span_23](end_span)
}

function StartActiveGame() {
    stateProp.Value = "Active";
    Ui.GetContext().Hint.Value = "Hint/Active";
    
    // Настраиваем инвентарь Зомби (Только Нож!)[span_24](start_span)[span_24](end_span)
    var zombieInv = Inventory.GetContext(Teams.Get("Red"));
    zombieInv.Main.Value = false;
    zombieInv.Secondary.Value = false;
    zombieInv.Melee.Value = true;
    zombieInv.Explosive.Value = false;

    // Выбираем Альфа-Зомби[span_25](start_span)[span_25](end_span)
    var allPlayers = Players.All;
    if (allPlayers.length > 0) {
        var randomIndex = Math.floor(Math.random() * allPlayers.length);
        var alpha = allPlayers[randomIndex];
        
        SetZombie(alpha);
        
        // Оповещаем комнату через глобальный попап (вызываем на первом попавшемся игроке для трансляции)[span_26](start_span)[span_26](end_span)
        alpha.PopUp(alpha.Name + " Pop/Alpha");
    }
    
    // Динамическая длина раунда в зависимости от GameLength[span_27](start_span)[span_27](end_span)
    var length = GameMode.Parameters.GameLength;
    var duration = 180; // По дефолту 3 минуты (M)
    if (length === "S") duration = 120;
    if (length === "L") duration = 240;
    if (length === "XL") duration = 300;
    
    mainTimer.Restart(duration); // Погнали[span_28](start_span)[span_28](end_span)!
}

function SetZombie(player) {
    Teams.Get("Red").Add(player);
    // Примечание: Увеличение HP зомбакам до 300 регулируется через переопределение MaxHp на игроке,
    // но так как контекст свойств игрока кастомный, мы форсим респавн на зомби-точках.[span_29](start_span)[span_29](end_span)
    player.Spawns.Spawn();
}

// ==========================================
// БОЕВАЯ МЕХАНИКА (ЗАРАЖЕНИЕ)
// ==========================================

Damage.OnDeath.Add(function(player, attacker) {
    if (stateProp.Value === "Active") {
        if (Teams.Get("Blue").Contains(player)) {
            // Умер выживший — переходит за зомби[span_30](start_span)[span_30](end_span)
            SetZombie(player);
            ++player.Properties.Deaths.Value; // Статистика[span_31](start_span)[span_31](end_span)
            
            if (attacker && Teams.Get("Red").Contains(attacker)) {
                ++attacker.Properties.Kills.Value; // Засчитываем фраг зомби[span_32](start_span)[span_32](end_span)
            }
            
            player.PopUp(player.Name + " Pop/Infected");
            CheckWinConditions();
        } else {
            // Обычный зомби просто респавнится[span_33](start_span)[span_33](end_span)
            player.Spawns.Spawn();
        }
    }
});

function CheckWinConditions() {
    // Если выживших не осталось — победа зомби[span_34](start_span)[span_34](end_span)
    if (Teams.Get("Blue").Count === 0) {
        EndRound("Red");
    }
}

function EndRound(winnerTeamId) {
    stateProp.Value = "Ended";
    
    var all = Players.All;
    var winMessage = winnerTeamId === "Blue" ? "Pop/HumanWin" : "Pop/ZombieWin";
    
    if (all.length > 0) {
        all[0].PopUp(winMessage); // Выводим попап окончания[span_35](start_span)[span_35](end_span)
    }
    
    // Запускаем безопасный перезапуск раунда через 7 секунд[span_36](start_span)[span_36](end_span)
    var restartTimer = Timers.GetContext().Get("RestartTimer");
    restartTimer.Restart(7);
    restartTimer.OnTimer.Add(function() {
        Game.RestartGame(); // Мягкий перезапуск всей комнаты средствами движка[span_37](start_span)[span_37](end_span)
    });
}
