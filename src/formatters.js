export function fmtTok(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function gradeColor(g) {
  if (g === "A+" || g === "A") return "\x1b[32m";
  if (g === "B+" || g === "B") return "\x1b[33m";
  return "\x1b[31m";
}

export function scoreTag(v, mx = 25) {
  const pct = v / mx;
  if (pct >= 0.7) return "\x1b[32m●\x1b[0m";
  if (pct >= 0.4) return "\x1b[33m◐\x1b[0m";
  return "\x1b[31m○\x1b[0m";
}

export function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
