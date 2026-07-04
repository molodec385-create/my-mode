import { DisplayValueHeader } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';
const { 
    room, Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, 
    Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, 
    TeamsBalancer, MapEditor, ScoreInfo, NewGame, NewGameVote 
} = room_lib;

import * as vote_types from 'pixel_combats/types/new_game_vote';
import * as teams from './default_teams.js';

room.PopupsEnable = true;

// Тайминги стандартных фаз
const WaitingTime = 5;
const PrepTime = 10;
const EndTime = 8;
const VoteTime = 10;

const StateWaiting = "Waiting";
const StatePrep = "Preparation";
const StateBattle = "MainLoop";
const StateEnd = "End";

const KILLS_PROP = "Kills";
const SCORES_PROP = "Scores";

const mainTimer = Timers.GetContext().Get("Main");
const stateProp = Properties.GetContext().Get("State");

// --- Чтение и скрещивание параметров ---
const ParamTDM = GameMode.Parameters.GetBool("EnableTDM");
const ParamPeace = GameMode.Parameters.GetBool("EnablePeace");
const ParamEditor = GameMode.Parameters.GetBool("EnableEditor");

const MapRotation = GameMode.Parameters.GetBool("MapRotation");
const ParamFriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
const ParamInfAmmo = GameMode.Parameters.GetBool("InfAmmo");
const ParamInfBlocks = GameMode.Parameters.GetBool("InfBlocks");
const ParamFallDamage = GameMode.Parameters.GetBool("FallDamage");

const ParamBaseHP = GameMode.Parameters.GetInt("BaseHP");
const ParamBuildSpeed = GameMode.Parameters.GetInt("BuildSpeed");
const ParamRespawnDelay = GameMode.Parameters.GetInt("RespawnDelay");

const ParamGravity = GameMode.Parameters.GetFloat("CustomGravity");
const ParamSpeedMult = GameMode.Parameters.GetFloat("SpeedMultiplier");

// Настройка физики блоков (Editor/TDM гибрид)
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");
// Если включен режим Редактора — разрешаем ломать абсолютно всё с одного удара
BreackGraph.BreackAll = true; 
BreackGraph.PlayerBlockBoost = ParamEditor; 

// Инициализация глобальных правил урона
// Если включен Peace — полностью отрубаем получение и выдачу урона на уровне ядра
Damage.GetContext().DamageOut.Value = !ParamPeace;
Damage.GetContext().FriendlyFire.Value = ParamFriendlyFire;
Damage.GetContext().FallDamage.Value = ParamFallDamage && !ParamPeace;

// Создание команд (Амальгама TDM и Peace)
const teamBlue = teams.create_surv_team(); // Синие
const teamRed = teams.create_zombie_team(); // Красные

// Если включен Editor — даем командам доступ к полным наборам блоков разработчиков
if (ParamEditor) {
    teamBlue.Build.BlocksSet.Value = BuildBlocksSet.AllClear;
    teamRed.Build.BlocksSet.Value = BuildBlocksSet.AllClear;
} else {
    teamBlue.Build.BlocksSet.Value = BuildBlocksSet.Blue;
    teamRed.Build.BlocksSet.Value = BuildBlocksSet.Red;
}

// Настройка лидерборда (актуально, если активна TDM логика)
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader(KILLS_PROP, "Statistics/Kills", "Statistics/KillsShort"),
    new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
    new DisplayValueHeader(SCORES_PROP, "Statistics/Scores", "Statistics/ScoresShort")
];
LeaderBoard.PlayersWeightGetter.Set(function(p) { return p.Properties.Get(SCORES_PROP).Value; });
LeaderBoard.TeamWeightGetter.Set(function(t) { return t.Properties.Get(SCORES_PROP).Value; });

// Интерфейс вывода очков
Ui.GetContext().TeamProp1.Value = { Team: teams.SURVIVORS_TEAM_NAME, Prop: SCORES_PROP };
Ui.GetContext().TeamProp2.Value = { Team: teams.ZOMBIES_TEAM_NAME, Prop: SCORES_PROP };
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
Ui.ScoresTopViewEnable = ParamTDM; // Прячем или показываем счет в зависимости от TDM

// Автобаланс нужен только если мы воюем в TDM
TeamsBalancer.IsAutoBalance = ParamTDM && !ParamPeace;

Teams.OnRequestJoinTeam.Add(function(player, team) {
    // Распределяем игроков по командам равномерно
    if (teamBlue.Players.length <= teamRed.Players.length) {
        teamBlue.Add(player);
    } else {
        teamRed.Add(player);
    }
});

Teams.OnPlayerChangeTeam.Add(function(player) {
    configure_amalgam_loadout(player);
    player.Spawns.Spawn();
});

// Ультимативный конфигуратор инвентаря и возможностей под Амальгаму параметров
function configure_amalgam_loadout(player) {
    const inv = player.Inventory;
    
    // Применение общих физических параметров
    player.ContextedProperties.MaxHp.Value = ParamBaseHP;
    player.ContextedProperties.Hp.Value = ParamBaseHP;
    player.ContextedProperties.BuildSpeed.Value = ParamBuildSpeed;
    player.ContextedProperties.Gravity.Value = ParamGravity;
    player.ContextedProperties.Speed.Value = 13 * ParamSpeedMult;
    
    // Логика PEACE + EDITOR: разрешаем летать всем без исключения, если тумблеры активны
    if (ParamPeace || ParamEditor) {
        player.Build.FlyEnable.Value = true;
    } else {
        player.Build.FlyEnable.Value = false;
    }
    
    // Конфиг оружия и инструментов
    inv.Main.Value = !ParamPeace;      // В мирном режиме пушки не нужны
    inv.Secondary.Value = !ParamPeace; 
    inv.Melee.Value = true;            // Нож/кирка активны всегда (для Editor режима)
    inv.Explosive.Value = !ParamPeace;
    inv.Build.Value = true;            // Строительство разрешено всегда
    
    // Бесконечность ресурсов
    inv.MainInfinity.Value = ParamInfAmmo;
    inv.SecondaryInfinity.Value = ParamInfAmmo;
    inv.BuildInfinity.Value = ParamInfBlocks;
}

// Обработка смертей (Активно, если Peace выключен, а TDM включен)
Damage.OnDeath.Add(function(player) {
    ++player.Properties.Deaths.Value;
    
    // Мгновенный спавн обратно в свою команду
    Spawns.GetContext(player).Spawn();
});

Damage.OnKillReport.Add(function(victim, killer, report) {
    if (stateProp.Value !== StateBattle || !ParamTDM) return;
    if (!killer || !victim) return;
    
    // Логика начисления очков за убийства (классический TDM)
    if (killer.Team !== victim.Team) {
        ++killer.Properties.Get(KILLS_PROP).Value;
        killer.Properties.Get(SCORES_PROP).Value += 100;
        killer.Team.Properties.Get(SCORES_PROP).Value += 10;
        
        ScoreInfo.Show(killer, {
            Type: 2, 
            WeaponId: report.KillHit ? report.KillHit.WeaponID : 0, 
            Scores: 100, 
            IsHeadshot: !!(report.KillHit && report.KillHit.IsHeadShot === true)
        });
    } else {
        // Тимкилл при Friendly Fire карается штрафом
        killer.Properties.Get(SCORES_PROP).Value -= 200;
        ScoreInfo.Show(killer, { Type: 2, WeaponId: 0, Scores: -200, IsHeadshot: false });
    }
});

// Бонусы за строительство / снос блоков (Актуально для Editor и TDM)
MapEditor.OnMapEdited.Add(function(player, details) {
    if (stateProp.Value !== StateBattle || !player || !details || !details.MapChange) return;
    
    // Если это TDM/Editor и игрок ломает блоки вражеской базы — даем символические очки
    if (ParamTDM && details.MapChange.BlockId === 0) {
        player.Properties.Get(SCORES_PROP).Value += 5;
        ScoreInfo.Show(player, { Type: 5, WeaponId: 0, Scores: 5, IsHeadshot: false });
    }
});

// Управление бесконечным циклом фаз
mainTimer.OnTimer.Add(function() {
    switch (stateProp.Value) {
        case StateWaiting:
            SetPrepMode();
            break;
        case StatePrep:
            SetBattleMode();
            break;
        case StateBattle:
            SetEndMode();
            break;
        case StateEnd:
            start_vote();
            break;
    }
});

// Запуск игрового автомата
SetWaitingMode();

function SetWaitingMode() {
    stateProp.Value = StateWaiting;
    Ui.GetContext().Hint.Value = "Ожидание подключения Амальгамы...";
    Spawns.GetContext().enable = false;
    mainTimer.Restart(WaitingTime);
}

function SetPrepMode() {
    if (Players.All.length === 0) {
        mainTimer.Restart(WaitingTime);
        return;
    }
    
    stateProp.Value = StatePrep;
    Ui.GetContext().Hint.Value = "Синхронизация параметров...";
    Spawns.GetContext().RespawnTime.Value = ParamRespawnDelay;
    Spawns.GetContext().enable = true;
    
    mainTimer.Restart(PrepTime);
}

function SetBattleMode() {
    stateProp.Value = StateBattle;
    Ui.GetContext().Hint.Value = "Матч начался! Конфигурация применена.";
    
    // Рассчитываем время раунда
    mainTimer.Restart(300); // 5 минут на раунд песочницы
}

function SetEndMode() {
    stateProp.Value = StateEnd;
    Ui.GetContext().Hint.Value = "Раунд завершен";
    
    Spawns.GetContext().enable = false;
    Spawns.GetContext().Despawn();
    
    Game.GameOver(LeaderBoard.GetTeams());
    mainTimer.Restart(EndTime);
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
    if (MapRotation) variants.push(new vote_types.FromOfficialMapLists(3));
    NewGameVote.Start(variants, VoteTime);
}
