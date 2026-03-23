export const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
export const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

export const STEM_ELEMENT: Record<string, string> = {
  '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土',
  '己':'土','庚':'金','辛':'金','壬':'水','癸':'水',
};

export const BRANCH_ELEMENT: Record<string, string> = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水',
};

const ELEMENT_COLOR: Record<string, string> = {
  '木':'text-green-700 bg-green-50 border-green-200',
  '火':'text-red-700 bg-red-50 border-red-200',
  '土':'text-yellow-700 bg-yellow-50 border-yellow-200',
  '金':'text-gray-600 bg-gray-100 border-gray-300',
  '水':'text-blue-700 bg-blue-50 border-blue-200',
};
export { ELEMENT_COLOR };

// Yin/Yang of Heavenly Stems (阴=true, 阳=false)
export const STEM_YIN: Record<string, boolean> = {
  '甲':false,'乙':true,'丙':false,'丁':true,'戊':false,
  '己':true,'庚':false,'辛':true,'壬':false,'癸':true,
};

export interface Pillar {
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  label: string; // 年/月/日/时
}

export interface BaziResult {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  dayMaster: string;
  dayMasterElement: string;
  elements: Record<string, number>;
}

// Gregorian → Julian Day Number
function toJD(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const Y = y + 4800 - a;
  const M = m + 12 * a - 3;
  return d + Math.floor((153 * M + 2) / 5) + 365 * Y +
    Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
}

function makePillar(stemIdx: number, branchIdx: number, label: string): Pillar {
  const stem = STEMS[((stemIdx % 10) + 10) % 10];
  const branch = BRANCHES[((branchIdx % 12) + 12) % 12];
  return { stem, branch, stemElement: STEM_ELEMENT[stem], branchElement: BRANCH_ELEMENT[branch], label };
}

export function calcBazi(year: number, month: number, day: number, hour: number): BaziResult {
  // ── Year Pillar ──
  // Chinese year starts at 立春 (~Feb 4); dates before that belong to prior year
  let y = year;
  if (month < 2 || (month === 2 && day < 4)) y = year - 1;
  const yearStemIdx = ((y - 4) % 10 + 10) % 10;
  const yearBranchIdx = ((y - 4) % 12 + 12) % 12;
  const yearPillar = makePillar(yearStemIdx, yearBranchIdx, '年');

  // ── Month Pillar ──
  // Branch: Jan→丑(1), Feb→寅(2), Mar→卯(3), ..., Dec→子(0)
  // Approximate: shift back one branch if before the ~6th (solar term)
  const monthBranchRaw = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  let monthBranchIdx = monthBranchRaw[month - 1];
  if (day < 6) {
    monthBranchIdx = monthBranchRaw[month <= 1 ? 11 : month - 2];
  }
  // Month stem start for 寅月, determined by year stem group
  const monthStemStarts = [2, 4, 6, 8, 0]; // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const solarMonthOffset = ((monthBranchIdx - 2) + 12) % 12;
  const monthStemIdx = (monthStemStarts[yearStemIdx % 5] + solarMonthOffset) % 10;
  const monthPillar = makePillar(monthStemIdx, monthBranchIdx, '月');

  // ── Day Pillar ──
  // dayIdx in sexagenary cycle (甲子=0): (JD + 49) % 60
  const jd = toJD(year, month, day);
  const dayIdx = ((jd + 49) % 60 + 60) % 60;
  const dayPillar = makePillar(dayIdx % 10, dayIdx % 12, '日');

  // ── Hour Pillar ──
  // Each 时 spans 2 hours; 子时 = 23:00–01:00
  const hourBranchMap = (h: number): number => {
    if (h >= 23 || h < 1) return 0;
    return Math.floor((h + 1) / 2);
  };
  const hourBranchIdx = hourBranchMap(hour);
  const hourStemIdx = (monthStemStarts[dayIdx % 5] + hourBranchIdx) % 10;
  const hourPillar = makePillar(hourStemIdx, hourBranchIdx, '时');

  // ── Five Elements Count ──
  const elements: Record<string, number> = { '木':0, '火':0, '土':0, '金':0, '水':0 };
  for (const p of [yearPillar, monthPillar, dayPillar, hourPillar]) {
    elements[p.stemElement]++;
    elements[p.branchElement]++;
  }

  return {
    year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar,
    dayMaster: dayPillar.stem,
    dayMasterElement: dayPillar.stemElement,
    elements,
  };
}

export function formatElementsDesc(elements: Record<string, number>): string {
  return ['木','火','土','金','水']
    .map(e => `${e}×${elements[e]}`)
    .join(' ');
}

// Ten Gods (十神) of a stem relative to day master
export function getTenGod(dayStem: string, targetStem: string): string {
  const dayIdx = STEMS.indexOf(dayStem);
  const targetIdx = STEMS.indexOf(targetStem);
  const dayElement = STEM_ELEMENT[dayStem];
  const targetElement = STEM_ELEMENT[targetStem];
  const dayYin = STEM_YIN[dayStem];
  const targetYin = STEM_YIN[targetStem];

  const sameYin = dayYin === targetYin;
  const ELEMENTS = ['木','火','土','金','水'];
  const dayEIdx = ELEMENTS.indexOf(dayElement);
  const targetEIdx = ELEMENTS.indexOf(targetElement);

  if (targetElement === dayElement) return sameYin ? '比肩' : '劫财';

  // 我生 (dayElement generates targetElement)
  if ((dayEIdx + 1) % 5 === targetEIdx) return sameYin ? '食神' : '伤官';
  // 我克 (dayElement controls targetElement)
  if ((dayEIdx + 2) % 5 === targetEIdx) return sameYin ? '偏财' : '正财';
  // 克我 (targetElement controls dayElement)
  if ((targetEIdx + 2) % 5 === dayEIdx) return sameYin ? '偏官' : '正官';
  // 生我 (targetElement generates dayElement)
  return sameYin ? '偏印' : '正印';
}
