import { describe, expect, it } from 'vitest';
import { checkProfileForm, mergeProfileMetadata, profileFormFrom } from './profile-plan';

describe('the profile write', () => {
  it('checks the form: a name is needed, a picture must be a web address', () => {
    expect(checkProfileForm({ name: '  ', about: '', picture: '' })).toEqual({ ok: false, reason: expect.stringMatching(/name/) });
    expect(checkProfileForm({ name: 'Dana', about: '', picture: 'javascript:alert(1)' })).toEqual({ ok: false, reason: expect.stringMatching(/web address/) });
    expect(checkProfileForm({ name: 'Dana', about: '', picture: 'not a url' }).ok).toBe(false);
    expect(checkProfileForm({ name: ' Dana  Q ', about: ' hi ', picture: 'https://x.test/a.png' })).toEqual({ ok: true, value: { name: 'Dana Q', about: 'hi', picture: 'https://x.test/a.png' } });
  });

  it('keeps everything the player set elsewhere and touches only the form fields', () => {
    const existing = { name: 'old', display_name: 'Old Name', about: 'was', nip05: 'dana@x.test', lud16: 'dana@wallet.test', picture: 'https://x.test/old.png', banner: 'https://x.test/b.png' };
    const merged = mergeProfileMetadata(existing, { name: 'Dana', about: '', picture: '' });
    expect(merged).toEqual({ name: 'Dana', display_name: 'Old Name', nip05: 'dana@x.test', lud16: 'dana@wallet.test', picture: 'https://x.test/old.png', banner: 'https://x.test/b.png' });
    expect(mergeProfileMetadata(undefined, { name: 'Dana', about: 'hello', picture: 'https://x.test/p.png' })).toEqual({ name: 'Dana', display_name: 'Dana', about: 'hello', picture: 'https://x.test/p.png' });
    expect(mergeProfileMetadata({ name: 'x', display_name: 'x' }, { name: 'Dana', about: '', picture: '' })).toEqual({ name: 'Dana', display_name: 'Dana' });
  });

  it('prefills from what exists', () => {
    expect(profileFormFrom(undefined)).toEqual({ name: '', about: '', picture: '' });
    expect(profileFormFrom({ display_name: 'Dee' })).toEqual({ name: 'Dee', about: '', picture: '' });
  });
});
