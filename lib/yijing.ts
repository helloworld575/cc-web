// I Ching (周易) utilities: hexagrams, line generation, changing lines

// Trigrams indexed 0-7 by binary value (bit0=bottom line, 1=yang)
// 000=坤, 001=震, 010=坎, 011=兑, 100=艮, 101=离, 110=巽, 111=乾
export const TRIGRAMS: Record<number, { name: string; element: string; nature: string }> = {
  0: { name: '坤', element: '土', nature: '地' },
  1: { name: '震', element: '木', nature: '雷' },
  2: { name: '坎', element: '水', nature: '水' },
  3: { name: '兑', element: '金', nature: '泽' },
  4: { name: '艮', element: '土', nature: '山' },
  5: { name: '离', element: '火', nature: '火' },
  6: { name: '巽', element: '木', nature: '风' },
  7: { name: '乾', element: '金', nature: '天' },
};

// 64 hexagrams, indexed by (upper*8 + lower)
// line values: 6=老阴(变), 7=少阳(不变), 8=少阴(不变), 9=老阳(变)
export interface HexagramInfo {
  name: string;       // 卦名 e.g. 乾
  fullName: string;   // full name e.g. 乾为天
  unicode: string;    // Unicode symbol U+4DC0–U+4DFF
}

const H = (name: string, fullName: string, unicodeOffset: number): HexagramInfo => ({
  name, fullName, unicode: String.fromCodePoint(0x4DC0 + unicodeOffset),
});

// King Wen sequence ordering: upper trigram (row) × lower trigram (col)
// Index = upper*8 + lower (same binary encoding)
export const HEXAGRAMS: Record<number, HexagramInfo> = {
  // 乾(7) upper
  63: H('乾', '乾为天', 0),
  62: H('夬', '泽天夬', 10),
  61: H('大有', '火天大有', 13),
  60: H('大壮', '雷天大壮', 33),
  59: H('小畜', '风天小畜', 8),
  58: H('需', '水天需', 4),
  57: H('大畜', '山天大畜', 25),
  56: H('泰', '地天泰', 11),
  // 兑(3) upper
  31: H('履', '天泽履', 9),
  27: H('兑', '兑为泽', 57),
  29: H('睽', '火泽睽', 37),
  28: H('归妹', '雷泽归妹', 53),
  30: H('中孚', '风泽中孚', 61),
  26: H('节', '水泽节', 59),
  25: H('损', '山泽损', 40),
  24: H('临', '地泽临', 19),
  // 离(5) upper
  47: H('同人', '天火同人', 12),
  43: H('革', '泽火革', 48),
  45: H('离', '离为火', 29),
  44: H('丰', '雷火丰', 54),
  46: H('家人', '风火家人', 36),
  42: H('既济', '水火既济', 62),
  41: H('贲', '山火贲', 21),
  40: H('明夷', '地火明夷', 35),
  // 震(1) upper
  15: H('无妄', '天雷无妄', 24),
  11: H('随', '泽雷随', 16),
  13: H('噬嗑', '火雷噬嗑', 20),
  9:  H('震', '震为雷', 50),
  14: H('益', '风雷益', 41),
  10: H('屯', '水雷屯', 2),
  8:  H('颐', '山雷颐', 26),
  12: H('复', '地雷复', 23),
  // 巽(6) upper
  55: H('姤', '天风姤', 43),
  51: H('大过', '泽风大过', 27),
  53: H('鼎', '火风鼎', 49),
  52: H('恒', '雷风恒', 31),
  54: H('巽', '巽为风', 56),
  50: H('井', '水风井', 47),
  49: H('蛊', '山风蛊', 17),
  48: H('升', '地风升', 45),
  // 坎(2) upper
  23: H('讼', '天水讼', 5),
  19: H('困', '泽水困', 46),
  21: H('未济', '火水未济', 63),
  16: H('解', '雷水解', 39),
  22: H('涣', '风水涣', 58),
  18: H('坎', '坎为水', 28),
  17: H('蒙', '山水蒙', 3),
  20: H('师', '地水师', 6),
  // 艮(4) upper
  39: H('遁', '天山遁', 32),
  35: H('咸', '泽山咸', 30),
  37: H('旅', '火山旅', 55),
  36: H('小过', '雷山小过', 61),
  38: H('渐', '风山渐', 52),
  34: H('蹇', '水山蹇', 38),
  32: H('艮', '艮为山', 51),
  33: H('谦', '地山谦', 14),
  // 坤(0) upper
  7:  H('否', '天地否', 11),
  3:  H('萃', '泽地萃', 44),
  5:  H('晋', '火地晋', 34),
  4:  H('豫', '雷地豫', 15),
  6:  H('观', '风地观', 19),
  2:  H('比', '水地比', 7),
  1:  H('剥', '山地剥', 22),
  0:  H('坤', '坤为地', 1),
};

export interface HexagramResult {
  lines: number[];           // 6 line values (6/7/8/9), index 0 = bottom
  lowerBinary: number;       // 0-7 for lower trigram
  upperBinary: number;       // 0-7 for upper trigram
  hexagram: HexagramInfo;
  changingLines: number[];   // which line indices have changing lines (6 or 9)
  transformed?: HexagramInfo; // after changing lines
  transformedLines?: number[]; // after transformation
}

// Convert line value to yang (1) or yin (0)
function lineToYang(v: number): number { return (v === 7 || v === 9) ? 1 : 0; }

function computeTrigramBinary(lines: number[], fromIdx: number): number {
  // lines[fromIdx] = bottom, lines[fromIdx+2] = top
  return lineToYang(lines[fromIdx]) | (lineToYang(lines[fromIdx + 1]) << 1) | (lineToYang(lines[fromIdx + 2]) << 2);
}

export function computeHexagram(lines: number[]): HexagramResult {
  const lowerBinary = computeTrigramBinary(lines, 0);
  const upperBinary = computeTrigramBinary(lines, 3);
  const idx = upperBinary * 8 + lowerBinary;
  const hexagram = HEXAGRAMS[idx] ?? H('未知', '未知', 0);

  const changingLines = lines.map((v, i) => (v === 6 || v === 9) ? i : -1).filter(i => i >= 0);

  let transformed: HexagramInfo | undefined;
  let transformedLines: number[] | undefined;

  if (changingLines.length > 0) {
    transformedLines = lines.map((v, i) =>
      changingLines.includes(i) ? (v === 9 ? 8 : 7) : v
    );
    const tLower = computeTrigramBinary(transformedLines, 0);
    const tUpper = computeTrigramBinary(transformedLines, 3);
    transformed = HEXAGRAMS[tUpper * 8 + tLower] ?? H('未知', '未知', 0);
  }

  return { lines, lowerBinary, upperBinary, hexagram, changingLines, transformed, transformedLines };
}

// Three-coin method: each line = sum of 3 coins (heads=3, tails=2) → 6/7/8/9
export function randomLine(): number {
  const coins = [0, 1, 2].map(() => Math.random() < 0.5 ? 2 : 3);
  return coins[0] + coins[1] + coins[2]; // 6/7/8/9
}

export function randomHexagram(): HexagramResult {
  return computeHexagram(Array.from({ length: 6 }, randomLine));
}

// Time-based method (起卦法): year+month+day → lower trigram; +hour → upper trigram; moving line = (sum+hour)%6
export function timeToHexagram(year: number, month: number, day: number, hour: number): HexagramResult {
  const sum = year + month + day;
  const lowerNum = ((sum % 8) + 8) % 8;
  const hourBranch = Math.floor(hour / 2); // 0-11
  const upperNum = (((sum + hourBranch) % 8) + 8) % 8;
  const movingIdx = (((sum + hourBranch) % 6) + 6) % 6; // 0-5, bottom=0

  // Build lines: all 7 (少阳) except the one moving line is 9 (老阳)
  const lines = Array(6).fill(7);
  lines[movingIdx] = 9;

  // Override with actual trigram binaries
  // lower trigram bits → set lines[0-2]
  for (let i = 0; i < 3; i++) lines[i] = ((lowerNum >> i) & 1) ? 9 : 8; // use 9=yang, 8=yin as defaults
  for (let i = 0; i < 3; i++) lines[i + 3] = ((upperNum >> i) & 1) ? 9 : 8;
  lines[movingIdx] = lines[movingIdx] === 9 ? 9 : 6; // moving: old yang or old yin

  return computeHexagram(lines);
}

// Number-based method (梅花易数): two numbers → trigrams, first number's remainder for moving line
export function numberToHexagram(num1: number, num2: number): HexagramResult {
  const lowerNum = ((num1 % 8) + 8) % 8;
  const upperNum = ((num2 % 8) + 8) % 8;
  const movingIdx = (((num1 + num2) % 6) + 6) % 6;

  const lines: number[] = [];
  for (let i = 0; i < 3; i++) lines.push(((lowerNum >> i) & 1) ? 7 : 8);
  for (let i = 0; i < 3; i++) lines.push(((upperNum >> i) & 1) ? 7 : 8);
  lines[movingIdx] = lines[movingIdx] === 7 ? 9 : 6; // make it changing

  return computeHexagram(lines);
}

export function formatLines(lines: number[]): string {
  return lines.slice().reverse().map(v => {
    if (v === 9) return '━━ ━━ ×';  // old yang → becomes yin
    if (v === 6) return '━━━━━ ○';  // old yin → becomes yang
    if (v === 7) return '━━━━━';    // young yang
    return '━━ ━━';                 // young yin (8)
  }).join('\n');
}
