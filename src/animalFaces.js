// 新しい6人の顔のアイコン（平らな絵。キャラ選び・上位3人・結果の表で、丸い枠の中に出す）
// 0〜100 の四角の真ん中（50, 55）に顔。src/render/animals.js の 3D の見た目とそろえる
const LINE = 'stroke="#3a1a10" stroke-width="3"';
const eyes = (y, color = '#1b1b22') => `<ellipse cx="39" cy="${y}" rx="5" ry="7" fill="${color}"/><ellipse cx="61" cy="${y}" rx="5" ry="7" fill="${color}"/><circle cx="41" cy="${y - 3}" r="2" fill="#fff"/><circle cx="63" cy="${y - 3}" r="2" fill="#fff"/>`;
const smile = (y) => `<path d="M42 ${y} Q50 ${y + 7} 58 ${y}" fill="none" stroke="#7a2a2a" stroke-width="3" stroke-linecap="round"/>`;

export const ANIMAL_FACES = {
  penguin: `<circle cx="50" cy="56" r="36" fill="#1a1a1a" ${LINE}/><ellipse cx="50" cy="63" rx="25" ry="27" fill="#fff"/>
    <path d="M44 22 L50 8 L56 22 Z M36 25 L32 12 L44 22 Z M64 25 L68 12 L56 22 Z" fill="#1a1a1a"/>
    <rect x="27" y="45" width="20" height="13" rx="4" fill="#111"/><rect x="53" y="45" width="20" height="13" rx="4" fill="#111"/><rect x="45" y="48" width="10" height="3" fill="#111"/>
    <path d="M31 48 l9 0 M32 53 l7 0 M57 48 l9 0 M58 53 l7 0" stroke="#fff" stroke-width="1.6"/>
    <path d="M41 63 L59 63 L50 74 Z" fill="#f5b400" ${LINE}/>`,
  rabbit: `<ellipse cx="38" cy="24" rx="8" ry="22" fill="#f7f4f0" ${LINE}/><ellipse cx="62" cy="24" rx="8" ry="22" fill="#f7f4f0" ${LINE}/>
    <ellipse cx="38" cy="26" rx="4" ry="15" fill="#f4a3b8"/><ellipse cx="62" cy="26" rx="4" ry="15" fill="#f4a3b8"/>
    <circle cx="50" cy="62" r="30" fill="#f7f4f0" ${LINE}/>${eyes(58)}<ellipse cx="50" cy="68" rx="4" ry="3" fill="#f4a3b8"/>${smile(73)}
    <path d="M60 36 L72 30 L72 42 Z M84 36 L72 30 L72 42 Z" fill="#e0202a"/><circle cx="72" cy="36" r="3.5" fill="#e0202a"/>`,
  mouse: `<circle cx="24" cy="34" r="18" fill="#9a9aa6" ${LINE}/><circle cx="76" cy="34" r="18" fill="#9a9aa6" ${LINE}/>
    <circle cx="24" cy="34" r="11" fill="#f4a3b8"/><circle cx="76" cy="34" r="11" fill="#f4a3b8"/>
    <circle cx="50" cy="60" r="30" fill="#9a9aa6" ${LINE}/><ellipse cx="50" cy="70" rx="15" ry="11" fill="#c8c8d0"/>${eyes(55)}
    <circle cx="50" cy="66" r="4.5" fill="#f4a3b8"/><path d="M30 68 l14 1 M30 74 l14 -2 M70 68 l-14 1 M70 74 l-14 -2" stroke="#444" stroke-width="1.5"/>${smile(75)}`,
  tiger: `<circle cx="30" cy="34" r="10" fill="#f08a24" ${LINE}/><circle cx="70" cy="34" r="10" fill="#f08a24" ${LINE}/>
    <circle cx="50" cy="58" r="32" fill="#f08a24" ${LINE}/><ellipse cx="50" cy="70" rx="17" ry="12" fill="#fff"/>
    <path d="M44 30 L46 40 M50 28 L50 40 M56 30 L54 40 M20 52 L30 54 M20 62 L30 61 M80 52 L70 54 M80 62 L70 61" stroke="#1a1a1a" stroke-width="3.5" stroke-linecap="round"/>
    ${eyes(54)}<ellipse cx="50" cy="65" rx="5" ry="3.5" fill="#3a2a2a"/>${smile(73)}`,
  elephant: `<ellipse cx="18" cy="56" rx="16" ry="24" fill="#8c96a0" ${LINE}/><ellipse cx="82" cy="56" rx="16" ry="24" fill="#8c96a0" ${LINE}/>
    <ellipse cx="18" cy="56" rx="9" ry="16" fill="#f4a3b8"/><ellipse cx="82" cy="56" rx="9" ry="16" fill="#f4a3b8"/>
    <circle cx="50" cy="54" r="30" fill="#8c96a0" ${LINE}/>${eyes(50)}
    <path d="M44 62 Q44 84 56 92 Q62 94 62 88 Q54 82 56 62 Z" fill="#8c96a0" ${LINE}/>`,
  cat: `<path d="M24 46 L28 14 L48 32 Z M76 46 L72 14 L52 32 Z" fill="#26262e" ${LINE}/><path d="M30 38 L31 22 L42 32 Z M70 38 L69 22 L58 32 Z" fill="#f4a3b8"/>
    <circle cx="50" cy="58" r="31" fill="#26262e" ${LINE}/>${eyes(55, '#f5d020')}
    <rect x="37.5" y="50" width="3" height="10" rx="1.5" fill="#111"/><rect x="59.5" y="50" width="3" height="10" rx="1.5" fill="#111"/>
    <path d="M46 66 L54 66 L50 70 Z" fill="#f4a3b8"/><path d="M26 66 l16 1 M26 72 l16 -2 M74 66 l-16 1 M74 72 l-16 -2" stroke="#fff" stroke-width="1.5"/>`,
};

export function animalFaceSvg(id, cls = 'face-svg') {
  return `<svg class="${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${ANIMAL_FACES[id]}</svg>`;
}
