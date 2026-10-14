/**
 * The bath's bar, in the dock where the carousel was: ONE tool at a time
 * (the stage's), the line that says what to do, how far the stage has come,
 * and the ways out: Stop at any step before the write, Try again after a
 * failed write (the player's tap only). The same bar on the 2D home (the
 * options slot) and in the 3D room (the carousel's middle).
 */
import { RotateCcw, Square } from 'lucide-react';
import { ItemGlyph } from '@/features/inventory';
import { TOOL_LABEL } from './bath-machine';
import type { BathView } from './useBathSession';
import { BathToolArt } from './BathTools';
import './bath.css';

interface BathToolBarProps {
  view: BathView;
  onStop: () => void;
  onRetry: () => void;
  reducedMotion: boolean;
  /** Where it stands: the 2D home's dock, or the room's. */
  variant?: 'home' | 'room';
}

export function BathToolBar({ view, onStop, onRetry, reducedMotion, variant = 'home' }: BathToolBarProps) {
  const { status, stage, tool, progress, guidance, item, error } = view;
  const canStop = status === 'entering' || status === 'soap' || status === 'rinse' || status === 'dry' || status === 'failed';
  const showProgress = tool !== null;
  return (
    <div
      className={`bath-bar bath-bar--${variant}`}
      role="group"
      aria-label={`Bath with ${item.name}`}
      data-testid="bath-bar"
      data-status={status}
      data-stage={stage ?? ''}
      data-tool={tool ?? 'none'}
      data-reduced={reducedMotion ? 'true' : undefined}
    >
      <div className="bath-bar__tool" data-testid="bath-tool" data-tool={tool ?? 'none'} aria-hidden>
        {tool ? <BathToolArt tool={tool} className="bath-bar__tool-art" /> : <span className="bath-bar__item"><ItemGlyph glyph={item.glyph} fill /></span>}
      </div>
      <div className="bath-bar__body">
        <p className="bath-bar__text" role="status" aria-live="polite" data-testid="bath-guidance">
          {tool && <span className="bath-bar__tool-name">{TOOL_LABEL[tool]}</span>}
          {guidance}
        </p>
        {showProgress && (
          <div className="bath-bar__progress" role="progressbar" aria-label={`${TOOL_LABEL[tool!]} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-testid="bath-progress">
            <span className="bath-bar__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {status === 'failed' && (
          <p className="bath-bar__error" role="alert" data-testid="bath-error">
            {error || 'That did not work.'}
          </p>
        )}
      </div>
      <div className="bath-bar__actions">
        {status === 'failed' && (
          <button type="button" className="bath-bar__button bath-bar__button--retry" onClick={onRetry} data-testid="bath-retry">
            <RotateCcw className="size-[1em]" aria-hidden /> Try again
          </button>
        )}
        {canStop && (
          <button type="button" className="bath-bar__button bath-bar__button--stop" onClick={onStop} aria-label="Stop the bath" data-testid="bath-stop">
            <Square className="size-[1em]" aria-hidden /> Stop
          </button>
        )}
      </div>
    </div>
  );
}
