import { describe, expect, it, vi } from 'vitest';
import { getPublicKey, nip19 } from 'nostr-tools';
import { createNewAccount, downloadNsecBackup, isNsec, npubForNsec, nsecBackupFilename, readNsecFromText } from './new-account';

describe('a new account', () => {
  it('is a fresh nostr-tools key pair, encoded with nip19, different every time', () => {
    const a = createNewAccount();
    const b = createNewAccount();
    expect(a.nsec).toMatch(/^nsec1[a-z0-9]{58}$/);
    expect(a.npub).toMatch(/^npub1[a-z0-9]{58}$/);
    expect(a.nsec).not.toBe(b.nsec);
    const decoded = nip19.decode(a.nsec);
    expect(decoded.type).toBe('nsec');
    expect(getPublicKey(decoded.data as Uint8Array)).toBe(a.pubkey);
    expect(nip19.npubEncode(a.pubkey)).toBe(a.npub);
  });

  it('recognises an nsec by shape and checksum, and finds exactly one in a text', () => {
    const { nsec } = createNewAccount();
    expect(isNsec(nsec)).toBe(true);
    expect(isNsec(nsec.slice(0, -1) + (nsec.endsWith('q') ? 'p' : 'q'))).toBe(false);
    expect(isNsec('npub1' + nsec.slice(5))).toBe(false);
    expect(readNsecFromText(`  ${nsec}\n`)).toBe(nsec);
    expect(readNsecFromText(`${nsec} and ${createNewAccount().nsec}`)).toBeNull();
    expect(readNsecFromText('nothing here')).toBeNull();
  });

  it('names the backup file by the public suffix, never by anything secret', () => {
    const { nsec, npub } = createNewAccount();
    const name = nsecBackupFilename(nsec);
    expect(name).toBe(`blobbi-nostr-key-backup-${npub.slice(5, 13)}.txt`);
    expect(name).not.toContain(nsec.slice(5, 15));
    expect(npubForNsec(nsec)).toBe(npub);
    expect(() => nsecBackupFilename('nsec1nope')).toThrow();
  });

  it('downloads through an object URL that is revoked, and refuses where object URLs do not exist', () => {
    const { nsec } = createNewAccount();
    const clicks: string[] = [];
    const create = vi.fn((_blob: Blob) => 'blob:fake');
    const revoke = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(`${this.href}|${this.download}`);
    };
    vi.useFakeTimers();
    try {
      expect(downloadNsecBackup(nsec)).toBe(true);
      expect(clicks).toEqual([`blob:fake|${nsecBackupFilename(nsec)}`]);
      expect(String(create.mock.calls[0][0])).not.toContain(nsec);
      vi.advanceTimersByTime(1_100);
      expect(revoke).toHaveBeenCalledWith('blob:fake');
      Object.assign(URL, { createObjectURL: undefined });
      expect(downloadNsecBackup(nsec)).toBe(false);
    } finally {
      vi.useRealTimers();
      Object.assign(URL, { createObjectURL: originalCreate, revokeObjectURL: originalRevoke });
    }
  });
});
