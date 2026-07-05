import { DisplayValueHeader } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';
const {
    room, Game, Players, LeaderBoard, Teams, Damage, BreackGraph,
    Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer,
    NewGame, NewGameVote, ScoreInfo
} = room_lib;
import * as vote_types from 'pixel_combats/types/new_game_vote';
import * as teams from './default_teams.js';
import * as options from './options.js';
import * as damageScores from './damage_scores.js';
import { addTeamScores } from './team_scores.js';

// ---------- настройки ----------
const WAITING_TIME = 10;              // ожидание игроков перед стартом, сек
const END_OF_MATCH_TIME = 8;          // показ результатов, сек
const VOTE_TIME = 10;                 // голосование за следующую карту, сек
const SPAWN_IMMORTALITY_TIME = 3;     // обычная неуязвимость после спавна
const LAST_STAND_TIME = 15;           // неуязвимость "последнего шанса"

const SPAWN_IMMORTALITY_TIMER_ID = "immortality";
const LAST_STAND_TIMER_ID = "laststand";

const KILLS_PROP_NAME = "Kills";
const SCORES_PROP_NAME = "Scores";

const WaitingStateValue = "Waiting";
const GameStateValue = "Game";
const EndOfMatchStateValue = "EndOfMatch";

// длительность матча из параметров комнаты (2/3/5 минут)
const matchDurationMinutes = Number(GameMode.Parameters.Get("MatchDuration")) || 3;
const MATCH_DURATION_SECONDS = matchDurationMinutes * 60;

// ---------- инициализация комнаты ----------
room.PopupsEnable = true;
Properties.GetContext().GameModeName.Value = "GameModes/Postapocalypse";

// блоки в этом режиме полностью неразрушаемы
BreackGraph.Damage = false;

Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");

const redTeam = teams.create_red();
const blueTeam = teams.create_blue();
const zombiesTeam = teams.create_zombies();

options.set_human_inventory(redTeam);
options.set_human_inventory(blueTeam);
options.set_zombie_inventory(zombiesTeam);

options.apply_human_hp(redTeam);
options.apply_human_hp(blueTeam);
options.update_zombie_hp_buff(zombiesTeam);

// автобаланс не нужен: роли асимметричны, а заражение управляет составом команд вручную
TeamsBalancer.IsAutoBalance = false;

const mainTimer = Timers.GetContext().Get("Main");
const stateProp = Properties.GetContext().Get("State");

Ui.GetContext().MainTimerId.Value = mainTimer.Id;

// таблица лидеров
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader(KILLS_PROP_NAME, "Statistics/Kills", "Statistics/KillsShort"),
    new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
    new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort");
LeaderBoard.TeamWeightGetter.Set(function (team) {
    return team.Properties.Get(SCORES_PROP_NAME).Value;
});
LeaderBoard.PlayersWeightGetter.Set(function (player) {
    return player.Properties.Get(SCORES_PROP_NAME).Value;
});

redTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;
blueTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;

Ui.GetContext().TeamProp1.Value = { Team: teams.BLUE_NAME, Prop: SCORES_PROP_NAME };
Ui.GetContext().TeamProp2.Value = { Team: teams.RED_NAME, Prop: SCORES_PROP_NAME };

// ---------- вход в команды ----------
Teams.OnRequestJoinTeam.Add(function (player, team) {
    // в зомби через выбор команды войти нельзя — только через заражение
    if (team === zombiesTeam) return;
    team.Add(player);
});
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn(); });

// ---------- неуязвимость после обычного спавна ----------
Spawns.GetContext().OnSpawn.Add(function (player) {
    // если неуязвимость уже настроена отдельно (последний шанс) — не перезаписываем её
    if (player.Properties.Get("SkipAutoImmortality").Value) {
        player.Properties.Get("SkipAutoImmortality").Value = false;
        return;
    }
    player.Properties.Immortality.Value = true;
    player.Timers.Get(SPAWN_IMMORTALITY_TIMER_ID).Restart(SPAWN_IMMORTALITY_TIME);
});

Timers.OnPlayerTimer.Add(function (timer) {
    if (timer.Id === SPAWN_IMMORTALITY_TIMER_ID || timer.Id === LAST_STAND_TIMER_ID) {
        timer.Player.Properties.Immortality.Value = false;
    }
});

// ---------- смерть, заражение и "последний шанс" ----------
Damage.OnDeath.Add(function (player) {
    if (stateProp.Value !== GameStateValue) {
        player.Spawns.Spawn();
        return;
    }

    ++player.Properties.Deaths.Value;

    if (player.Team === zombiesTeam) {
        // зомби всегда возрождается зомби же
        player.Spawns.Spawn();
        return;
    }

    const team = player.Team; // Red или Blue
    const isLastOfTeam = team.Players && team.Players.length === 1;
    const lastStandUsed = player.Properties.Get("LastStandUsed").Value;

    if (isLastOfTeam && !lastStandUsed) {
        // последний шанс: не превращаем в зомби, а даём временную неуязвимость
        player.Properties.Get("LastStandUsed").Value = true;
        player.Properties.Get("SkipAutoImmortality").Value = true;
        player.Spawns.Spawn();
        player.Properties.Immortality.Value = true;
        player.Timers.Get(LAST_STAND_TIMER_ID).Restart(LAST_STAND_TIME);
        Ui.GetContext(player).Hint.Value = "Hint/LastStand";
        return;
    }

    // окончательная смерть — заражение
    zombiesTeam.Add(player);
    options.update_zombie_hp_buff(zombiesTeam);
    checkRoundEnd();
});

// при отключении зомби пересчитываем баф (мог опуститься ниже порога)
Players.OnPlayerDisconnected.Add(function () {
    options.update_zombie_hp_buff(zombiesTeam);
    if (stateProp.Value === GameStateValue) checkRoundEnd();
});

// ---------- очки за килл ----------
Damage.OnKillReport.Add(function (victim, killer, report) {
    if (stateProp.Value !== GameStateValue) return;
    if (!killer || !victim) return;
    if (killer.Team == null || victim.Team == null) return;
    if (killer.Team === victim.Team) return; // без очков за тиммейта

    const weaponId = report.KillHit ? report.KillHit.WeaponID : 0;
    const isHeadshot = !!(report.KillHit && report.KillHit.IsHeadShot === true);
    const add = damageScores.calcKillScore(weaponId, isHeadshot);

    ++killer.Properties.Kills.Value;
    killer.Properties.Scores.Value += add;

    // командные очки актуальны только для Red и Blue — Zombies за победу не соревнуются
    if (killer.Team === redTeam || killer.Team === blueTeam) {
        addTeamScores(killer.Team, add);
    }

    ScoreInfo.Show(killer, {
        Type: 2, // Kill
        WeaponId: weaponId,
        Scores: add,
        IsHeadshot: isHeadshot
    });
});

// ---------- состояния матча ----------
mainTimer.OnTimer.Add(function () {
    switch (stateProp.Value) {
        case WaitingStateValue:
            SetGameMode();
            break;
        case GameStateValue:
            SetEndOfMatch();
            break;
        case EndOfMatchStateValue:
            start_vote();
            break;
    }
});

SetWaitingMode();

function SetWaitingMode() {
    stateProp.Value = WaitingStateValue;
    Ui.GetContext().Hint.Value = "Hint/WaitingForPlayers";
    Spawns.GetContext().enable = false;
    mainTimer.Restart(WAITING_TIME);
}

function SetGameMode() {
    stateProp.Value = GameStateValue;
    Ui.GetContext().Hint.Value = "Hint/Survive";
    Spawns.GetContext().enable = true;
    mainTimer.Restart(MATCH_DURATION_SECONDS);
    SpawnAllTeams();
}

function checkRoundEnd() {
    const redLeft = redTeam.Players ? redTeam.Players.length : 0;
    const blueLeft = blueTeam.Players ? blueTeam.Players.length : 0;
    if (redLeft === 0 && blueLeft === 0) {
        Ui.GetContext().Hint.Value = "Hint/AllInfected";
        SetEndOfMatch();
    }
}

function SetEndOfMatch() {
    if (stateProp.Value === EndOfMatchStateValue) return;
    stateProp.Value = EndOfMatchStateValue;
    Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

    var spawns = Spawns.GetContext();
    spawns.enable = false;

    const redScore = redTeam.Properties.Get(SCORES_PROP_NAME).Value;
    const blueScore = blueTeam.Properties.Get(SCORES_PROP_NAME).Value;

    if (redScore === blueScore) {
        Game.GameOver([redTeam, blueTeam]); // ничья
    } else {
        Game.GameOver(redScore > blueScore ? redTeam : blueTeam);
    }

    mainTimer.Restart(END_OF_MATCH_TIME);
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
    NewGameVote.Start(variants, VOTE_TIME);
}

function SpawnAllTeams() {
    for (const team of Teams) Spawns.GetContext(team).Spawn();
}
