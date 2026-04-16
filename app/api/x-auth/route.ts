export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildOAuthHeader } from '@/lib/xapi';

// Step 1: Get request token and redirect user to Twitter authorization
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    return Response.json({ error: 'X API credentials not configured' }, { status: 500 });
  }

  // Check if already authenticated
  if (process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET) {
    return Response.json({
      authenticated: true,
      message: 'X API access tokens are configured',
    });
  }

  return Response.json({
    authenticated: false,
    message: 'X access tokens not configured. You need to set X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET in .env.local. Get them from https://developer.x.com/en/portal/projects → your app → Keys and tokens → Access Token and Secret.',
    help: 'Go to https://developer.x.com → Your App → Keys and tokens → Generate Access Token and Secret (with Read and Write permissions). Then add X_ACCESS_TOKEN=xxx and X_ACCESS_TOKEN_SECRET=xxx to .env.local and restart the server.',
  });
}
