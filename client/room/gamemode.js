import { DisplayValueHeader, Color } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';
const { room, Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote } = room_lib;
import * as vote_types from 'pixel_combats/types/new_game_vote';

room.PopupsEnable = true;

// время основной битвы по размерам карт — короткие ключи S/M/L/XL,
// как в реальном рабочем TDM (а не 'Length_S' из default_timer.js)
const GAME_MODE_TIMES = {
	'S': 210,  // 3:30
	'M': 270,  // 4:30
	'L': 330,  // 5:30
	'XL': 390  // 6:30
};

// ===== Настройки команд =====
const ZOMBIE_TEAM_NAME = "Zombies";
const INMATE_TEAM_NAME = "Inmates";
const ZOMBIE_TEAM_DISPLAY_NAME = "Teams/Zombies";
const INMATE_TEAM_DISPLAY_NAME = "Teams/Inmates";
const ZOMBIE_SPAWN_POINTS_GROUP = 1;
const INMATE_SPAWN_POINTS_GROUP = 2;
const ZOMBIE_TEAM_COLOR = new Color(0, 1, 0, 0); // зелёный
const INMATE_TEAM_COLOR = new Color(1, 0.5, 0, 0); // оранжевый

function create_team_zombies() {
	Teams.Add(ZOMBIE_TEAM_NAME, ZOMBIE_TEAM_DISPLAY_NAME, ZOMBIE_TEAM_COLOR);
	const team = Teams.Get(ZOMBIE_TEAM_NAME);
	team.Spawns.SpawnPointsGroups.Add(ZOMBIE_SPAWN_POINTS_GROUP);
	return team;
}
function create_team_inmates() {
	Teams.Add(INMATE_TEAM_NAME, INMATE_TEAM_DISPLAY_NAME, INMATE_TEAM_COLOR);
	const team = Teams.Get(INMATE_TEAM_NAME);
	team.Spawns.SpawnPointsGroups.Add(INMATE_SPAWN_POINTS_GROUP);
	return team;
}

// ===== Настройки времени =====
const WaitingPlayersTime = 10;
const TacticalPreparationTime = 15;
const EndOfMatchTime = 8;
const VoteTime = 10;

// ===== Очки =====
const WINNER_SCORES = 3000;
const LOSER_SCORES = 1500;
const INFECT_SCORES = 500;      // зомби заражает заключённого
const KILL_ZOMBIE_SCORES = 2000; // заключённый убивает зомби (тяжело!)
const KILLS_PROP_NAME = "Kills";
const SCORES_PROP_NAME = "Scores";

// ===== Состояния =====
const WaitingStateValue = "Waiting";
const TacticalPreparationStateValue = "TacticalPreparation";
const GameStateValue = "Game";
const EndOfMatchStateValue = "EndOfMatch";

const mainTimer = Timers.GetContext().Get("Main");
const stateProp = Properties.GetContext().Get("State");

// параметры комнаты
Damage.GetContext().FriendlyFire.Value = false;
BreackGraph.WeakBlocks = false;
BreackGraph.OnlyPlayerBlocksDmg = false;
BreackGraph.PlayerBlockBoost = true;

Properties.GetContext().GameModeName.Value = "GameModes/Zombie vs Inmates";
TeamsBalancer.IsAutoBalance = false; // баланс не нужен — зомби выбираются вручную
Ui.GetContext().MainTimerId.Value = mainTimer.Id;

const zombieTeam = create_team_zombies();
const inmateTeam = create_team_inmates();
inmateTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;

// отображаем изначально нули в очках команд
zombieTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;
inmateTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;

// лидерборд
LeaderBoard.PlayerLeaderBoardValues = [
	new DisplayValueHeader(KILLS_PROP_NAME, "Statistics/Kills", "Statistics/KillsShort"),
	new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
	new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get(SCORES_PROP_NAME).Value;
});
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort");
LeaderBoard.TeamWeightGetter.Set(function (team) {
	return team.Properties.Get(SCORES_PROP_NAME).Value;
});

// все новые игроки по умолчанию идут к заключённым
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn(); });

// respawn: заключённые получают короткое бессмертие, зомби — нет
Spawns.GetContext().OnSpawn.Add(function (player) {
	if (player.Team === inmateTeam) {
		player.Properties.Immortality.Value = true;
		player.Timers.Get("immortality").Restart(2);
	}
});
Timers.OnPlayerTimer.Add(function (timer) {
	if (timer.Id != "immortality") return;
	timer.Player.Properties.Immortality.Value = false;
});

Spawns.OnSpawn.Add(function (player) {
	++player.Properties.Spawns.Value;
});

// счётчик смертей — фиксируется при любой смерти (задокументировано в damage.md)
Damage.OnDeath.Add(function (player) {
	++player.Properties.Deaths.Value;
});

// Damage.OnKill(killer, killed) — задокументированное событие (damage.md)
Damage.OnKill.Add(function (killer, killed) {
	if (stateProp.Value !== GameStateValue) return;
	if (!killer || !killed) return;

	// зомби заражает заключённого
	if (killer.Team === zombieTeam && killed.Team === inmateTeam) {
		++killer.Properties.Kills.Value;
		killer.Properties.Scores.Value += INFECT_SCORES;
		zombieTeam.Properties.Get(SCORES_PROP_NAME).Value += INFECT_SCORES;

		// превращаем жертву в зомби и респавним
		zombieTeam.Add(killed);
		killed.Spawns.Spawn();

		CheckForWin();
		return;
	}

	// заключённый убивает зомби — зомби живучие, награда большая
	if (killer.Team === inmateTeam && killed.Team === zombieTeam) {
		++killer.Properties.Kills.Value;
		killer.Properties.Scores.Value += KILL_ZOMBIE_SCORES;
		inmateTeam.Properties.Get(SCORES_PROP_NAME).Value += KILL_ZOMBIE_SCORES;
	}
});

// таймер состояний
mainTimer.OnTimer.Add(function () {
	switch (stateProp.Value) {
		case WaitingStateValue:
			SetTacticalPreparation();
			break;
		case TacticalPreparationStateValue:
			SetGameMode();
			break;
		case GameStateValue:
			// время вышло — заключённые выжили и победили
			SetEndOfMatch(inmateTeam, zombieTeam);
			break;
		case EndOfMatchStateValue:
			start_vote();
			break;
	}
});

SetWaitingMode();

function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}

function SetTacticalPreparation() {
	stateProp.Value = TacticalPreparationStateValue;
	Ui.GetContext().Hint.Value = "Hint/TacticalPrep";

	// всех игроков временно определяем к заключённым
	for (const player of Players.All) {
		inmateTeam.Add(player);
	}

	// заключённые: полное снаряжение
	var inmateInv = Inventory.GetContext(inmateTeam);
	inmateInv.Main.Value = true;
	inmateInv.Secondary.Value = true;
	inmateInv.Melee.Value = true;
	inmateInv.Explosive.Value = false;
	inmateInv.Build.Value = false;

	// зомби: только ближний бой
	var zombieInv = Inventory.GetContext(zombieTeam);
	zombieInv.Main.Value = false;
	zombieInv.Secondary.Value = false;
	zombieInv.Melee.Value = true;
	zombieInv.Explosive.Value = false;
	zombieInv.Build.Value = false;

	Damage.GetContext().DamageOut.Value = false;
	Spawns.GetContext().enable = true;
	Spawns.GetContext(inmateTeam).Spawn();

	mainTimer.Restart(TacticalPreparationTime);
}

function SetGameMode() {
	stateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/MainBattle";
	Damage.GetContext().DamageOut.Value = true;

	// выбираем одного случайного заключённого и превращаем в зомби
	const players = inmateTeam.Players;
	if (players.length > 0) {
		const patientZero = players[Math.floor(Math.random() * players.length)];
		zombieTeam.Add(patientZero);
	}

	Spawns.GetContext().Despawn();
	Spawns.GetContext(inmateTeam).Spawn();
	Spawns.GetContext(zombieTeam).Spawn();

	// длительность матча + спец-режимы HP
	const gameLength = GameMode.Parameters.GetString('GameLength');
	const isFastMatch = GameMode.Parameters.GetBool('FastMatch');
	const isSuperLongMatch = GameMode.Parameters.GetBool('SuperLongMatch');

	let gameTime;
	if (isFastMatch) {
		gameTime = 120; // супер короткий матч — 2 минуты
		zombieTeam.ContextedProperties.MaxHp.Value = 150; // зомби слабее
	} else if (isSuperLongMatch) {
		gameTime = 600; // супер долгий матч — 10 минут
		inmateTeam.ContextedProperties.MaxHp.Value = 1000; // заключённые живучее
	} else {
		gameTime = GAME_MODE_TIMES[gameLength] || GAME_MODE_TIMES['M'];
	}
	mainTimer.Restart(gameTime);
}

function CheckForWin() {
	if (inmateTeam.Players.length === 0) {
		SetEndOfMatch(zombieTeam, inmateTeam);
	}
}

function SetEndOfMatch(winners, loosers) {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext(winners).Hint.Value = "Hint/MockHintForWinners";
	Ui.GetContext(loosers).Hint.Value = "Hint/MockHintForLoosers";

	for (const p of winners.Players) p.Properties.Scores.Value += WINNER_SCORES;
	for (const p of loosers.Players) p.Properties.Scores.Value += LOSER_SCORES;
	winners.Properties.Get(SCORES_PROP_NAME).Value += WINNER_SCORES * winners.Players.length;
	loosers.Properties.Get(SCORES_PROP_NAME).Value += LOSER_SCORES * loosers.Players.length;

	var spawns = Spawns.GetContext();
	spawns.enable = false;
	spawns.Despawn();

	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}

function OnVoteResult(v) {
	if (v.Result === null) return;
	NewGame.RestartGame(v.Result);
}
NewGameVote.OnResult.Add(OnVoteResult);

function start_vote() {
	var variants = [
		new vote_types.SameVariant(),
		new vote_types.OnlyUniqueVariants(true, false)
	];
	NewGameVote.Start(variants, VoteTime);
}
