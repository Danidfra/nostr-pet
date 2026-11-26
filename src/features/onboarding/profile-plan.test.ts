import { describe, expect, it } from 'vitest';
import { checkProfileForm, profileFormFrom } from './profile-plan';

describe('the profile write', () => {
  it('checks the form: a name is needed, a picture must be a web address', () => {
    expect(checkProfileForm({ name: '  ', about: '', picture: '' })).toEqual({ ok: false, reason: expect.stringMatching(/name/) });
    expect(checkProfileForm({ name: 'Dana', about: '', picture: 'javascript:alert(1)' })).toEqual({ ok: false, reason: expect.stringMatching(/web address/) });
    expect(checkProfileForm({ name: 'Dana', about: '', picture: 'not a url' }).ok).toBe(false);
    expect(checkProfileForm({ name: ' Dana  Q ', about: ' hi ', picture: 'https://x.test/a.png' })).toEqual({ ok: true, value: { name: 'Dana Q', about: 'hi', picture: 'https://x.test/a.png' } });
  });

  it('prefills from what exists', () => {
    expect(profileFormFrom(undefined)).toEqual({ name: '', about: '', picture: '' });
    expect(profileFormFrom({ display_name: 'Dee' })).toEqual({ name: 'Dee', about: '', picture: '' });
  });
});
