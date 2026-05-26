// SVG share card generator
export function renderCard(report) {
  const { auraScore, developerType, badges, evidences } = report;
  const aiAgents = evidences.filter(e => e.category === 'ai-agent' && Object.values(e.metrics).some(m => m.status !== 'not_detected'));
  const mainWeapon = aiAgents.length ? aiAgents[0].source : 'None';
  const secondaryWeapon = aiAgents.length >= 2 ? aiAgents[1].source : '';
  const specialSkill = badges.length ? badges[0].label : 'None';
  const weakness = findWeakness(report);

  const username = process.env.USER || 'Developer';
  const scoreColor = auraScore >= 80 ? '#4ade80' : auraScore >= 55 ? '#facc15' : '#f87171';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#a78bfa"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="480" height="320" rx="16" fill="url(#bg)"/>
  <rect x="0" y="0" width="480" height="3" rx="1" fill="url(#accent)"/>

  <!-- DevAura badge -->
  <rect x="24" y="20" width="80" height="24" rx="12" fill="#6366f1" opacity="0.8"/>
  <text x="64" y="36" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="11" font-weight="600">DevAura</text>

  <!-- Username -->
  <text x="24" y="72" fill="#f1f5f9" font-family="system-ui,sans-serif" font-size="18" font-weight="700">${esc(username)}</text>

  <!-- Developer Type -->
  <text x="24" y="96" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="14">${esc(developerType.type)}</text>

  <!-- Aura Score -->
  <text x="24" y="148" fill="${scoreColor}" font-family="system-ui,sans-serif" font-size="48" font-weight="800">${auraScore}</text>
  <text x="24" y="168" fill="#64748b" font-family="system-ui,sans-serif" font-size="13">/100 Aura Score</text>

  <!-- Rank -->
  <rect x="130" y="130" width="70" height="24" rx="12" fill="#1e293b"/>
  <text x="165" y="146" text-anchor="middle" fill="#a78bfa" font-family="system-ui,sans-serif" font-size="11" font-weight="600">${esc(developerType.rank)}</text>

  <!-- Stats -->
  <text x="24" y="210" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Main Weapon: <tspan fill="#f1f5f9">${esc(mainWeapon)}</tspan></text>
  ${secondaryWeapon ? `<text x="24" y="230" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Secondary: <tspan fill="#f1f5f9">${esc(secondaryWeapon)}</tspan></text>` : ''}
  <text x="24" y="${secondaryWeapon ? 250 : 230}" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Special Skill: <tspan fill="#f1f5f9">${esc(specialSkill)}</tspan></text>
  ${weakness ? `<text x="24" y="${secondaryWeapon ? 270 : 250}" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">Weakness: <tspan fill="#facc15">${esc(weakness)}</tspan></text>` : ''}

  <!-- Badges -->
  ${badges.length ? `
  <line x1="24" y1="${secondaryWeapon ? 290 : 270}" x2="456" y2="${secondaryWeapon ? 290 : 270}" stroke="#1e293b" stroke-width="1"/>
  <text x="24" y="${secondaryWeapon ? 308 : 288}" fill="#64748b" font-family="system-ui,sans-serif" font-size="11">${badges.slice(0, 5).map(b => `${b.icon} ${b.label}`).join('  ·  ')}</text>
  ` : ''}

  <!-- Footer -->
  <text x="456" y="308" text-anchor="end" fill="#475569" font-family="system-ui,sans-serif" font-size="10">your dev machine tells the truth</text>
</svg>`;
}

function findWeakness(report) {
  const dims = report.dimensions;
  let weakest = null;
  let lowestScore = 100;
  for (const [id, ds] of Object.entries(dims)) {
    if (ds.status === 'scored' && ds.score < lowestScore) {
      lowestScore = ds.score;
      weakest = id;
    }
  }
  const labels = { envHealth: 'Environment Setup', aiWorkflow: 'AI Workflow', toolchainDepth: 'Toolchain Depth', verification: 'Test Verification', automation: 'Automation', security: 'Security Hygiene' };
  return lowestScore < 50 ? (labels[weakest] || weakest) : null;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
