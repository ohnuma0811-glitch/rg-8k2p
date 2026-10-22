// レース中の表示（スピード計など）

// スピード計は、速く見えるよう実際の1.5倍で出す（最高速 時速約148km → 221 と表示。表示だけで、車の速さは変えない）
export const SPEED_SHOW = 1.5;

// スピード計の数字: m/s を km/h の整数（1.5倍）にして、3けた（足りない所は空白）
export function speedText(mps) {
  const kmh = Math.min(999, Math.round(Math.abs(mps) * 3.6 * SPEED_SHOW));
  return String(kmh).padStart(3, ' ');
}

// アイテムの枠（上の真ん中）に出す絵の名前。ルーレットの間はくるくる変わる。何もないときは null
export const ROULETTE_ORDER = ['mushroom', 'banana', 'shell', 'star', 'green', 'lightning'];
export function slotItem(kart) {
  if (kart.roulette > 0) return ROULETTE_ORDER[Math.floor(kart.roulette * 12) % ROULETTE_ORDER.length];
  // キノコは残りの数の絵（3個セット。2026-10-22 のユーザー依頼）
  if (kart.held === 'mushroom' && kart.heldUses > 0 && kart.heldUses < 3) return `mushroom${kart.heldUses}`;
  return kart.held ?? null;
}

// キノコの絵: 1個を (x, y) に大きさ s で
const mush = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-10" y="-2" width="20" height="20" rx="6" fill="#f3dfb8" stroke="#222" stroke-width="3"/><path d="M-26 0 A26 26 0 0 1 26 0 Z" fill="#e8312a" stroke="#222" stroke-width="3"/><circle cx="-10" cy="-12" r="5" fill="#fff"/><circle cx="8" cy="-16" r="6" fill="#fff"/><circle cx="18" cy="-5" r="3.5" fill="#fff"/></g>`;
const mushSvg = (...gs) => `<svg viewBox="0 0 64 64">${gs.join('')}</svg>`;

// アイテムの絵（自分たちで描いた形。任天堂の絵はまねない）
export const ITEM_ICONS = {
  mushroom: mushSvg(mush(32, 24, 0.5), mush(18, 44, 0.5), mush(46, 44, 0.5)), // 3個セット
  mushroom2: mushSvg(mush(19, 38, 0.55), mush(45, 38, 0.55)),
  mushroom1: mushSvg(mush(32, 36, 0.9)),
  banana: '<svg viewBox="0 0 64 64"><rect x="28" y="4" width="8" height="8" rx="2" fill="#6b4a00"/><path d="M25 12 L39 12 L42 30 L22 30 Z" fill="#ffd93b" stroke="#6b4a00" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 28 C14 36 8 46 6 58 L14 58 C16 48 22 40 28 32 Z M42 28 C50 36 56 46 58 58 L50 58 C48 48 42 40 36 32 Z M28 30 C26 42 24 50 22 60 L30 60 C31 50 32 42 32 32 Z M36 30 C38 42 40 50 42 60 L34 60 C33 50 32 42 32 32 Z" fill="#ffd93b" stroke="#6b4a00" stroke-width="2.5" stroke-linejoin="round"/></svg>', // 皮だけを逆さにして立てたバナナ（2026-10-23 のユーザー依頼）
  shell: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="44" rx="26" ry="8" fill="#fff" stroke="#222" stroke-width="3"/><path d="M8 42 A24 22 0 0 1 56 42 Z" fill="#e8312a" stroke="#222" stroke-width="3"/><path d="M24 26 L32 20 L40 26 L37 36 L27 36 Z" fill="#ff8a7a"/></svg>',
  green: '<svg viewBox="0 0 64 64"><ellipse cx="28" cy="46" rx="22" ry="7" fill="#fff" stroke="#222" stroke-width="3"/><path d="M8 44 A20 19 0 0 1 48 44 Z" fill="#2fb54a" stroke="#222" stroke-width="3"/><text x="62" y="24" font-size="20" font-weight="bold" text-anchor="end" fill="#fff" stroke="#222" stroke-width="1">×3</text></svg>',
  star: '<svg viewBox="0 0 64 64"><path d="M32 4 L40 23 L60 24 L44 37 L50 58 L32 46 L14 58 L20 37 L4 24 L24 23 Z" fill="#ffd400" stroke="#8a5a00" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="30" r="3" fill="#222"/><circle cx="38" cy="30" r="3" fill="#222"/></svg>',
  lightning: '<svg viewBox="0 0 64 64"><path d="M38 4 L14 36 L30 36 L24 60 L50 26 L34 26 Z" fill="#ffe14a" stroke="#7a5a00" stroke-width="3" stroke-linejoin="round"/></svg>',
};
