export const G = "\x1b[32m";
export const Y = "\x1b[33m";
export const R = "\x1b[31m";
export const C = "\x1b[36m";
export const B = "\x1b[1m";
export const D = "\x1b[2m";
export const W = "\x1b[0m";
export const M = "\x1b[35m";
export const BG = "\x1b[48;5;236m";

export const BOX_TL = "╭";
export const BOX_TR = "╮";
export const BOX_BL = "╰";
export const BOX_BR = "╯";
export const BOX_H = "─";
export const BOX_V = "│";
export const BOX_TE = "├";

export function hr(c = D, w = 58) {
  return `  ${c}${BOX_H.repeat(w)}${W}`;
}

export function kv(k, v, kc = C) {
  return `  ${kc}${k.padEnd(16)}${W} ${v}`;
}
