/**
 * One blocking layer at a time (M15): the queue, and `GameOverlay` on it.
 */
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { blockingHolder, claimBlockingLayer, isBlockingLayerOpen, releaseBlockingLayer, resetBlockingLayers, useBlockingLayer, useBlockingLayerOpen } from './blocking-layer';

describe('the queue', () => {
  it('the oldest claim holds; the next one takes over when it is released; a repeated claim is one claim', () => {
    expect(blockingHolder()).toBeNull();
    expect(isBlockingLayerOpen()).toBe(false);
    claimBlockingLayer('a');
    claimBlockingLayer('b');
    claimBlockingLayer('a');
    expect(blockingHolder()).toBe('a');
    expect(isBlockingLayerOpen()).toBe(true);
    releaseBlockingLayer('a');
    expect(blockingHolder()).toBe('b');
    releaseBlockingLayer('zzz');
    expect(blockingHolder()).toBe('b');
    releaseBlockingLayer('b');
    expect(blockingHolder()).toBeNull();
    resetBlockingLayers();
  });

  it('a waiter that leaves before its turn is simply gone', () => {
    claimBlockingLayer('a');
    claimBlockingLayer('b');
    claimBlockingLayer('c');
    releaseBlockingLayer('b');
    releaseBlockingLayer('a');
    expect(blockingHolder()).toBe('c');
    resetBlockingLayers();
  });
});

function Layer({ wanted, label }: { wanted: boolean; label: string }) {
  const held = useBlockingLayer(wanted);
  return <div data-testid={`layer-${label}`} data-held={held ? 'true' : 'false'} />;
}
function Watcher() {
  const open = useBlockingLayerOpen();
  return <div data-testid="watcher" data-open={open ? 'true' : 'false'} />;
}

describe('useBlockingLayer', () => {
  it('two layers wanting the surface at once: the first in tree order holds, the second waits and then takes over', () => {
    const view = render(
      <>
        <Layer wanted label="one" />
        <Layer wanted label="two" />
        <Watcher />
      </>,
    );
    expect(screen.getByTestId('layer-one')).toHaveAttribute('data-held', 'true');
    expect(screen.getByTestId('layer-two')).toHaveAttribute('data-held', 'false');
    expect(screen.getByTestId('watcher')).toHaveAttribute('data-open', 'true');
    view.rerender(
      <>
        <Layer wanted={false} label="one" />
        <Layer wanted label="two" />
        <Watcher />
      </>,
    );
    expect(screen.getByTestId('layer-one')).toHaveAttribute('data-held', 'false');
    expect(screen.getByTestId('layer-two')).toHaveAttribute('data-held', 'true');
    view.rerender(
      <>
        <Layer wanted={false} label="one" />
        <Layer wanted={false} label="two" />
        <Watcher />
      </>,
    );
    expect(screen.getByTestId('watcher')).toHaveAttribute('data-open', 'false');
  });

  it('a layer that stops wanting the surface while waiting never holds it', () => {
    const view = render(
      <>
        <Layer wanted label="one" />
        <Layer wanted label="two" />
      </>,
    );
    view.rerender(
      <>
        <Layer wanted label="one" />
        <Layer wanted={false} label="two" />
      </>,
    );
    expect(screen.getByTestId('layer-two')).toHaveAttribute('data-held', 'false');
    view.rerender(
      <>
        <Layer wanted={false} label="one" />
        <Layer wanted={false} label="two" />
      </>,
    );
    expect(blockingHolder()).toBeNull();
  });
});

function TwoSheets({ first, second }: { first: boolean; second: boolean }) {
  return (
    <>
      <GameOverlay open={first} onClose={() => {}} title="First" testId="first">
        <p>first body</p>
      </GameOverlay>
      <GameOverlay open={second} onClose={() => {}} title="Second" testId="second">
        <p>second body</p>
      </GameOverlay>
    </>
  );
}

describe('GameOverlay on the queue', () => {
  it('never renders two sheets at once: the second waits, unrendered, and rises when the first closes', () => {
    const view = render(<TwoSheets first second />);
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.queryByTestId('second')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    view.rerender(<TwoSheets first={false} second />);
    expect(screen.queryByTestId('first')).toBeNull();
    expect(screen.getByTestId('second')).toBeInTheDocument();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('a close-this-open-that done in one render hands the surface over in the same commit', () => {
    function Swap() {
      const [which, setWhich] = useState<'a' | 'b'>('a');
      return (
        <>
          <button type="button" onClick={() => setWhich('b')} data-testid="swap" />
          <GameOverlay open={which === 'a'} onClose={() => {}} title="A" testId="a">
            <p>a</p>
          </GameOverlay>
          <GameOverlay open={which === 'b'} onClose={() => {}} title="B" testId="b">
            <p>b</p>
          </GameOverlay>
        </>
      );
    }
    render(<Swap />);
    expect(screen.getByTestId('a')).toBeInTheDocument();
    act(() => screen.getByTestId('swap').click());
    expect(screen.queryByTestId('a')).toBeNull();
    expect(screen.getByTestId('b')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('a waiting sheet does not lock the page or take the focus; the holder does', () => {
    const view = render(<TwoSheets first second />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByTestId('first-close'));
    view.rerender(<TwoSheets first={false} second={false} />);
    expect(document.body.style.overflow).toBe('');
    expect(blockingHolder()).toBeNull();
  });

  it('something outside a sheet (an invitation) can tell that a sheet is open', () => {
    const view = render(
      <>
        <Watcher />
        <TwoSheets first second={false} />
      </>,
    );
    expect(screen.getByTestId('watcher')).toHaveAttribute('data-open', 'true');
    view.rerender(
      <>
        <Watcher />
        <TwoSheets first={false} second={false} />
      </>,
    );
    expect(screen.getByTestId('watcher')).toHaveAttribute('data-open', 'false');
  });
});
