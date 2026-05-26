export function computeScore(cfg, ses) {
  const scores = {};
  const details = {};

  // Config (max 25)
  let pts = 0;
  const dd = [];
  if (cfg.hasCustomInstructions) { pts += 3; dd.push(['Custom instructions file', 3]); }
  if (cfg.customInstructionsSize > 500) { pts += 2; dd.push(['Detailed instructions', 2]); }
  const mc = cfg.mcpServers.length;
  if (mc) { const p = Math.min(mc * 2, 8); pts += p; dd.push([`${mc} MCP servers`, p]); }
  const pc = cfg.plugins.length;
  if (pc) { const p = Math.min(pc * 2, 6); pts += p; dd.push([`${pc} plugins`, p]); }
  const hc = cfg.hooks.length;
  if (hc) { const p = Math.min(hc * 3, 6); pts += p; dd.push([`${hc} hook types`, p]); }
  scores.config = Math.min(pts, 25);
  details.config = dd;

  // Volume (max 25)
  pts = 0;
  const dd2 = [];
  const sc = ses.sessionCount || 0;
  const scPts = sc >= 200 ? 10 : sc >= 50 ? 7 : sc >= 10 ? 4 : Math.min(sc, 2);
  pts += scPts;
  dd2.push([`${sc} sessions`, scPts]);
  const ad = ses.activeDays || 0;
  const adPts = ad >= 20 ? 10 : ad >= 10 ? 7 : ad >= 3 ? 4 : Math.min(ad, 2);
  pts += adPts;
  dd2.push([`${ad} active days`, adPts]);
  const tc = ses.toolCalls || 0;
  const tcPts = tc >= 500 ? 5 : tc >= 100 ? 3 : tc >= 20 ? 1 : 0;
  pts += tcPts;
  dd2.push([`${tc} tool calls`, tcPts]);
  scores.volume = Math.min(pts, 25);
  details.volume = dd2;

  // Diversity (max 25)
  pts = 0;
  const dd3 = [];
  const t = (ses.tools instanceof Set ? ses.tools.size : ses.tools) || 0;
  const tPts = t >= 15 ? 8 : t >= 8 ? 5 : t >= 3 ? 2 : 0;
  pts += tPts;
  dd3.push([`${t} tools`, tPts]);
  const sk = (ses.skills instanceof Set ? ses.skills.size : ses.skills) || 0;
  { const p = Math.min(sk * 2, 6); pts += p; dd3.push([`${sk} skills invoked`, p]); }
  const ag = (ses.agentTypes instanceof Set ? ses.agentTypes.size : ses.agentTypes) || 0;
  { const p = Math.min(ag * 2, 6); pts += p; dd3.push([`${ag} agent types`, p]); }
  const ms = (ses.mcpServers instanceof Set ? ses.mcpServers.size : ses.mcpServers) || 0;
  { const p = Math.min(ms * 2, 5); pts += p; dd3.push([`${ms} MCP servers used`, p]); }
  scores.diversity = Math.min(pts, 25);
  details.diversity = dd3;

  // Sophistication (max 25)
  pts = 0;
  const dd4 = [];
  if (cfg.skills.length) { pts += 5; dd4.push([`${cfg.skills.length} custom skills`, 5]); }
  if (cfg.agents.length) { pts += 5; dd4.push([`${cfg.agents.length} custom agents`, 5]); }
  if (cfg.hooks.length) { pts += 5; dd4.push(['Automated hooks', 5]); }
  if (t >= 8) { pts += 5; dd4.push(['Multi-tool workflow', 5]); }
  else if (t >= 4) { pts += 3; dd4.push(['Multi-tool workflow', 3]); }
  if (ag > 0) { pts += 5; dd4.push(['Agent delegation', 5]); }
  scores.sophistication = Math.min(pts, 25);
  details.sophistication = dd4;

  const total = scores.config + scores.volume + scores.diversity + scores.sophistication;
  return { total, scores, details };
}

export function getLevel(total) {
  for (const [threshold, level, grade] of [
    [90, "Expert Power User", "A+"],
    [80, "Advanced User", "A"],
    [70, "Proficient User", "B+"],
    [55, "Intermediate User", "B"],
    [40, "Casual User", "C"],
    [20, "Beginner", "D"],
    [0, "Not a coding agent user", "F"],
  ]) {
    if (total >= threshold) return { level, grade };
  }
  return { level: "Not a coding agent user", grade: "F" };
}
