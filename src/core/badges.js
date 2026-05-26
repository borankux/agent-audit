// Badge system

export function computeBadges(dimScores, evidences) {
  const badges = [];
  const ai = dimScores.aiWorkflow?.score || 0;
  const env = dimScores.envHealth?.score || 0;
  const tc = dimScores.toolchainDepth?.score || 0;
  const ver = dimScores.verification?.score || 0;
  const auto = dimScores.automation?.score || 0;
  const sec = dimScores.security?.score || 0;

  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && e.depth !== 'detect');
  const runtimes = evidences.filter(e => e.category === 'runtime');

  // AI badges
  if (ai >= 70) badges.push({ id: 'ai_native', label: 'AI-Native Builder', icon: '🤖' });
  if (aiAgents.length >= 3) badges.push({ id: 'multi_agent', label: 'Multi-Agent User', icon: '🎯' });
  if (aiAgents.length >= 5) badges.push({ id: 'agent_explorer', label: 'Agent Explorer', icon: '🚀' });

  // Environment badges
  if (runtimes.length >= 4) badges.push({ id: 'fullstack_env', label: 'Fullstack Environment', icon: '🏗' });
  if (env >= 80) badges.push({ id: 'env_master', label: 'Environment Master', icon: '💎' });

  // Toolchain badges
  if (tc >= 70) badges.push({ id: 'toolchain_pro', label: 'Toolchain Pro', icon: '🔧' });
  const mcpCount = evidences.reduce((s, e) => s + (e.metrics?.mcpServers?.value || 0), 0);
  if (mcpCount >= 3) badges.push({ id: 'mcp_explorer', label: 'MCP Explorer', icon: '🔌' });

  // Terminal badges
  const shellEv = evidences.find(e => e.category === 'shell');
  if (shellEv?.metrics?.shellPlugins?.value >= 3)
    badges.push({ id: 'terminal_heavy', label: 'Terminal Heavy User', icon: '⌨' });

  // Verification badges
  if (ver >= 60) badges.push({ id: 'verified', label: 'Test-Driven', icon: '✅' });
  if (ver < 30 && ai >= 50) badges.push({ id: 'needs_tests', label: 'Needs More Tests', icon: '⚠' });

  // Automation badges
  if (auto >= 60) badges.push({ id: 'automator', label: 'Automation Pro', icon: '⚡' });

  // Security badges
  if (sec >= 80) badges.push({ id: 'security_aware', label: 'Security Conscious', icon: '🔒' });

  return badges;
}
