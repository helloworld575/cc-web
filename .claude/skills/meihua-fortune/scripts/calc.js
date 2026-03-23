#!/usr/bin/env node
// 梅花易数 hexagram calculation — pure CommonJS, no deps
// Usage: node calc.js [random|time <y> <m> <d> <h>|number <n1> <n2>]

const TRIGRAMS = {
  0:{name:'坤',element:'土',nature:'地'}, 1:{name:'震',element:'木',nature:'雷'},
  2:{name:'坎',element:'水',nature:'水'}, 3:{name:'兑',element:'金',nature:'泽'},
  4:{name:'艮',element:'土',nature:'山'}, 5:{name:'离',element:'火',nature:'火'},
  6:{name:'巽',element:'木',nature:'风'}, 7:{name:'乾',element:'金',nature:'天'},
};

const HEXAGRAMS = {
  63:{name:'乾',full:'乾为天'}, 0:{name:'坤',full:'坤为地'},
  56:{name:'泰',full:'地天泰'}, 7:{name:'否',full:'天地否'},
  47:{name:'同人',full:'天火同人'}, 40:{name:'明夷',full:'地火明夷'},
  61:{name:'大有',full:'火天大有'}, 5:{name:'晋',full:'火地晋'},
  9:{name:'震',full:'震为雷'}, 32:{name:'艮',full:'艮为山'},
  54:{name:'巽',full:'巽为风'}, 18:{name:'坎',full:'坎为水'},
  45:{name:'离',full:'离为火'}, 27:{name:'兑',full:'兑为泽'},
  // Additional key hexagrams
  55:{name:'姤',full:'天风姤'}, 48:{name:'升',full:'地风升'},
  59:{name:'小畜',full:'风天小畜'}, 6:{name:'观',full:'风地观'},
  58:{name:'需',full:'水天需'}, 20:{name:'师',full:'地水师'},
  23:{name:'讼',full:'天水讼'}, 2:{name:'比',full:'水地比'},
  60:{name:'大壮',full:'雷天大壮'}, 4:{name:'豫',full:'雷地豫'},
  15:{name:'无妄',full:'天雷无妄'}, 12:{name:'复',full:'地雷复'},
  10:{name:'屯',full:'水雷屯'}, 8:{name:'颐',full:'山雷颐'},
  14:{name:'益',full:'风雷益'}, 13:{name:'噬嗑',full:'火雷噬嗑'},
  57:{name:'大畜',full:'山天大畜'}, 1:{name:'剥',full:'山地剥'},
  39:{name:'遁',full:'天山遁'}, 33:{name:'谦',full:'地山谦'},
  34:{name:'蹇',full:'水山蹇'}, 38:{name:'渐',full:'风山渐'},
  35:{name:'咸',full:'泽山咸'}, 37:{name:'旅',full:'火山旅'},
  36:{name:'小过',full:'雷山小过'}, 24:{name:'临',full:'地泽临'},
  31:{name:'履',full:'天泽履'}, 30:{name:'中孚',full:'风泽中孚'},
  26:{name:'节',full:'水泽节'}, 25:{name:'损',full:'山泽损'},
  28:{name:'归妹',full:'雷泽归妹'}, 29:{name:'睽',full:'火泽睽'},
  62:{name:'夬',full:'泽天夬'}, 3:{name:'萃',full:'泽地萃'},
  22:{name:'涣',full:'风水涣'}, 17:{name:'蒙',full:'山水蒙'},
  16:{name:'解',full:'雷水解'}, 21:{name:'未济',full:'火水未济'},
  19:{name:'困',full:'泽水困'}, 42:{name:'既济',full:'水火既济'},
  46:{name:'家人',full:'风火家人'}, 41:{name:'贲',full:'山火贲'},
  44:{name:'丰',full:'雷火丰'}, 43:{name:'革',full:'泽火革'},
  49:{name:'蛊',full:'山风蛊'}, 53:{name:'鼎',full:'火风鼎'},
  52:{name:'恒',full:'雷风恒'}, 50:{name:'井',full:'水风井'},
  51:{name:'大过',full:'泽风大过'}, 11:{name:'随',full:'泽雷随'},
};

function lineToYang(v) { return (v===7||v===9) ? 1 : 0; }
function trigramBinary(lines, from) {
  return lineToYang(lines[from]) | (lineToYang(lines[from+1])<<1) | (lineToYang(lines[from+2])<<2);
}

function buildFromBinaries(lowerNum, upperNum, movingIdx) {
  const lines = [];
  for (let i=0;i<3;i++) lines.push(((lowerNum>>i)&1)?7:8);
  for (let i=0;i<3;i++) lines.push(((upperNum>>i)&1)?7:8);
  lines[movingIdx] = lines[movingIdx]===7 ? 9 : 6;
  return lines;
}

function computeHexagram(lines) {
  const lower = trigramBinary(lines, 0);
  const upper = trigramBinary(lines, 3);
  const hex = HEXAGRAMS[upper*8+lower] || {name:'未知',full:'未知'};
  const changing = lines.map((v,i)=>(v===6||v===9)?i:-1).filter(i=>i>=0);
  let transformed = null;
  if (changing.length>0) {
    const tLines = lines.map((v,i)=>changing.includes(i)?(v===9?8:7):v);
    const tLower = trigramBinary(tLines,0), tUpper = trigramBinary(tLines,3);
    transformed = HEXAGRAMS[tUpper*8+tLower] || {name:'未知',full:'未知'};
  }
  return { lines, lower, upper, lowerTrigram: TRIGRAMS[lower], upperTrigram: TRIGRAMS[upper], hex, changing, transformed };
}

const args = process.argv.slice(2);
let result;
if (args[0]==='time' && args.length>=5) {
  const [,y,m,d,h] = args.map(Number);
  const sum = y+m+d;
  const hb = Math.floor(h/2);
  const lower = ((sum%8)+8)%8, upper = (((sum+hb)%8)+8)%8;
  const movingIdx = (((sum+hb)%6)+6)%6;
  result = computeHexagram(buildFromBinaries(lower, upper, movingIdx));
} else if (args[0]==='number' && args.length>=3) {
  const n1=Number(args[1]), n2=Number(args[2]);
  const lower = ((n1%8)+8)%8, upper = ((n2%8)+8)%8;
  const movingIdx = (((n1+n2)%6)+6)%6;
  result = computeHexagram(buildFromBinaries(lower, upper, movingIdx));
} else {
  // random
  const lower = Math.floor(Math.random()*8), upper = Math.floor(Math.random()*8);
  const movingIdx = Math.floor(Math.random()*6);
  result = computeHexagram(buildFromBinaries(lower, upper, movingIdx));
}
console.log(JSON.stringify(result, null, 2));
