// Privacy & redaction system

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,              // API keys
  /key[=:]\s*["']?[a-zA-Z0-9]{20,}/gi, // key=value patterns
  /token[=:]\s*["']?[a-zA-Z0-9]{20,}/gi,
  /password[=:]\s*["']?[^"'\s,}]+/gi,
  /secret[=:]\s*["']?[a-zA-Z0-9]{20,}/gi,
  /Bearer [a-zA-Z0-9._-]+/gi,
  /[a-f0-9]{32,}/g,                    // Hex strings (API keys, hashes)
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, // IP addresses
];

const PATH_REPLACE = (match) => match.replace(/\/Users\/[^/]+\//, '~/').replace(/\/home\/[^/]+\//, '~/');
const USER_REPLACE = (match, user) => match.replace(user, '<user>');

export function redact(obj, options = {}) {
  const { redactPaths = true, redactUser = true, redactSecrets = true } = options;

  const str = JSON.stringify(obj);
  let result = str;

  if (redactPaths) {
    result = result.replace(/\/Users\/[^/]+\//g, '~/');
    result = result.replace(/\/home\/[^/]+\//g, '~/');
    result = result.replace(/C:\\Users\\[^\\]+\\/gi, '~\\');
  }

  if (redactUser) {
    const username = process.env.USER || process.env.USERNAME || '';
    if (username) result = result.replace(new RegExp(username, 'g'), '<user>');
  }

  if (redactSecrets) {
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '<redacted>');
    }
  }

  return JSON.parse(result);
}

export function redactString(text, options = {}) {
  let result = text;
  if (options.redactPaths) {
    result = result.replace(/\/Users\/[^/]+\//g, '~/');
    result = result.replace(/\/home\/[^/]+\//g, '~/');
  }
  if (options.redactUser) {
    const username = process.env.USER || process.env.USERNAME || '';
    if (username) result = result.replace(new RegExp(username, 'g'), '<user>');
  }
  return result;
}

export function explainPaths() {
  const HOME = process.env.HOME || process.env.USERPROFILE || '~';
  return `
Paths that will be scanned:
  ~/.claude/
  ~/.codex/
  ~/.gemini/
  ~/.openclaw/
  ~/.continue/
  ~/.cursor/
  ~/.config/Code/User/settings.json
  ~/.zshrc / ~/.bashrc / ~/.bash_profile
  ~/.gitconfig
  Current project config files

Paths that will NOT be read:
  Source code content
  Conversation text
  Private documents
  Browser history
  Email contents

No data is uploaded. Everything stays on this machine.
`.trim();
}
