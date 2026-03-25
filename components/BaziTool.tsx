'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { type BaziResult, ELEMENT_COLOR } from '@/lib/bazi';

const ASPECTS = [
  { id: '性格', label: '性格特质', icon: '🧠' },
  { id: '事业', label: '事业财运', icon: '💼' },
  { id: '婚姻', label: '婚恋感情', icon: '💑' },
  { id: '健康', label: '健康养生', icon: '🌿' },
  { id: '流年运势', label: '流年运势', icon: '📅' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const labels = ['子(23-1)','子(0-1)','丑(1-3)','丑(2-3)','寅(3-5)','寅(4-5)','卯(5-7)','卯(6-7)',
    '辰(7-9)','辰(8-9)','巳(9-11)','巳(10-11)','午(11-13)','午(12-13)','未(13-15)','未(14-15)',
    '申(15-17)','申(16-17)','酉(17-19)','酉(18-19)','戌(19-21)','戌(20-21)','亥(21-23)','亥(22-23)'];
  return { value: i, label: `${String(i).padStart(2,'0')}:00 ${labels[i]}` };
});

const ELEMENT_ICON: Record<string, string> = { '木':'🌳','火':'🔥','土':'🪨','金':'⚙️','水':'💧' };

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
  const total = Object.values(elements).reduce((a, b) => a + b, 0);
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

export default function BaziTool() {
  const currentYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState(1990);
  const [birthMonth, setBirthMonth] = useState(6);
  const [birthDay, setBirthDay] = useState(15);
  const [birthHour, setBirthHour] = useState(8);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [aspect, setAspect] = useState('性格');
  const [bazi, setBazi] = useState<BaziResult | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function calculate() {
    setLoading(true);
    setError('');
    setAnalysis('');
    setBazi(null);

    try {
      const res = await fetch('/api/bazi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: birthYear, month: birthMonth, day: birthDay, hour: birthHour, gender, aspect }),
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
            if (msg.bazi) { setBazi(msg.bazi); continue; }
            if (msg.text) { accumulated += msg.text; setAnalysis(accumulated); }
          } catch { /* skip */ }
        }
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input form */}
      <div className="border rounded-xl p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <h2 className="text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
          <span>🔮</span> 输入生辰信息
        </h2>

        {/* Date/Time inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">出生年</label>
            <input type="number" value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}
              min={1900} max={currentYear}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">出生月</label>
            <select value={birthMonth} onChange={e => setBirthMonth(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">出生日</label>
            <select value={birthDay} onChange={e => setBirthDay(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">出生时辰</label>
            <select value={birthHour} onChange={e => setBirthHour(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
              {HOURS.map(h => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gender */}
        <div className="flex gap-2 mb-3">
          {([['male','男 ♂'],['female','女 ♀']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setGender(v)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gender === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Aspect */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block">分析方向</label>
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map(a => (
              <button key={a.id} onClick={() => setAspect(a.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${aspect === a.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50'}`}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={calculate} disabled={loading}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2">
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              正在推演命盘…
            </>
          ) : '🔮 开始算命'}
        </button>
        {error && <p className="text-red-600 text-xs mt-2 text-center">{error}</p>}
        <p className="text-xs text-amber-700/60 mt-2 text-center">八字计算基于节气近似值，如知晓精确八字可忽略误差</p>
      </div>

      {/* Four Pillars Display */}
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

      {/* Analysis Result */}
      {(analysis || (loading && bazi)) && (
        <div className="border rounded-xl p-4 sm:p-5 bg-white">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <span>{ASPECTS.find(a => a.id === aspect)?.icon ?? '📜'}</span>
            {ASPECTS.find(a => a.id === aspect)?.label} 分析
            {loading && <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin ml-1" />}
          </h2>
          <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}
