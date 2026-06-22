// ==========================================
// ИНИЦИАЛИЗАЦИЯ КОМАНД И НАСТРОЕК
// ==========================================

// Вход в команду по запросу и спавн (Базовый каркас PC)
Teams.OnRequestJoinTeam.Add(function(player, team) { 
    team.Add(player); 
});

Teams.OnPlayerChangeTeam.Add(function(player) { 
    player.Spawns.Spawn(); 
});

// Создаем 2 команды (Выжившие и Зомби)
Teams.Add("Blue", "Teams/Blue", { b: 1 }); // Синие
Teams.Add("Red", "Teams/Red", { r: 1 });   // Красные

// Назначаем группы спавна (1 — для людей, 2 — для зомби)
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(2);

// Настройки урона
Damage.FriendlyFire = false;

// Состояние игры через свойства контекста комнаты
var stateProp = Properties.GetContext().Get("State");
stateProp.Value = "Waiting"; // Ждем игроков

// Главный таймер раунда
var mainTimer = Timers.GetContext().Get("Main");

// Подсказка в UI
Ui.GetContext().Hint.Value = "Ожидание игроков (минимум 2)...";

// ==========================================
// ОСНОВНАЯ ЛОГИКА ИГРЫ
// ==========================================

// Отслеживаем подключение игроков для старта
Players.OnPlayerConnect.Add(function(player) {
    if (stateProp.Value === "Waiting" && Players.Count >= 2) {
        StartPreparation();
    } else if (stateProp.Value === "Active") {
        // Если игра идет, закидываем опоздавшего за зомби
        SetZombie(player);
    } else {
        Teams.Get("Blue").Add(player);
    }
});

// Фаза подготовки (15 секунд)
function StartPreparation() {
    stateProp.Value = "Preparation";
    Ui.GetContext().Hint.Value = "Приготовьтесь! Скоро начнется заражение!";
    
    // Переводим всех за Выживших перед стартом
    var allPlayers = Players.All;
    for (var i = 0; i < allPlayers.length; i++) {
        Teams.Get("Blue").Add(allPlayers[i]);
        // Тут можно выдать стандартное оружие людям через player.Inventory
    }
    
    // Запускаем таймер подготовки на 15 секунд
    mainTimer.Restart(15);
}

// Конец таймера (переключение фаз)
mainTimer.OnTimer.Add(function() {
    if (stateProp.Value === "Preparation") {
        StartActiveGame();
    } else if (stateProp.Value === "Active") {
        EndRound("Blue"); // Время вышло -> Выжившие победили
    }
});

// Фаза активного боя (Выбор Альфа-Зомби)
function StartActiveGame() {
    stateProp.Value = "Active";
    Ui.GetContext().Hint.Value = "Зомби близко! Выживайте!";
    
    var allPlayers = Players.All;
    if (allPlayers.length > 0) {
        // Случайный Альфа-Зомби
        var randomIndex = Math.floor(Math.random() * allPlayers.length);
        var alphaZombie = allPlayers[randomIndex];
        
        SetZombie(alphaZombie);
        Ui.GetContext().Hint.Value = alphaZombie.Name + " стал Первым Зомби!";
    }
    
    // Раунд длится 180 секунд (3 минуты)
    mainTimer.Restart(180);
}

// Функция превращения игрока в Зомби
function SetZombie(player) {
    Teams.Get("Red").Add(player);
    
    // Баффы зомби через свойства игрока
    // (Имена проперти "Hp"/"MaxHp" могут отличаться, сверь с docs/services/)
    var hp = player.Properties.Get("Hp");
    var maxHp = player.Properties.Get("MaxHp");
    if (hp) hp.Value = 300;
    if (maxHp) maxHp.Value = 300;
    
    player.Spawns.Spawn();
}

// Обработка смертей (Заражение)
Damage.OnDeath.Add(function(player, attacker) {
    if (stateProp.Value === "Active") {
        if (Teams.Get("Blue").Contains(player)) {
            // Если умер выживший — становится зомби
            SetZombie(player);
            Ui.GetContext().Hint.Value = player.Name + " был заражен!";
            
            // Проверка условий победы зомби
            if (Teams.Get("Blue").Count === 0) {
                EndRound("Red");
            }
        } else {
            // Зомби просто респавнится через 3 секунды
            player.Spawns.RespawnTime.Value = 3; 
            player.Spawns.Spawn();
        }
    }
});

// Выход игрока
Players.OnPlayerDisconnect.Add(function(player) {
    player.Teams.Leave();
    if (stateProp.Value === "Active" && Teams.Get("Blue").Count === 0) {
        EndRound("Red");
    }
});

// Завершение раунда и рестарт
function EndRound(winnerTeamId) {
    stateProp.Value = "Ended";
    
    if (winnerTeamId === "Blue") {
        Ui.GetContext().Hint.Value = "Выжившие победили!";
    } else {
        Ui.GetContext().Hint.Value = "Зомби победили! Все заражены!";
    }
    
    // Через 7 секунд мягкий перезапуск карты средствами движка
    var restartTimer = Timers.GetContext().Get("Restart");
    restartTimer.Restart(7);
    restartTimer.OnTimer.Add(function() {
        Game.RestartGame(); // Сбрасывает комнату[span_6](start_span)[span_6](end_span)
    });
}
