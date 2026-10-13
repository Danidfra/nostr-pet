/**
 * The secret key as a scene (M12.3), in isolation: the facts stand before any
 * action and never behind one; the key is text (never an input's value, a
 * link or a URL); the confirmation appears only once a way to keep it was
 * chosen; a download is never called done; reduced motion stills the scene;
 * a browser that cannot make a key says so.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import type { NPool } from '@nostrify/nostrify';
import { SceneSettingsProvider } from '@/features/home/scene';
import { CreateAccountScreen, KEY_HEADLINE } from './KeyScene';

const nostrTools = vi.hoisted(() => ({ broken: false }));
vi.mock('nostr-tools', async (importOriginal) => {
  const real = await importOriginal<typeof import('nostr-tools')>();
  return {
    ...real,
    generateSecretKey: () => {
      if (nostrTools.broken) throw new Error('no secure randomness');
      return real.generateSecretKey();
    },
  };
});

// Nothing here reads or writes a relay: a pool that would say so
const pool = { query: vi.fn(async () => []), event: vi.fn(async () => {}), group: () => pool } as unknown as NPool;

async function scene(reducedMotion = false) {
  const onBack = vi.fn();
  render(
    <SceneSettingsProvider value={{ reducedMotion, idleEnabled: false }}>
      <NostrContext.Provider value={{ nostr: pool }}>
        <NostrLoginProvider storageKey="test:key-scene">
          <CreateAccountScreen onBack={onBack} />
        </NostrLoginProvider>
      </NostrContext.Provider>
    </SceneSettingsProvider>,
  );
  return { onBack, root: await screen.findByTestId('onboarding-create-account') };
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => {
  nostrTools.broken = false;
  window.localStorage.clear();
});

describe('the key, given', () => {
  it('the headline, the four facts before any action, and the key as text only', async () => {
    const { root } = await scene();
    expect(within(root).getByRole('heading', { level: 2 })).toHaveTextContent(KEY_HEADLINE);
    const facts = within(root).getByRole('note', { name: 'About your secret key' });
    expect(within(facts).getAllByRole('listitem')).toHaveLength(4);
    const nsec = within(root).getByTestId('nsec-box').textContent!;
    expect(nsec).toMatch(/^nsec1/);
    // Never a form value, a link or a URL
    for (const input of root.querySelectorAll('input, textarea')) expect((input as HTMLInputElement).value).not.toContain(nsec.slice(5));
    for (const a of root.querySelectorAll('a')) expect(a.getAttribute('href') ?? '').not.toContain(nsec.slice(5));
    expect(window.location.href).not.toContain(nsec.slice(5));
    // Nothing to confirm before a way to keep it was chosen
    expect(screen.queryByTestId('key-confirm')).toBeNull();
  });

  it('a download asked of the browser is not called done; the confirmation follows; Continue needs the checkbox', async () => {
    await scene();
    fireEvent.click(screen.getByTestId('nsec-download'));
    expect(screen.getByTestId('nsec-note')).toHaveTextContent(/was asked to save/);
    expect(screen.getByTestId('nsec-note').textContent).not.toMatch(/\bdownloaded\b|\bsaved\b(?! somewhere)/i);
    const go = within(screen.getByTestId('key-confirm')).getByTestId('onboarding-continue');
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByTestId('key-saved'));
    expect(go).toBeEnabled();
    fireEvent.click(go);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('test:key-scene') ?? '[]')).toHaveLength(1));
  });

  it('reduced motion: the scene is still, the words the same', async () => {
    const { root } = await scene(true);
    expect(root).toHaveAttribute('data-reduced', 'true');
    expect(within(root).getByRole('heading', { level: 2 })).toHaveTextContent(KEY_HEADLINE);
  });

  it('Back leaves the key behind', async () => {
    const { onBack } = await scene();
    fireEvent.click(screen.getByTestId('onboarding-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('a browser that cannot make a secure key says so, with the way back', async () => {
    nostrTools.broken = true;
    await scene();
    expect(screen.getByTestId('create-account-unsupported')).toHaveTextContent(/cannot make a secure key/);
    expect(screen.queryByTestId('nsec-box')).toBeNull();
    expect(screen.getByTestId('onboarding-back')).toBeInTheDocument();
  });
});
