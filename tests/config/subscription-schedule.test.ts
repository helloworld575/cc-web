import { describe, expect, it } from 'vitest';
import {
  getNextShanghaiRun,
  shouldRunOnStart,
} from '../../scripts/subscription-schedule.mjs';

describe('subscription daily scheduler', () => {
  it('targets the configured Shanghai hour without interval drift', () => {
    expect(getNextShanghaiRun(new Date('2026-07-16T07:59:00.000Z'), 16).toISOString())
      .toBe('2026-07-16T08:00:00.000Z');
    expect(getNextShanghaiRun(new Date('2026-07-16T08:01:00.000Z'), 16).toISOString())
      .toBe('2026-07-17T08:00:00.000Z');
  });

  it('rejects an invalid daily hour', () => {
    expect(() => getNextShanghaiRun(new Date(), 24)).toThrow('hour');
  });

  it('skips an early restart and only catches up after the target hour', () => {
    expect(shouldRunOnStart(new Date('2026-07-15T23:00:00.000Z'), 8)).toBe(false);
    expect(shouldRunOnStart(new Date('2026-07-16T01:00:00.000Z'), 8)).toBe(true);
  });
});
