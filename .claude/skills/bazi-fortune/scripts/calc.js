#!/usr/bin/env node
// 八字命理 calculation — pure CommonJS, no deps
// Usage: node calc.js <year> <month> <day> <hour>

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_ELEMENT = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BRANCH_ELEMENT = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const STEM_YIN = {甲:false,乙:true,丙:false,丁:true,戊:false,己:true,庚:false,辛:true,壬:false,癸:true};

function toJD(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const Y = y + 4800 - a;
  const M = m + 12 * a - 3;
  return d + Math.floor((153*M+2)/5) + 365*Y + Math.floor(Y/4) - Math.floor(Y/100) + Math.floor(Y/400) - 32045;
}

function makePillar(sIdx, bIdx, label) {
  const stem = STEMS[((sIdx%10)+10)%10];
  const branch = BRANCHES[((bIdx%12)+12)%12];
  return { stem, branch, stemElement: STEM_ELEMENT[stem], branchElement: BRANCH_ELEMENT[branch], label };
}

function calcBazi(year, month, day, hour) {
  let y = year;
  if (month < 2 || (month === 2 && day < 4)) y = year - 1;
  const yearStemIdx = ((y-4)%10+10)%10;
  const yearBranchIdx = ((y-4)%12+12)%12;
  const yearPillar = makePillar(yearStemIdx, yearBranchIdx, '年');

  const monthBranchRaw = [1,2,3,4,5,6,7,8,9,10,11,0];
  let monthBranchIdx = monthBranchRaw[month-1];
  if (day < 6) monthBranchIdx = monthBranchRaw[month <= 1 ? 11 : month-2];
  const monthStemStarts = [2,4,6,8,0];
  const solarMonthOffset = ((monthBranchIdx-2)+12)%12;
  const monthStemIdx = (monthStemStarts[yearStemIdx%5] + solarMonthOffset)%10;
  const monthPillar = makePillar(monthStemIdx, monthBranchIdx, '月');

  const jd = toJD(year, month, day);
  const dayIdx = ((jd+49)%60+60)%60;
  const dayPillar = makePillar(dayIdx%10, dayIdx%12, '日');

  const hourBranchIdx = (hour >= 23 || hour < 1) ? 0 : Math.floor((hour+1)/2);
  const hourStemIdx = (monthStemStarts[dayIdx%5] + hourBranchIdx)%10;
  const hourPillar = makePillar(hourStemIdx, hourBranchIdx, '时');

  const elements = {木:0,火:0,土:0,金:0,水:0};
  for (const p of [yearPillar,monthPillar,dayPillar,hourPillar]) {
    elements[p.stemElement]++;
    elements[p.branchElement]++;
  }

  const ELEMS = ['木','火','土','金','水'];
  function getTenGod(dayStem, targetStem) {
    const dayE = STEM_ELEMENT[dayStem], targetE = STEM_ELEMENT[targetStem];
    const sameYin = STEM_YIN[dayStem] === STEM_YIN[targetStem];
    const dI = ELEMS.indexOf(dayE), tI = ELEMS.indexOf(targetE);
    if (targetE === dayE) return sameYin ? '比肩' : '劫财';
    if ((dI+1)%5 === tI) return sameYin ? '食神' : '伤官';
    if ((dI+2)%5 === tI) return sameYin ? '偏财' : '正财';
    if ((tI+2)%5 === dI) return sameYin ? '偏官' : '正官';
    return sameYin ? '偏印' : '正印';
  }

  const tenGods = {};
  STEMS.forEach(s => { tenGods[s] = getTenGod(dayPillar.stem, s); });

  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar,
           dayMaster: dayPillar.stem, dayMasterElement: dayPillar.stemElement, elements, tenGods };
}

const [,, year, month, day, hour] = process.argv;
if (!year) { console.error('Usage: node calc.js <year> <month> <day> <hour>'); process.exit(1); }
const result = calcBazi(Number(year), Number(month), Number(day), Number(hour));
console.log(JSON.stringify(result, null, 2));
