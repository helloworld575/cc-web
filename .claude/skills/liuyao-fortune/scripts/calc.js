#!/usr/bin/env node
// 周易六爻 hexagram calculation — pure CommonJS, no deps
// Usage: node calc.js [random|time <year> <month> <day> <hour>]

const TRIGRAMS = {
  0: { name: '坤', element: '土', nature: '地' },
  1: { name: '震', element: '木', nature: '雷' },
  2: { name: '坎', element: '水', nature: '水' },
  3: { name: '兑', element: '金', nature: '泽' },
  4: { name: '艮', element: '土', nature: '山' },
  5: { name: '离', element: '火', nature: '火' },
  6: { name: '巽', element: '木', nature: '风' },
  7: { name: '乾', element: '金', nature: '天' },
};

// 64 hexagrams indexed by upper*8+lower
const HEXAGRAMS = {
  63:{name:'乾',full:'乾为天',u:'䷀'}, 62:{name:'夬',full:'泽天夬',u:'䷉'},
  61:{name:'大有',full:'火天大有',u:'䷌'}, 60:{name:'大壮',full:'雷天大壮',u:'䷡'},
  59:{name:'小畜',full:'风天小畜',u:'䷇'}, 58:{name:'需',full:'水天需',u:'䷃'},
  57:{name:'大畜',full:'山天大畜',u:'䷘'}, 56:{name:'泰',full:'地天泰',u:'䷊'},
  31:{name:'履',full:'天泽履',u:'䷉'}, 27:{name:'兑',full:'兑为泽',u:'䷹'},
  29:{name:'睽',full:'火泽睽',u:'䷥'}, 28:{name:'归妹',full:'雷泽归妹',u:'䷵'},
  30:{name:'中孚',full:'风泽中孚',u:'䷼'}, 26:{name:'节',full:'水泽节',u:'䷻'},
  25:{name:'损',full:'山泽损',u:'䷨'}, 24:{name:'临',full:'地泽临',u:'䷒'},
  47:{name:'同人',full:'天火同人',u:'䷌'}, 43:{name:'革',full:'泽火革',u:'䷰'},
  45:{name:'离',full:'离为火',u:'䷝'}, 44:{name:'丰',full:'雷火丰',u:'䷶'},
  46:{name:'家人',full:'风火家人',u:'䷤'}, 42:{name:'既济',full:'水火既济',u:'䷾'},
  41:{name:'贲',full:'山火贲',u:'䷕'}, 40:{name:'明夷',full:'地火明夷',u:'䷣'},
  15:{name:'无妄',full:'天雷无妄',u:'䷘'}, 11:{name:'随',full:'泽雷随',u:'䷐'},
  13:{name:'噬嗑',full:'火雷噬嗑',u:'䷔'}, 9:{name:'震',full:'震为雷',u:'䷲'},
  14:{name:'益',full:'风雷益',u:'䷩'}, 10:{name:'屯',full:'水雷屯',u:'䷂'},
  8:{name:'颐',full:'山雷颐',u:'䷙'}, 12:{name:'复',full:'地雷复',u:'䷗'},
  55:{name:'姤',full:'天风姤',u:'䷫'}, 51:{name:'大过',full:'泽风大过',u:'䷛'},
  53:{name:'鼎',full:'火风鼎',u:'䷱'}, 52:{name:'恒',full:'雷风恒',u:'䷟'},
  54:{name:'巽',full:'巽为风',u:'䷸'}, 50:{name:'井',full:'水风井',u:'䷯'},
  49:{name:'蛊',full:'山风蛊',u:'䷑'}, 48:{name:'升',full:'地风升',u:'䷭'},
  23:{name:'讼',full:'天水讼',u:'䷄'}, 19:{name:'困',full:'泽水困',u:'䷮'},
  21:{name:'未济',full:'火水未济',u:'䷿'}, 16:{name:'解',full:'雷水解',u:'䷧'},
  22:{name:'涣',full:'风水涣',u:'䷺'}, 18:{name:'坎',full:'坎为水',u:'䷜'},
  17:{name:'蒙',full:'山水蒙',u:'䷃'}, 20:{name:'师',full:'地水师',u:'䷆'},
  39:{name:'遁',full:'天山遁',u:'䷠'}, 35:{name:'咸',full:'泽山咸',u:'䷞'},
  37:{name:'旅',full:'火山旅',u:'䷷'}, 36:{name:'小过',full:'雷山小过',u:'䷽'},
  38:{name:'渐',full:'风山渐',u:'䷴'}, 34:{name:'蹇',full:'水山蹇',u:'䷦'},
  32:{name:'艮',full:'艮为山',u:'䷳'}, 33:{name:'谦',full:'地山谦',u:'䷎'},
  7:{name:'否',full:'天地否',u:'䷋'}, 3:{name:'萃',full:'泽地萃',u:'䷬'},
  5:{name:'晋',full:'火地晋',u:'䷢'}, 4:{name:'豫',full:'雷地豫',u:'䷏'},
  6:{name:'观',full:'风地观',u:'䷓'}, 2:{name:'比',full:'水地比',u:'䷆'},
  1:{name:'剥',full:'山地剥',u:'䷖'}, 0:{name:'坤',full:'坤为地',u:'䷁'},
};

function randomLine() {
  return [0,1,2].reduce((s) => s + (Math.random() < 0.5 ? 2 : 3), 0);
}

function lineToYang(v) { return (v === 7 || v === 9) ? 1 : 0; }

function trigramBinary(lines, from) {
  return lineToYang(lines[from]) | (lineToYang(lines[from+1]) << 1) | (lineToYang(lines[from+2]) << 2);
}

function computeHexagram(lines) {
  const lower = trigramBinary(lines, 0);
  const upper = trigramBinary(lines, 3);
  const hex = HEXAGRAMS[upper*8+lower] || { name:'未知', full:'未知', u:'?' };
  const changing = lines.map((v,i) => (v===6||v===9) ? i : -1).filter(i => i>=0);
  let transformed = null;
  if (changing.length > 0) {
    const tLines = lines.map((v,i) => changing.includes(i) ? (v===9?8:7) : v);
    const tLower = trigramBinary(tLines, 0);
    const tUpper = trigramBinary(tLines, 3);
    transformed = HEXAGRAMS[tUpper*8+tLower] || { name:'未知', full:'未知', u:'?' };
  }
  return { lines, lower, upper, lowerTrigram: TRIGRAMS[lower], upperTrigram: TRIGRAMS[upper], hex, changing, transformed };
}

const args = process.argv.slice(2);
let result;
if (args[0] === 'time' && args.length >= 5) {
  const [,year,month,day,hour] = args.map(Number);
  const sum = year + month + day;
  const hourBranch = Math.floor(hour / 2);
  const lowerNum = ((sum % 8) + 8) % 8;
  const upperNum = (((sum + hourBranch) % 8) + 8) % 8;
  const movingIdx = (((sum + hourBranch) % 6) + 6) % 6;
  const lines = [];
  for (let i = 0; i < 3; i++) lines.push(((lowerNum >> i) & 1) ? 9 : 8);
  for (let i = 0; i < 3; i++) lines.push(((upperNum >> i) & 1) ? 9 : 8);
  lines[movingIdx] = lines[movingIdx] === 9 ? 9 : 6;
  result = computeHexagram(lines);
} else {
  result = computeHexagram(Array.from({length:6}, randomLine));
}

console.log(JSON.stringify(result, null, 2));
