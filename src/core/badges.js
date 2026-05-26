// Badge system with rarity tiers

const RARITY = {
  LEGENDARY: { label: 'Legendary', color: '#f59e0b', glow: '0 0 12px rgba(245,158,11,.5)' },
  EPIC:      { label: 'Epic',      color: '#a78bfa', glow: '0 0 10px rgba(167,139,250,.4)' },
  RARE:      { label: 'Rare',      color: '#22d3ee', glow: '0 0 8px rgba(34,211,238,.3)' },
  COMMON:    { label: 'Common',    color: '#64748b', glow: 'none' },
};

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

  if (ai >= 70) badges.push({ id: 'ai_native', label: 'AI-Native Builder', icon: '🤖', rarity: RARITY.LEGENDARY });
  if (aiAgents.length >= 3) badges.push({ id: 'multi_agent', label: 'Multi-Agent User', icon: '🎯', rarity: RARITY.RARE });
  if (aiAgents.length >= 5) badges.push({ id: 'agent_explorer', label: 'Agent Explorer', icon: '🚀', rarity: RARITY.RARE });

  if (runtimes.length >= 4) badges.push({ id: 'fullstack_env', label: 'Fullstack Environment', icon: '🏗', rarity: RARITY.EPIC });
  if (env >= 80) badges.push({ id: 'env_master', label: 'Environment Master', icon: '💎', rarity: RARITY.EPIC });

  if (tc >= 70) badges.push({ id: 'toolchain_pro', label: 'Toolchain Pro', icon: '🔧', rarity: RARITY.EPIC });
  const mcpCount = evidences.reduce((s, e) => s + (e.metrics?.mcpServers?.value || 0), 0);
  if (mcpCount >= 3) badges.push({ id: 'mcp_explorer', label: 'MCP Explorer', icon: '🔌', rarity: RARITY.RARE });

  const shellEv = evidences.find(e => e.category === 'shell');
  if (shellEv?.metrics?.shellPlugins?.value >= 3)
    badges.push({ id: 'terminal_heavy', label: 'Terminal Heavy User', icon: '⌨', rarity: RARITY.COMMON });

  if (ver >= 60) badges.push({ id: 'verified', label: 'Test-Driven', icon: '✅', rarity: RARITY.RARE });
  if (ver < 30 && ai >= 50) badges.push({ id: 'needs_tests', label: 'Needs More Tests', icon: '⚠', rarity: RARITY.EPIC });

  if (auto >= 60) badges.push({ id: 'automator', label: 'Automation Pro', icon: '⚡', rarity: RARITY.COMMON });

  if (sec >= 80) badges.push({ id: 'security_aware', label: 'Security Conscious', icon: '🔒', rarity: RARITY.RARE });

  return badges;
}
