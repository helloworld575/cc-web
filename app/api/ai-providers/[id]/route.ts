export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEnvProviderById, toPublicProvider } from '@/lib/ai-providers';

const CONFIG_DISABLED_ERROR = 'AI provider configuration is temporarily disabled; configure Claude and ChatGPT in .env.local.';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = getEnvProviderById(Number(params.id));
  if (!provider) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(toPublicProvider(provider));
}

export async function PUT(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({ error: CONFIG_DISABLED_ERROR }, { status: 403 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return Response.json({ error: CONFIG_DISABLED_ERROR }, { status: 403 });
}
