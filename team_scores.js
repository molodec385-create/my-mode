export const TEAM_SCORES_MUL = 0.08;
export const SCORES_PROP_NAME = "Scores";

export function addTeamScores(team, score) {
    if (!team) return;
    let scaled = Math.round(score * TEAM_SCORES_MUL);
    team.Properties.Scores.Value += scaled;
}
