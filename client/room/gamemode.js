// ===== Last Survivor (v2) =====
// Одна жизнь на раунд, респавна нет, побеждает последний живой.
// Мёртвые уходят в спектаторы. Раунд стартует только при 2+ игроках.

// ---- Команды ----
Teams.Add("Players", "Teams/Players", {});
Teams.Add("Spectators", "Teams/Spectators", {});

// несколько точек спавна — чтобы каждая жизнь начиналась в разном месте
Teams.Get("Players").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Players").Spawns.SpawnPointsGroups.Add(2);
Teams.Get("Players").Spawns.SpawnPointsGroups.Add(3);
Teams.Get("Players").Spawns.SpawnPointsGroups.Add(4);

Teams.OnRequestJoinTeam.Add(function (player, team) {
  team.Add(player);
});

// ---- Счётчик живых ----
var aliveCount = Properties.GetContext().Get("AliveCount");
aliveCount.Value = 0;

var roundStarted = false;
var roundEnded = false;

var roundTime = parseInt(GameMode.Parameters.Get("round_time")) || 300;
Spawns.GetContext().RespawnTime.Value = roundTime + 9999;

var roundTimer = Timers.GetContext().Get("RoundTimer");

function updateHint() {
  Ui.GetContext().Hint.Value = "Живых: " + aliveCount.Value;
}

// первый спавн игрока в раунде
Teams.OnPlayerChangeTeam.Add(function (player) {
  if (roundStarted) return; // после старта новые в раунд уже не встревают

  player.Spawns.Spawn();
  player.Properties.Alive = player.Properties.Alive || {};
  player.Properties.Alive.Value = true;
  aliveCount.Value = aliveCount.Value + 1;
  updateHint();

  // раунд стартует, когда набралось хотя бы 2 живых
  if (!roundStarted && aliveCount.Value >= 2) {
    roundStarted = true;
    roundTimer.Restart(roundTime);
  }
});

// ---- Смерть игрока ----
Damage.OnDeath.Add(function (player) {
  ++player.Properties.Deaths.Value;
  player.Properties.Alive.Value = false;
  aliveCount.Value = aliveCount.Value - 1;
  updateHint();

  // убираем труп с поля — переводим в спектаторы
  Teams.Get("Spectators").Add(player);

  checkForWinner();
});

function checkForWinner() {
  if (roundEnded || !roundStarted) return;

  if (aliveCount.Value <= 1) {
    roundEnded = true;
    Ui.GetContext().Hint.Value = "Раунд окончен";

    var endDelay = Timers.GetContext().Get("EndDelay");
    endDelay.Restart(5);
    endDelay.OnTimer.Add(function () {
      Game.RestartGame();
    });
  }
}

roundTimer.OnTimer.Add(function () {
  if (roundEnded) return;
  roundEnded = true;
  Ui.GetContext().Hint.Value = "Раунд окончен";
  Game.RestartGame();
});
