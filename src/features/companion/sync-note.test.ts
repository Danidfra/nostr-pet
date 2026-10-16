import { describe, expect, it } from 'vitest';
import { syncNote } from './sync-note';

describe('what the player is told about sharing their companion', () => {
  it('says nothing while it works, when it worked, or when the choice simply lives on this device', () => {
    for (const kind of ['idle', 'syncing', 'saved', 'device-only'] as const) expect(syncNote({ kind }, 'Bo')).toBeNull();
  });

  it('a share sent and awaiting confirmation, with a retry on its way: on its way, not a warning; once retries are used up: the warning', () => {
    expect(syncNote({ kind: 'waiting', reason: 'partial', retrying: true }, 'Bambu')).toBe('Still telling your other Blobbi games about Bambu...');
    expect(syncNote({ kind: 'waiting', reason: 'partial' }, 'Bambu')).toBe("Your other Blobbi games don't know about Bambu yet.");
    // Never softened for a real failure, even with a retry scheduled
    expect(syncNote({ kind: 'waiting', reason: 'failed', retrying: true }, 'Bambu')).toBe("Your other Blobbi games don't know about Bambu yet.");
  });

  it('names the Blobbi in plain words, without protocol terms', () => {
    for (const reason of ['offline', 'unsafe', 'partial', 'failed', 'sign-failed', 'not-sent'] as const) {
      const note = syncNote({ kind: 'waiting', reason }, 'Bo')!;
      expect(note).toContain('Bo');
      expect(note).not.toMatch(/relay|profile|event|kind|11125|d-tag|nostr|sign(ature|ed)\b|publish/i);
    }
  });
});
