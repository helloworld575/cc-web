export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEnvProviders, toPublicProvider } from '@/lib/ai-providers';

const CONFIG_DISABLED_ERROR = 'AI provider configuration is temporarily disabled; configure Claude and ChatGPT in .env.local.';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const masked = getEnvProviders().map(provider => toPublicProvider(provider));
  return Response.json(masked);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ error: CONFIG_DISABLED_ERROR }, { status: 403 });
}
