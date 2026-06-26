// Команды
Teams.Add("Red", "Teams/Red", { r: 1 });
Teams.Add("Blue", "Teams/Blue", { b: 1 });
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(2);

// Авто-вступление и спавн
Teams.OnRequestJoinTeam.Add(function(player, team) { team.Add(player); });
Teams.OnPlayerChangeTeam.Add(function(player) { player.Spawns.Spawn(); });

// Респавн
Spawns.GetContext().RespawnTime.Value = 5;

// Параметры
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");

// Бесконечные патроны (параметр)
var inf = GameMode.Parameters.GetBool("InfiniteAmmo");
var inv = Inventory.GetContext();
inv.MainInfinity.Value = inf;
inv.SecondaryInfinity.Value = inf;
inv.MeleeInfinity.Value = inf;
inv.ExplosiveInfinity.Value = inf;

// Таблица лидеров
LeaderBoard.PlayerLeaderBoardValues = [
  { Value: "Kills",  DisplayName: "Statistics/Kills",  ShortDisplayName: "Statistics/KillsShort" },
  { Value: "Deaths", DisplayName: "Statistics/Deaths", ShortDisplayName: "Statistics/DeathsShort" },
  { Value: "Scores", DisplayName: "Statistics/Scores", ShortDisplayName: "Statistics/ScoresShort" }
];
LeaderBoard.TeamLeaderBoardValue = {
  Value: "Scores",
  DisplayName: "Statistics/Scores",
  ShortDisplayName: "Statistics/ScoresShort"
};
LeaderBoard.PlayersWeightGetter.Set(function(player) {
  return player.Properties.Get("Kills").Value;
});
LeaderBoard.TeamWeightGetter.Set(function(team) {
  return team.Properties.Get("Scores").Value;
});

// Статистика
Damage.OnKill.Add(function(killer, killed) {
  if (killed.Team && killed.Team !== killer.Team) {
    ++killer.Properties.Get("Kills").Value;
    killer.Properties.Get("Scores").Value += 10;
  }
});
Damage.OnDeath.Add(function(player) {
  ++player.Properties.Get("Deaths").Value;
});

// Подсказка
Ui.GetContext().Hint.Value = "Hint/AttackEnemies";
