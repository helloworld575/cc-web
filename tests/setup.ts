import { vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';

// Polyfill File for Node 18 (globally available from Node 20+)
if (typeof globalThis.File === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).File = NodeFile;
}

// Mock better-sqlite3 before anything imports lib/db
vi.mock('better-sqlite3', () => {
  const stmt = { get: vi.fn(() => ({ c: 0 })), all: vi.fn(() => []), run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })) };
  const db = {
    prepare: vi.fn(() => stmt),
    pragma: vi.fn(),
    exec: vi.fn(),
  };
  return { default: vi.fn(() => db) };
});

// Mock next-auth getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => null),
}));

// Mock rateLimit
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(() => true),
  rateLimitByIp: vi.fn(() => null),
}));

// Mock markdown lib
vi.mock('@/lib/markdown', () => ({
  getPosts: vi.fn(() => []),
  getPost: vi.fn(() => null),
  savePost: vi.fn(),
  deletePost: vi.fn(),
}));

// Mock skills lib
vi.mock('@/lib/skills', () => ({
  getSkills: vi.fn(() => []),
  getSkill: vi.fn(() => null),
  saveSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

// Mock bazi lib
vi.mock('@/lib/bazi', () => ({
  calcBazi: vi.fn(() => ({
    year: { stem: '甲', branch: '子', stemElement: '木', branchElement: '水' },
    month: { stem: '乙', branch: '丑', stemElement: '木', branchElement: '土' },
    day: { stem: '丙', branch: '寅', stemElement: '火', branchElement: '木' },
    hour: { stem: '丁', branch: '卯', stemElement: '火', branchElement: '木' },
    dayMaster: '丙', dayMasterElement: '火',
    elements: { 木: 3, 火: 2, 土: 1, 金: 0, 水: 1 },
  })),
  formatElementsDesc: vi.fn(() => '木3 火2 土1 金0 水1'),
  getTenGod: vi.fn(() => '比肩'),
  STEMS: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
}));

// Mock ziwei lib
vi.mock('@/lib/ziwei', () => ({
  calcZiwei: vi.fn(() => ({
    mingGongBranch: '子', shenGongBranch: '午',
    nayinName: '海中金', wuxingJu: { name: '金四局' },
    palaces: [{ name: '命宫', branch: '子' }],
  })),
}));

// Mock yijing lib
vi.mock('@/lib/yijing', () => ({
  computeHexagram: vi.fn(),
  randomHexagram: vi.fn(() => ({
    lowerBinary: 0, upperBinary: 7,
    lines: [0, 0, 0, 1, 1, 1],
    changingLines: [2],
    hexagram: { fullName: '地天泰', unicode: '☷' },
    transformed: { fullName: '地火明夷', unicode: '☷' },
  })),
  timeToHexagram: vi.fn(() => ({
    lowerBinary: 0, upperBinary: 7,
    lines: [0, 0, 0, 1, 1, 1],
    changingLines: [2],
    hexagram: { fullName: '地天泰', unicode: '☷' },
    transformed: { fullName: '地火明夷', unicode: '☷' },
  })),
  numberToHexagram: vi.fn(() => ({
    lowerBinary: 0, upperBinary: 7,
    lines: [0, 0, 0, 1, 1, 1],
    changingLines: [2],
    hexagram: { fullName: '地天泰', unicode: '☷' },
    transformed: { fullName: '地火明夷', unicode: '☷' },
  })),
  formatLines: vi.fn(() => '初六 六二 六三 九四 九五 上九'),
  TRIGRAMS: Array.from({ length: 8 }, () => ({ name: '坤', nature: '地', element: '土' })),
}));

// Mock fs/promises for file routes
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(() => Buffer.from('fake')),
  unlink: vi.fn(),
}));

// Mock fs for uploads route
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const { Readable } = await vi.importActual<typeof import('stream')>('stream');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: 100, mtimeMs: 1700000000000 })),
    createReadStream: vi.fn(() => {
      const s = new Readable({ read() { this.push(Buffer.from('fake')); this.push(null); } });
      return s;
    }),
  };
});

// Env vars
process.env.ADMIN_PASSWORD = 'test-pass';
process.env.CLAUDE_API_KEY = 'test-key';

// Mock fetchers
vi.mock('@/lib/fetchers', () => ({
  fetchByCategory: vi.fn(() => ({ title: 'Test', content: 'Test content' })),
  fetchGeneric: vi.fn(() => ({ title: 'Test', content: 'Test content' })),
}));
