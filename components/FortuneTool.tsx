'use client';
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { type BaziResult, ELEMENT_COLOR } from '@/lib/bazi';
import { type ZiweiResult } from '@/lib/ziwei';
import { type HexagramResult, TRIGRAMS } from '@/lib/yijing';

// ─── Shared types ────────────────────────────────────────────────────────────
type Method = 'bazi' | 'ziwei' | 'liuyao' | 'meihua';

interface HistoryEntry {
  _id: string;
  method: Method;
  input: Record<string, unknown>;
  preflight: Record<string, unknown>;
  analysis: string;
  createdAt: string;
}

const METHOD_ICON: Record<Method, string> = { bazi: '🏮', ziwei: '⭐', liuyao: '☯', meihua: '🌸' };
const METHOD_LABEL: Record<Method, string> = { bazi: '八字命理', ziwei: '紫微斗数', liuyao: '周易六爻', meihua: '梅花易数' };

const METHODS: { id: Method; label: string; icon: string }[] = [
  { id: 'bazi',   label: '八字命理', icon: '🏮' },
  { id: 'ziwei',  label: '紫微斗数', icon: '⭐' },
  { id: 'liuyao', label: '周易六爻', icon: '☯' },
  { id: 'meihua', label: '梅花易数', icon: '🌸' },
];

const BAZI_ASPECTS = [
  { id: '性格', label: '性格特质', icon: '🧠' },
  { id: '事业', label: '事业财运', icon: '💼' },
  { id: '婚姻', label: '婚恋感情', icon: '💑' },
  { id: '健康', label: '健康养生', icon: '🌿' },
  { id: '流年运势', label: '流年运势', icon: '📅' },
];

const ZIWEI_ASPECTS = [
  { id: '性格命格', label: '性格命格', icon: '🧠' },
  { id: '事业官禄', label: '事业官禄', icon: '💼' },
  { id: '婚姻夫妻', label: '婚姻夫妻', icon: '💑' },
  { id: '财帛运势', label: '财帛运势', icon: '💰' },
  { id: '大限流年', label: '大限流年', icon: '📅' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const labels = ['子(23-1)','子(0-1)','丑(1-3)','丑(2-3)','寅(3-5)','寅(4-5)','卯(5-7)','卯(6-7)',
    '辰(7-9)','辰(8-9)','巳(9-11)','巳(10-11)','午(11-13)','午(12-13)','未(13-15)','未(14-15)',
    '申(15-17)','申(16-17)','酉(17-19)','酉(18-19)','戌(19-21)','戌(20-21)','亥(21-23)','亥(22-23)'];
  return { value: i, label: `${String(i).padStart(2,'0')}:00 ${labels[i]}` };
});

const ELEMENT_ICON: Record<string, string> = { '木':'🌳','火':'🔥','土':'🪨','金':'⚙️','水':'💧' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function PillarCard({ pillar, highlight }: { pillar: BaziResult['day']; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-xl border-2 py-3 px-2 min-w-0 ${highlight ? 'border-black bg-black text-white' : 'border-gray-200 bg-white'}`}>
      <span className="text-xs font-medium opacity-60 mb-1">{pillar.label}柱</span>
      <span className={`text-2xl font-bold ${highlight ? 'text-yellow-300' : ''}`}>{pillar.stem}</span>
      <span className={`text-xs mt-0.5 mb-1 ${highlight ? 'text-gray-300' : 'text-gray-400'}`}>{ELEMENT_ICON[pillar.stemElement]} {pillar.stemElement}</span>
      <div className={`w-full h-px my-1 ${highlight ? 'bg-gray-600' : 'bg-gray-100'}`} />
      <span className={`text-2xl font-bold ${highlight ? 'text-blue-300' : ''}`}>{pillar.branch}</span>
      <span className={`text-xs mt-0.5 ${highlight ? 'text-gray-300' : 'text-gray-400'}`}>{ELEMENT_ICON[pillar.branchElement]} {pillar.branchElement}</span>
    </div>
  );
}

function ElementBar({ elements }: { elements: Record<string, number> }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {['木','火','土','金','水'].map(e => (
        <div key={e} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${ELEMENT_COLOR[e]}`}>
          {ELEMENT_ICON[e]} {e} ×{elements[e]}
        </div>
      ))}
    </div>
  );
}

function HexagramDisplay({ result }: { result: HexagramResult }) {
  const lower = TRIGRAMS[result.lowerBinary];
  const upper = TRIGRAMS[result.upperBinary];
  const lineLabels = ['初爻','二爻','三爻','四爻','五爻','上爻'];

  return (
    <div className="border rounded-xl p-4 sm:p-5 bg-white">
      <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
        <span>☯</span> 卦象
      </h2>
      <div className="flex gap-6 items-start">
        {/* Lines display */}
        <div className="flex flex-col-reverse gap-1.5 font-mono text-xs">
          {result.lines.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-400 w-6">{lineLabels[i]}</span>
              <span className={`${result.changingLines.includes(i) ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                {v === 9 ? '━━ ━━ ⊙' : v === 6 ? '━━━━━ ⊗' : v === 7 ? '━━━━━' : '━━ ━━'}
              </span>
              {result.changingLines.includes(i) && <span className="text-red-500 text-xs">动</span>}
            </div>
          ))}
        </div>
        {/* Hexagram info */}
        <div className="flex-1">
          <div className="text-3xl mb-1">{result.hexagram.unicode}</div>
          <div className="font-bold text-lg">{result.hexagram.fullName}</div>
          <div className="text-xs text-gray-500 mt-1">
            上卦：{upper.name}（{upper.nature}） | 下卦：{lower.name}（{lower.nature}）
          </div>
          {result.transformed && (
            <div className="mt-2 text-xs text-red-600 font-medium">
              变卦 → {result.transformed.unicode} {result.transformed.fullName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Birth date inputs (shared) ───────────────────────────────────────────────
function BirthInputs({ year, month, day, hour, onYear, onMonth, onDay, onHour }: {
  year: number; month: number; day: number; hour: number;
  onYear: (v: number) => void; onMonth: (v: number) => void;
  onDay: (v: number) => void; onHour: (v: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">出生年</label>
        <input type="number" value={year} onChange={e => onYear(Number(e.target.value))}
          min={1900} max={currentYear}
          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">出生月</label>
        <select value={month} onChange={e => onMonth(Number(e.target.value))}
          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">出生日</label>
        <select value={day} onChange={e => onDay(Number(e.target.value))}
          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}日</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">出生时辰</label>
        <select value={hour} onChange={e => onHour(Number(e.target.value))}
          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function FortuneTool() {
  const [method, setMethod] = useState<Method>('bazi');
  const [tab, setTab] = useState<'fortune' | 'history'>('fortune');

  // Shared birth fields
  const [birthYear, setBirthYear] = useState(1990);
  const [birthMonth, setBirthMonth] = useState(6);
  const [birthDay, setBirthDay] = useState(15);
  const [birthHour, setBirthHour] = useState(8);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  // Bazi/Ziwei aspect
  const [baziAspect, setBaziAspect] = useState('性格');
  const [ziweiAspect, setZiweiAspect] = useState('性格命格');

  // Liuyao
  const [liuyaoMethod, setLiuyaoMethod] = useState<'random' | 'time'>('random');
  const [liuyaoQuestion, setLiuyaoQuestion] = useState('');

  // Meihua
  const [meihuaInputMethod, setMeihuaInputMethod] = useState<'random' | 'time' | 'number'>('random');
  const [meihuaNum1, setMeihuaNum1] = useState('');
  const [meihuaNum2, setMeihuaNum2] = useState('');
  const [meihuaQuestion, setMeihuaQuestion] = useState('');

  // Results
  const [bazi, setBazi] = useState<BaziResult | null>(null);
  const [ziwei, setZiwei] = useState<ZiweiResult | null>(null);
  const [hexagram, setHexagram] = useState<HexagramResult | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/fortune/history');
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch { /* ignore — user may not be logged in */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab, fetchHistory]);

  function resetResults() {
    setBazi(null); setZiwei(null); setHexagram(null);
    setAnalysis(''); setError('');
  }

  async function saveToHistory(finalAnalysis: string, inputBody: Record<string, unknown>, preflightData: Record<string, unknown>) {
    try {
      await fetch('/api/fortune/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: inputBody.method,
          input: inputBody,
          preflight: preflightData,
          analysis: finalAnalysis,
        }),
      });
    } catch { /* silent — history save is best-effort */ }
  }

  async function deleteEntry(id: string) {
    if (!confirm('确定删除此记录？')) return;
    try {
      const res = await fetch(`/api/fortune/history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(h => h.filter(e => e._id !== id));
        if (expandedId === id) setExpandedId(null);
      }
    } catch { /* ignore */ }
  }

  async function calculate() {
    setLoading(true);
    resetResults();

    const body: Record<string, unknown> = { method };

    if (method === 'bazi') {
      Object.assign(body, { year: birthYear, month: birthMonth, day: birthDay, hour: birthHour, gender, aspect: baziAspect });
    } else if (method === 'ziwei') {
      Object.assign(body, { year: birthYear, month: birthMonth, day: birthDay, hour: birthHour, gender, aspect: ziweiAspect });
    } else if (method === 'liuyao') {
      Object.assign(body, { inputMethod: liuyaoMethod, question: liuyaoQuestion });
      if (liuyaoMethod === 'time') {
        Object.assign(body, { year: birthYear, month: birthMonth, day: birthDay, hour: birthHour });
      }
    } else if (method === 'meihua') {
      Object.assign(body, {
        inputMethod: meihuaInputMethod, question: meihuaQuestion,
        num1: meihuaNum1 ? Number(meihuaNum1) : undefined,
        num2: meihuaNum2 ? Number(meihuaNum2) : undefined,
      });
      if (meihuaInputMethod === 'time') {
        Object.assign(body, { year: birthYear, month: birthMonth, day: birthDay, hour: birthHour });
      }
    }

    let preflightData: Record<string, unknown> = {};

    try {
      const res = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? '请求失败');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError('无法读取响应'); return; }
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const msg = JSON.parse(raw);
            if (msg.error) { setError(msg.error); continue; }
            if (msg.bazi) { setBazi(msg.bazi); preflightData = { bazi: msg.bazi }; continue; }
            if (msg.ziwei) { setZiwei(msg.ziwei); preflightData = { ziwei: msg.ziwei }; continue; }
            if (msg.hexagram) { setHexagram(msg.hexagram); preflightData = { hexagram: msg.hexagram }; continue; }
            if (msg.text) { accumulated += msg.text; setAnalysis(accumulated); }
          } catch { /* skip */ }
        }
      }

      // Save to history after streaming completes
      if (accumulated) {
        saveToHistory(accumulated, body, preflightData);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  const amberInput = "w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white";

  return (
    <div className="space-y-6">
      {/* Tab selector: Fortune / History */}
      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setTab('fortune')}
          className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${tab === 'fortune' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          🔮 推演
        </button>
        <button onClick={() => setTab('history')}
          className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${tab === 'history' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          📋 历史记录
        </button>
      </div>

      {/* ─── History tab ─── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {historyLoading && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-2" />
              加载中...
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">暂无记录。</p>
          )}
          {!historyLoading && history.map(entry => (
            <div key={entry._id} className="border rounded-xl bg-white overflow-hidden">
              {/* Summary row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === entry._id ? null : entry._id)}>
                <span className="text-lg">{METHOD_ICON[entry.method]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{METHOD_LABEL[entry.method]}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {new Date(entry.createdAt).toLocaleString()} · {entry.analysis.slice(0, 60)}...
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteEntry(entry._id); }}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0">
                  删除
                </button>
                <span className={`text-gray-300 transition-transform ${expandedId === entry._id ? 'rotate-180' : ''}`}>▼</span>
              </div>
              {/* Expanded analysis */}
              {expandedId === entry._id && (
                <div className="border-t px-4 py-4">
                  <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700">
                    <ReactMarkdown>{entry.analysis}</ReactMarkdown>
                  </article>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Fortune tab ─── */}
      {tab === 'fortune' && (
        <>
          {/* Method selector */}
          <div className="flex gap-1 flex-wrap">
            {METHODS.map(m => (
              <button key={m.id} onClick={() => { setMethod(m.id); resetResults(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${method === m.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                <span>{m.icon}</span>{m.label}
              </button>
            ))}
          </div>

          {/* Input form */}
          <div className="border rounded-xl p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <h2 className="text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
              <span>🔮</span>
              {method === 'bazi' && '输入生辰信息'}
              {method === 'ziwei' && '输入生辰信息'}
              {method === 'liuyao' && '周易六爻起卦'}
              {method === 'meihua' && '梅花易数起卦'}
            </h2>

            {/* Bazi inputs */}
            {method === 'bazi' && (
              <>
                <BirthInputs year={birthYear} month={birthMonth} day={birthDay} hour={birthHour}
                  onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay} onHour={setBirthHour} />
                <div className="flex gap-2 mb-3">
                  {([['male','男 ♂'],['female','女 ♀']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setGender(v)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gender === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-2 block">分析方向</label>
                  <div className="flex flex-wrap gap-2">
                    {BAZI_ASPECTS.map(a => (
                      <button key={a.id} onClick={() => setBaziAspect(a.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${baziAspect === a.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                        <span>{a.icon}</span>{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Ziwei inputs */}
            {method === 'ziwei' && (
              <>
                <BirthInputs year={birthYear} month={birthMonth} day={birthDay} hour={birthHour}
                  onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay} onHour={setBirthHour} />
                <div className="flex gap-2 mb-3">
                  {([['male','男 ♂'],['female','女 ♀']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setGender(v)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gender === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-2 block">分析方向</label>
                  <div className="flex flex-wrap gap-2">
                    {ZIWEI_ASPECTS.map(a => (
                      <button key={a.id} onClick={() => setZiweiAspect(a.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${ziweiAspect === a.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                        <span>{a.icon}</span>{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Liuyao inputs */}
            {method === 'liuyao' && (
              <>
                <div className="flex gap-2 mb-3">
                  {([['random','摇卦（随机）'],['time','时间起卦']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setLiuyaoMethod(v)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${liuyaoMethod === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {liuyaoMethod === 'time' && (
                  <BirthInputs year={birthYear} month={birthMonth} day={birthDay} hour={birthHour}
                    onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay} onHour={setBirthHour} />
                )}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">所问之事（可选）</label>
                  <input value={liuyaoQuestion} onChange={e => setLiuyaoQuestion(e.target.value)}
                    placeholder="例：此次求职能否成功？"
                    className={amberInput} />
                </div>
              </>
            )}

            {/* Meihua inputs */}
            {method === 'meihua' && (
              <>
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {([['random','随机起卦'],['time','时间起卦'],['number','数字起卦']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setMeihuaInputMethod(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${meihuaInputMethod === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {meihuaInputMethod === 'time' && (
                  <BirthInputs year={birthYear} month={birthMonth} day={birthDay} hour={birthHour}
                    onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay} onHour={setBirthHour} />
                )}
                {meihuaInputMethod === 'number' && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">上卦数字</label>
                      <input type="number" value={meihuaNum1} onChange={e => setMeihuaNum1(e.target.value)}
                        placeholder="例：7" className={amberInput} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">下卦数字</label>
                      <input type="number" value={meihuaNum2} onChange={e => setMeihuaNum2(e.target.value)}
                        placeholder="例：3" className={amberInput} />
                    </div>
                  </div>
                )}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">所问之事（可选）</label>
                  <input value={meihuaQuestion} onChange={e => setMeihuaQuestion(e.target.value)}
                    placeholder="例：近期投资是否合适？"
                    className={amberInput} />
                </div>
              </>
            )}

            <button onClick={calculate} disabled={loading}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  正在推演…
                </>
              ) : '🔮 开始推演'}
            </button>
            {error && <p className="text-red-600 text-xs mt-2 text-center">{error}</p>}
            <p className="text-xs text-amber-700/60 mt-2 text-center">命理仅供参考，请理性看待</p>
          </div>

          {/* Bazi result */}
          {bazi && (
            <div className="border rounded-xl p-4 sm:p-5 bg-white">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <span>🏮</span> 四柱命盘
              </h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <PillarCard pillar={bazi.year} />
                <PillarCard pillar={bazi.month} />
                <PillarCard pillar={bazi.day} highlight />
                <PillarCard pillar={bazi.hour} />
              </div>
              <div className="flex flex-col gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 shrink-0">日主：</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md border text-sm ${ELEMENT_COLOR[bazi.dayMasterElement]}`}>
                    {bazi.dayMaster}（{bazi.dayMasterElement}）
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 shrink-0">五行：</span>
                  <ElementBar elements={bazi.elements} />
                </div>
              </div>
            </div>
          )}

          {/* Ziwei result */}
          {ziwei && (
            <div className="border rounded-xl p-4 sm:p-5 bg-white">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <span>⭐</span> 紫微命盘
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div className="border rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-0.5">命宫</div>
                  <div className="font-bold text-lg">{ziwei.mingGongBranch}</div>
                </div>
                <div className="border rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400 mb-0.5">身宫</div>
                  <div className="font-bold text-lg">{ziwei.shenGongBranch}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                纳音：{ziwei.nayinName} → <span className="font-medium text-amber-700">{ziwei.wuxingJu.name}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                {ziwei.palaces.map(p => (
                  <div key={p.name} className={`text-center text-xs border rounded p-1 ${p.name === '命宫' ? 'border-amber-400 bg-amber-50 font-bold' : p.name === '官禄' ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                    <div className="text-gray-400 text-[10px]">{p.branch}</div>
                    <div>{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hexagram result */}
          {hexagram && <HexagramDisplay result={hexagram} />}

          {/* Analysis */}
          {(analysis || (loading && (bazi || ziwei || hexagram))) && (
            <div className="border rounded-xl p-4 sm:p-5 bg-white">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                <span>📜</span> 命理分析
                {loading && <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin ml-1" />}
              </h2>
              <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </article>
            </div>
          )}
        </>
      )}
    </div>
  );
}
