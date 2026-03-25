'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/components/useLocale';

interface Todo { id: number; text: string; done: number; deadline?: string; }

function getUrgency(deadline: string): 'overdue' | 'today' | 'tomorrow' | 'soon' | null {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  if (deadline < today) return 'overdue';
  if (deadline === today) return 'today';
  if (deadline === tomorrow) return 'tomorrow';
  if (deadline <= in3) return 'soon';
  return null;
}

export default function DeadlineAlert() {
  const [urgent, setUrgent] = useState<Array<Todo & { urgency: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    fetch('/api/todos')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((todos: Todo[]) => {
        const result = todos
          .filter(todo => !todo.done && todo.deadline)
          .map(todo => ({ ...todo, urgency: getUrgency(todo.deadline!) }))
          .filter(todo => todo.urgency !== null) as Array<Todo & { urgency: string }>;
        setUrgent(result);
      })
      .catch(() => {});
  }, []);

  if (dismissed || urgent.length === 0) return null;

  const urgencyColor: Record<string, string> = {
    overdue: 'bg-red-50 border-red-400 text-red-800',
    today: 'bg-orange-50 border-orange-400 text-orange-800',
    tomorrow: 'bg-yellow-50 border-yellow-400 text-yellow-800',
    soon: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  };

  const badgeColor: Record<string, string> = {
    overdue: 'bg-red-200 text-red-800',
    today: 'bg-orange-200 text-orange-800',
    tomorrow: 'bg-yellow-200 text-yellow-800',
    soon: 'bg-yellow-100 text-yellow-700',
  };

  const urgencyText: Record<string, string> = {
    overdue: t('deadlineOverdue'),
    today: t('deadlineToday'),
    tomorrow: t('deadlineTomorrow'),
    soon: t('deadlineSoon'),
  };

  // Use the most severe urgency for the banner color
  const topUrgency = urgent.find(u => u.urgency === 'overdue')?.urgency
    ?? urgent.find(u => u.urgency === 'today')?.urgency
    ?? urgent.find(u => u.urgency === 'tomorrow')?.urgency
    ?? 'soon';

  return (
    <div className={`border-b px-4 py-2 ${urgencyColor[topUrgency]}`}>
      <div className="max-w-4xl mx-auto flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5">⏰</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-1">{t('deadlineAlertTitle')}</p>
          <ul className="space-y-0.5">
            {urgent.map(todo => (
              <li key={todo.id} className="flex items-center gap-1.5 text-xs flex-wrap">
                <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${badgeColor[todo.urgency]}`}>
                  {urgencyText[todo.urgency]}
                </span>
                <Link href="/admin/tools" className="hover:underline truncate min-w-0">{todo.text}</Link>
                <span className="opacity-60 shrink-0">{todo.deadline}</span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setDismissed(true)} className="text-xl opacity-50 hover:opacity-100 leading-none shrink-0">×</button>
      </div>
    </div>
  );
}
