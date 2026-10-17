import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LOOKING_SAID_AFTER_MS, TravelAnnouncer, travelAnnouncement } from './TravelAnnouncer';

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

const base = { name: 'Brook', place: 'blobbi-home', nameOf: (p: string) => (p === 'blobbi-pixel' ? 'Blobbi Pixel' : 'another Blobbi world'), unreachable: false };

describe('travelAnnouncement', () => {
  it('says what changed, and nothing for a Blobbi simply at home', () => {
    expect(travelAnnouncement({ ...base, view: 'here' }, null)).toBeNull();
    expect(travelAnnouncement({ ...base, view: 'looking' }, null)).toBe('Looking for Brook…');
    expect(travelAnnouncement({ ...base, view: 'here' }, 'Looking for Brook…')).toBe('Brook is here.');
    expect(travelAnnouncement({ ...base, view: 'away', place: 'blobbi-pixel' }, null)).toBe('Brook is in Blobbi Pixel.');
    expect(travelAnnouncement({ ...base, view: 'coming' }, null)).toBe('Calling Brook home…');
    expect(travelAnnouncement({ ...base, view: 'away', place: 'nostr-farm', unreachable: true }, null)).toBe("Brook is in another Blobbi world. Couldn't reach the Blobbi relays.");
    expect(travelAnnouncement({ ...base, view: 'here', unreachable: true }, null)).toBe("Brook is shown at home. Couldn't reach the Blobbi relays.");
  });
});

describe('TravelAnnouncer', () => {
  it('one polite status region in document.body, outside any aria-hidden ancestor; inactive renders nothing', async () => {
    const { rerender } = render(
      <div aria-hidden="true">
        <TravelAnnouncer {...base} active view="looking" />
      </div>,
    );
    const region = screen.getByTestId('world-travel-announcer');
    expect(region.parentElement).toBe(document.body);
    expect(region.closest('[aria-hidden="true"]')).toBeNull();
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent(/^$/);
    await wait(LOOKING_SAID_AFTER_MS + 50);
    expect(region).toHaveTextContent('Looking for Brook…');
    rerender(
      <div aria-hidden="true">
        <TravelAnnouncer {...base} active={false} view="looking" />
      </div>,
    );
    expect(screen.queryByTestId('world-travel-announcer')).toBeNull();
  });

  it('a re-render with the same state never changes the text (no repeated announcement)', () => {
    const { rerender } = render(<TravelAnnouncer {...base} active view="away" place="blobbi-pixel" />);
    const region = screen.getByTestId('world-travel-announcer');
    const first = region.textContent;
    for (let i = 0; i < 5; i++) rerender(<TravelAnnouncer {...base} active view="away" place="blobbi-pixel" />);
    expect(region.textContent).toBe(first);
    rerender(<TravelAnnouncer {...base} active view="coming" place="blobbi-pixel" />);
    expect(region).toHaveTextContent('Calling Brook home…');
    rerender(<TravelAnnouncer {...base} active view="here" />);
    expect(region).toHaveTextContent('Brook is here.');
  });
});

describe('TravelAnnouncer: a quick first look', () => {
  it('relays answering within LOOKING_SAID_AFTER_MS: nothing is said at all (home), or only where it is (away)', async () => {
    const { rerender } = render(<TravelAnnouncer {...base} active view="looking" />);
    const region = screen.getByTestId('world-travel-announcer');
    await wait(100);
    rerender(<TravelAnnouncer {...base} active view="here" />);
    await wait(LOOKING_SAID_AFTER_MS + 50);
    expect(region).toHaveTextContent(/^$/);
    rerender(<TravelAnnouncer {...base} active view="away" place="blobbi-pixel" />);
    expect(region).toHaveTextContent('Brook is in Blobbi Pixel.');
  });
});
