import { describe, expect, it } from 'vitest';
import { serializeBlobbiWrite } from './blobbi-writes';

describe('one write at a time per Blobbi', () => {
  it('runs writes for the same Blobbi in turn, even when one fails; other Blobbis do not wait', async () => {
    const log: string[] = [];
    let releaseFirst!: () => void;
    const first = serializeBlobbiWrite('pk', 'd1', async () => {
      log.push('care start');
      await new Promise<void>((r) => (releaseFirst = r));
      log.push('care end');
      throw new Error('relay down');
    });
    const second = serializeBlobbiWrite('pk', 'd1', async () => {
      log.push('rename');
      return 'renamed';
    });
    const other = serializeBlobbiWrite('pk', 'd2', async () => {
      log.push('other blobbi');
    });
    await other;
    expect(log).toEqual(['care start', 'other blobbi']);
    releaseFirst();
    await expect(first).rejects.toThrow('relay down');
    await expect(second).resolves.toBe('renamed');
    expect(log).toEqual(['care start', 'other blobbi', 'care end', 'rename']);
  });
});
