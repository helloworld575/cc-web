import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscription admin health contract', () => {
  it('renders disabled and failure health fields in the admin page', () => {
    const page = fs.readFileSync('app/admin/subscriptions/page.tsx', 'utf8');
    for (const field of ['failure_count', 'last_error_code', 'last_failed_at', 'subscription-source-failure']) {
      expect(page).toContain(field);
    }
  });
});
