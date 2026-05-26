// Environment scanner — runtime, infra, IDE, shell detection
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { makeEvidence, makeMetric, STATUS, CONFIDENCE } from '../core/evidence.js';

const HOME = homedir();
const isMac = platform() === 'darwin';

function run(cmd) {
  try { return execSync(cmd, { timeout: 5000, encoding: 'utf8' }).trim(); } catch { return ''; }
}

function detectVersion(cmd, versionFlag) {
  // Try multiple version flag variants
  const flags = versionFlag ? [versionFlag] : ['--version', '-version', 'version'];
  for (const f of flags) {
    const out = run(`${cmd} ${f} 2>/dev/null`);
    if (out) {
      const match = out.match(/(\d+\.\d+[\.\d]*)/);
      if (match) return match[1];
    }
  }
  return '';
}

// ── Node.js ──────────────────────────────
export function scanNode() {
  const version = detectVersion('node');
  const npmV = detectVersion('npm');
  const pnpmV = detectVersion('pnpm');
  const yarnV = detectVersion('yarn');
  const bunV = detectVersion('bun');

  const pkgMgrs = [npmV && 'npm', pnpmV && 'pnpm', yarnV && 'yarn', bunV && 'bun'].filter(Boolean);

  return makeEvidence('node', 'Node.js', 'runtime', version ? 'config' : 'detect', {
    nodeDetected: makeMetric('nodeDetected', 'Node.js', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    langVersions: makeMetric('langVersions', 'Version signals', { value: version ? 1 : 0, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    pkgManagerDetected: makeMetric('pkgManagerDetected', 'Package managers', { value: pkgMgrs.length > 0, status: pkgMgrs.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: pkgMgrs }),
  });
}

// ── Python ──────────────────────────────
export function scanPython() {
  const version = detectVersion('python3') || detectVersion('python');
  const pipV = run('pip3 --version 2>/dev/null || pip --version 2>/dev/null');
  const uvV = detectVersion('uv');
  const condaV = detectVersion('conda');

  const tools = [pipV && 'pip', uvV && 'uv', condaV && 'conda'].filter(Boolean);

  return makeEvidence('python', 'Python', 'runtime', version ? 'config' : 'detect', {
    pythonDetected: makeMetric('pythonDetected', 'Python', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    pkgManagerDetected: makeMetric('pkgManagerDetected', 'Package managers', { value: tools.length > 0, status: tools.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: tools }),
  });
}

// ── Go ──────────────────────────────────
export function scanGo() {
  const version = detectVersion('go', 'version');
  return makeEvidence('go', 'Go', 'runtime', version ? 'config' : 'detect', {
    goDetected: makeMetric('goDetected', 'Go', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
  });
}

// ── Rust ─────────────────────────────────
export function scanRust() {
  const version = detectVersion('rustc');
  const cargoV = detectVersion('cargo');
  return makeEvidence('rust', 'Rust', 'runtime', version ? 'config' : 'detect', {
    rustDetected: makeMetric('rustDetected', 'Rust', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    pkgManagerDetected: makeMetric('pkgManagerDetected', 'Cargo', { value: !!cargoV, status: cargoV ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

// ── Java ─────────────────────────────────
export function scanJava() {
  const version = detectVersion('java');
  const mvnV = detectVersion('mvn');
  const gradleV = detectVersion('gradle');
  return makeEvidence('java', 'Java', 'runtime', version ? 'config' : 'detect', {
    javaDetected: makeMetric('javaDetected', 'Java', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    pkgManagerDetected: makeMetric('pkgManagerDetected', 'Build tools', {
      value: !!(mvnV || gradleV),
      status: (mvnV || gradleV) ? STATUS.EVALUATED : STATUS.NOT_DETECTED,
      confidence: CONFIDENCE.HIGH,
      evidence: [mvnV && 'Maven', gradleV && 'Gradle'].filter(Boolean),
    }),
  });
}

// ── Docker ───────────────────────────────
export function scanDocker() {
  const version = detectVersion('docker');
  const composeV = detectVersion('docker-compose') || run('docker compose version 2>/dev/null');
  return makeEvidence('docker', 'Docker', 'infra', version ? 'config' : 'detect', {
    dockerDetected: makeMetric('dockerDetected', 'Docker', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    automationConfigs: makeMetric('automationConfigs', 'Docker Compose', { value: !!composeV, status: composeV ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

// ── Git ──────────────────────────────────
export function scanGit() {
  const version = detectVersion('git');
  const ghV = detectVersion('gh');
  const hasGitconfig = existsSync(join(HOME, '.gitconfig'));

  return makeEvidence('git', 'Git', 'infra', version ? 'config' : 'detect', {
    gitDetected: makeMetric('gitDetected', 'Git', { value: !!version, status: version ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: version ? [`v${version}`] : [] }),
    globalConfigs: makeMetric('globalConfigs', 'Global config', { value: hasGitconfig, status: hasGitconfig ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
    automationConfigs: makeMetric('automationConfigs', 'GitHub CLI', { value: !!ghV, status: ghV ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH }),
  });
}

// ── Shell ────────────────────────────────
export function scanShell() {
  const shell = process.env.SHELL || '';
  const shellName = shell.split('/').pop() || 'unknown';

  const hasZshrc = existsSync(join(HOME, '.zshrc'));
  const hasBashrc = existsSync(join(HOME, '.bashrc'));
  const hasProfile = hasZshrc || hasBashrc || existsSync(join(HOME, '.bash_profile'));

  // Detect shell frameworks
  const frameworks = [];
  if (existsSync(join(HOME, '.oh-my-zsh'))) frameworks.push('oh-my-zsh');
  if (existsSync(join(HOME, '.p10k.zsh'))) frameworks.push('powerlevel10k');
  if (existsSync(join(HOME, '.starship.toml'))) frameworks.push('starship');
  if (run('which tmux 2>/dev/null')) frameworks.push('tmux');
  if (run('which zoxide 2>/dev/null')) frameworks.push('zoxide');
  if (run('which direnv 2>/dev/null')) frameworks.push('direnv');
  if (run('which fzf 2>/dev/null')) frameworks.push('fzf');
  if (run('which eza 2>/dev/null') || run('which exa 2>/dev/null')) frameworks.push('eza/exa');
  if (run('which bat 2>/dev/null')) frameworks.push('bat');
  if (run('which fd 2>/dev/null')) frameworks.push('fd');
  if (run('which rg 2>/dev/null')) frameworks.push('ripgrep');
  if (run('which btop 2>/dev/null') || run('which htop 2>/dev/null')) frameworks.push('btop/htop');

  return makeEvidence('shell', 'Shell', 'shell', 'config', {
    shellProfileDetected: makeMetric('shellProfileDetected', 'Shell profile', { value: hasProfile, status: hasProfile ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: [shellName] }),
    terminalDetected: makeMetric('terminalDetected', 'Terminal tools', { value: frameworks.length > 0, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH, evidence: frameworks }),
    shellPlugins: makeMetric('shellPlugins', 'Shell enhancements', { value: frameworks.length, status: STATUS.EVALUATED, confidence: CONFIDENCE.HIGH, evidence: frameworks }),
  });
}

// ── IDE ──────────────────────────────────
export function scanIDE() {
  const ides = [];

  // Cursor
  const cursorApp = isMac ? '/Applications/Cursor.app' : '/usr/bin/cursor';
  if (existsSync(cursorApp)) ides.push('Cursor');

  // VS Code
  const vscodeApp = isMac ? '/Applications/Visual Studio Code.app' : '/usr/bin/code';
  if (existsSync(vscodeApp)) ides.push('VS Code');

  // JetBrains — look for Toolbox or common apps
  const jetbrainsApps = ['IntelliJ', 'WebStorm', 'GoLand', 'PyCharm', 'CLion', 'RustRover'];
  for (const app of jetbrainsApps) {
    if (isMac && existsSync(`/Applications/${app}.app`)) ides.push(app);
  }

  // Zed
  if (isMac && existsSync('/Applications/Zed.app')) ides.push('Zed');

  // Neovim/Vim
  if (run('which nvim 2>/dev/null')) ides.push('Neovim');
  else if (run('which vim 2>/dev/null')) ides.push('Vim');

  // Windsurf
  const windsurfApp = isMac ? '/Applications/Windsurf.app' : null;
  if (windsurfApp && existsSync(windsurfApp)) ides.push('Windsurf');

  // Sublime
  const sublimeApp = isMac ? '/Applications/Sublime Text.app' : null;
  if (sublimeApp && existsSync(sublimeApp)) ides.push('Sublime Text');

  return makeEvidence('ide', 'IDE', 'ide', ides.length ? 'config' : 'detect', {
    ideDetected: makeMetric('ideDetected', 'IDEs detected', { value: ides.length > 0, status: ides.length ? STATUS.EVALUATED : STATUS.NOT_DETECTED, confidence: CONFIDENCE.HIGH, evidence: ides }),
  });
}

// ── Aggregate env scanner ───────────────
export function scanEnvironment() {
  const envScanners = [scanNode, scanPython, scanGo, scanRust, scanJava, scanDocker, scanGit, scanShell, scanIDE];
  return envScanners.map(fn => fn()).filter(e => e.depth !== 'detect' || e.category === 'shell' || e.category === 'ide');
}
