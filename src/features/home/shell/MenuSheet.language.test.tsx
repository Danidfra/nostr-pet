/** Switching the language reloads the page: it waits for a save under way and never runs over unsaved work. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrLoginProvider } from '@nostrify/react/login';
import { NostrContext } from '@nostrify/react';

vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: undefined, users: [], metadata: undefined }) }));
const changeLocale = vi.hoisted(() => vi.fn());
vi.mock('@/i18n', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n')>()), changeLocale }));
import { MenuSheet } from './MenuSheet';
import { holdUnsaved, trackWrite } from '@/lib/pending-writes';

async function renderMenu() {
  render(
    <NostrLoginProvider storageKey="test:login">
      <NostrContext.Provider value={{ nostr: { query: async () => [], event: async () => {} } as never }}>
        <QueryClientProvider client={new QueryClient()}>
          <MenuSheet open onClose={() => {}} />
        </QueryClientProvider>
      </NostrContext.Provider>
    </NostrLoginProvider>,
  );
  await screen.findByTestId('menu-language');
}

afterEach(() => changeLocale.mockReset());

describe('the language switch', () => {
  it('with nothing pending, switches at once', async () => {
    await renderMenu();
    await act(async () => screen.getByTestId('locale-pt-BR').click());
    expect(changeLocale).toHaveBeenCalledWith('pt-BR');
  });

  it('waits for a save under way, saying so, then switches', async () => {
    let finish!: () => void;
    void trackWrite(new Promise<void>((r) => (finish = r)));
    await renderMenu();
    await act(async () => screen.getByTestId('locale-es').click());
    expect(changeLocale).not.toHaveBeenCalled();
    expect(screen.getByTestId('menu-language-hint')).toHaveTextContent(/Finishing a save/);
    await act(async () => finish());
    expect(changeLocale).toHaveBeenCalledWith('es');
  });

  it('never over unsaved work: the choices wait until it is saved or cancelled', async () => {
    const release = holdUnsaved('room-decorator');
    await renderMenu();
    expect(screen.getByTestId('locale-es')).toBeDisabled();
    expect(screen.getByTestId('menu-language-hint')).toHaveTextContent(/decoration/);
    act(() => release());
    expect(screen.getByTestId('locale-es')).toBeEnabled();
  });
});
