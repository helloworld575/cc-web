export const runtime = 'nodejs';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const taskCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN done = 0 AND deadline IS NOT NULL AND deadline < date('now', 'localtime') THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN done = 0 AND deadline = date('now', 'localtime') THEN 1 ELSE 0 END) AS due_today
    FROM todos
  `).get() as { open?: number; overdue?: number; due_today?: number };

  const dueTasks = db.prepare(`
    SELECT id, text, done, deadline, created_at
    FROM todos
    WHERE done = 0 AND deadline IS NOT NULL
    ORDER BY deadline ASC, id DESC
    LIMIT 8
  `).all();

  const aiChat = db.prepare(`
    SELECT id, title, skill_id, provider_name, provider_model, status, updated_at
    FROM ai_chat_history
    ORDER BY updated_at DESC
    LIMIT 5
  `).all();

  const claudeCode = db.prepare(`
    SELECT id, title, status, updated_at
    FROM claude_assistant_sessions
    ORDER BY updated_at DESC
    LIMIT 5
  `).all();

  return Response.json({
    taskCounts: {
      open: Number(taskCounts?.open ?? 0),
      overdue: Number(taskCounts?.overdue ?? 0),
      dueToday: Number(taskCounts?.due_today ?? 0),
    },
    dueTasks,
    recentAgents: { aiChat, claudeCode },
    integrations: { securityConfigured: Boolean(process.env.SECURITY_API_URL && process.env.SECURITY_API_KEY) },
  });
}
