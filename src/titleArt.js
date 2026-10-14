// タイトル画面の絵: Kyugo（赤い T シャツ、ツンツン頭）と Soki（青い T シャツ、坊ちゃん刈り、前歯が1本ない）
// コースが回っている前、文字のうしろに大きく出す（2026-10-14 のユーザー依頼）

const SKIN = '#f6cfa6';
const LINE = '#3a1a10';

// 顔と首と耳（2人で同じ）。cheeks: ピンクのほっぺ（Kyugo にはつけない: 2026-10-14 のユーザー依頼）
function face(cheeks = true) {
  return `
  <rect x="86" y="160" width="28" height="40" rx="10" fill="${SKIN}" stroke="${LINE}" stroke-width="4"/>
  <circle cx="38" cy="114" r="14" fill="${SKIN}" stroke="${LINE}" stroke-width="4"/>
  <circle cx="162" cy="114" r="14" fill="${SKIN}" stroke="${LINE}" stroke-width="4"/>
  <ellipse cx="100" cy="110" rx="62" ry="64" fill="${SKIN}" stroke="${LINE}" stroke-width="4"/>${
    cheeks
      ? `
  <ellipse cx="62" cy="142" rx="11" ry="7" fill="#ff8a8a" opacity="0.55"/>
  <ellipse cx="138" cy="142" rx="11" ry="7" fill="#ff8a8a" opacity="0.55"/>`
      : ''
  }`;
}

// 目（大きな黒目に、白い光）。Kyugo も Soki も同じかわいい丸い目（2026-10-14 のユーザー依頼）
function eyes(y) {
  return [76, 124]
    .map((x) => `
  <ellipse cx="${x}" cy="${y}" rx="9" ry="12" fill="#1b1b22"/>
  <circle cx="${x + 3}" cy="${y - 4}" r="3.6" fill="#fff"/>
  <circle cx="${x - 3}" cy="${y + 4}" r="1.6" fill="#fff"/>`)
    .join('');
}

// T シャツ（肩と胸）
function shirt(color, dark) {
  return `
  <path d="M22 262 C24 222 52 198 100 198 C148 198 176 222 178 262 Z" fill="${color}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M78 199 Q100 222 122 199" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>`;
}

// 切り抜き（clipPath）の id は、絵ごとに変える（同じ id がいくつもあると、隠れている方を使われて歯がはみ出す）
let clipNo = 0;

// cls と viewBox を変えて、タイトルの大きな絵にも、レース中の顔のアイコンにも使う
const KYUGO = (cls, box) => `
<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${shirt('#d7261b', '#9e160e')}
  ${face(false)}
  <path d="M36 102 L18 72 L42 70 L32 34 L60 46 L66 4 L88 36 L104 -6 L118 34 L144 8 L146 46 L178 34 L162 70 L184 78 L164 102
           C150 76 130 66 100 66 C70 66 50 76 36 102 Z"
        fill="#1d1d24" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M72 24 L86 44 M108 12 L114 36 M140 24 L140 46" stroke="#4a4a5a" stroke-width="4" stroke-linecap="round"/>
  <path d="M58 95 L92 107 M142 95 L108 107" stroke="#1d1d24" stroke-width="8" stroke-linecap="round"/>
  ${eyes(124)}
  <path d="M76 148 Q100 176 124 148 Z" fill="#7a1f1f" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M80 149 L120 149 L118 155 L82 155 Z" fill="#fff"/>
  <ellipse cx="100" cy="163" rx="10" ry="4.5" fill="#e0605a"/>
</svg>`;

const SOKI = (cls, box, clip = `soki-mouth-${++clipNo}`) => `
<svg class="${cls}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="${clip}"><path d="M72 142 Q100 182 128 142 Z"/></clipPath>
  </defs>
  ${shirt('#2a62c9', '#173f8a')}
  ${face()}
  <path d="M32 122 C24 52 64 28 100 28 C136 28 176 52 168 122 L158 122 L154 94 L46 94 L42 122 Z"
        fill="#2b1d16" stroke="#000" stroke-width="3" stroke-linejoin="round"/>
  <path d="M60 50 Q100 30 140 50" fill="none" stroke="#6b5040" stroke-width="6" stroke-linecap="round"/>
  <path d="M58 104 Q74 98 88 104 M112 104 Q126 98 142 104" fill="none" stroke="#2b1d16" stroke-width="5" stroke-linecap="round"/>
  ${eyes(124)}
  <path d="M72 142 Q100 182 128 142 Z" fill="#7a1f1f" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
  <g clip-path="url(#${clip})">
    <rect x="70" y="141" width="60" height="11" fill="#fff"/>
    <rect x="100.5" y="140" width="10" height="13" fill="#7a1f1f"/>
    <path d="M90 141 L90 152 M120 141 L120 151" stroke="#d9d0c8" stroke-width="1.5"/>
    <ellipse cx="100" cy="166" rx="13" ry="6" fill="#e0605a"/>
  </g>
</svg>`;

const HERO_BOX = '0 -12 200 274';
const FACE_BOX = '18 36 164 164'; // 顔だけ。顔の真ん中（目と口のあたり）が、丸のアイコンの真ん中に来る

export const TITLE_ART = `<div class="hero" aria-hidden="true">${KYUGO('hero-kid kyugo', HERO_BOX)}${SOKI('hero-kid soki', HERO_BOX)}</div>`;

// レース中の上位3人の、顔のアイコン（character: 'kyugo' / 'soki'）
export function faceSvg(character) {
  return character === 'soki' ? SOKI('face-svg', FACE_BOX) : KYUGO('face-svg', FACE_BOX);
}
