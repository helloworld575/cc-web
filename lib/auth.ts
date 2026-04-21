import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { timingSafeEqual } from 'crypto';

export function isWeakAdminPassword(password?: string | null) {
  return !password || password === 'changeme';
}

export function verifyAdminPassword(candidate?: string | null, adminPassword = process.env.ADMIN_PASSWORD) {
  if (!candidate || !adminPassword) return false;

  const candidateBuffer = Buffer.from(candidate);
  const adminPasswordBuffer = Buffer.from(adminPassword);
  if (candidateBuffer.length !== adminPasswordBuffer.length) return false;

  return timingSafeEqual(candidateBuffer, adminPasswordBuffer);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Password',
      credentials: { password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (process.env.NODE_ENV === 'production' && isWeakAdminPassword(adminPassword)) {
          console.error('ADMIN_PASSWORD must be set to a non-default value in production.');
          return null;
        }

        if (verifyAdminPassword(credentials?.password, adminPassword)) {
          return { id: '1', name: 'Admin' };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
};
