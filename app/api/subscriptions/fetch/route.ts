export const runtime = 'nodejs';
export const maxDuration = 300;
import { POST as integratePost } from '@/app/api/subscriptions/integrate/route';

export const POST = integratePost;
