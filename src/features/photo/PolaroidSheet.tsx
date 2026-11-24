/**
 * The Polaroid: a portrait of the Blobbi to keep or to send.
 *
 * One game overlay (`GameOverlay`, as the details and the Journey are):
 * the picture as it will be saved, three frames to choose from, a caption
 * to write or leave empty, the date if wanted (off unless asked for), and
 * the way out of the app: the device's share sheet where it takes an image,
 * a download everywhere.
 *
 * The preview IS the picture: the same PNG that is shared or saved, shown
 * in a real `<img>`, so what is seen is what is kept, and on a phone a long
 * press on it saves it even where a download cannot (an installed iPhone
 * app). It is drawn again a moment after anything changes; the last
 * picture stays up meanwhile, and the buttons act on the picture shown.
 *
 * Nothing here is written anywhere: no event, no relay, no stat, no stored
 * caption. The picture exists in this sheet until it is closed.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import type { BlobbiEggCrack, NormalizedAccessoryPlacement } from '@blobbi-kit/renderer';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { portraitOf } from './blobbi-portrait';
import { PhotoError, composePolaroid, type PolaroidInput, type PolaroidResult } from './compose-polaroid';
import { getLocale, t, tp } from '@/i18n';
import { CAPTION_MAX, DEFAULT_FRAME, POLAROID_FRAMES, POLAROID_HEIGHT, POLAROID_WIDTH, cleanCaption, displayName, frameLabel, limitCaptionInput, photoDate, photoFilename, type PolaroidFrame } from './polaroid-layout';
import { canSharePhoto, downloadPhoto, sharePhoto } from './share';

export interface PolaroidSheetProps {
  open: boolean;
  onClose: () => void;
  blobbi: BlobbiCompanion;
  /** Its stats now, for the face it wears (a critical one shows; otherwise it smiles). */
  stats?: BlobbiStats;
  /** An egg's shell as it is now. */
  eggCrack?: BlobbiEggCrack;
  /** What it wears, for the front. */
  accessories?: readonly NormalizedAccessoryPlacement[];
  /** How the picture is made (tests). */
  compose?: (input: PolaroidInput) => Promise<PolaroidResult>;
  now?: () => Date;
}

/** How long typing rests before the picture is drawn again. */
const REDRAW_MS = 220;

interface Picture {
  url: string;
  blob: Blob;
  skippedAccessories: number;
  alt: string;
}

export function PolaroidSheet({ open, onClose, blobbi, stats, eggCrack, accessories, compose = composePolaroid, now = () => new Date() }: PolaroidSheetProps) {
  const [frame, setFrame] = useState<PolaroidFrame>(DEFAULT_FRAME);
  const [caption, setCaption] = useState('');
  const [withDate, setWithDate] = useState(false);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const captionId = useId();
  const dateId = useId();
  const hintId = useId();

  const name = displayName(blobbi.name);
  const filename = photoFilename(blobbi.name);
  const portrait = useMemo(() => portraitOf(blobbi, { stats, eggCrack }), [blobbi, stats, eggCrack]);
  // What it wears, as a value: the list is rebuilt by its owner on every render
  const wornKey = (accessories ?? []).map((a) => `${a.id}|${a.imageUrl}|${a.xPercent}|${a.yPercent}|${a.scale}|${a.rotationDeg}|${a.flipX}`).join(';');
  const worn = useRef(accessories);
  worn.current = accessories;
  const portraitKey = JSON.stringify(portrait);
  const latest = useRef({ portrait, compose, now });
  latest.current = { portrait, compose, now };

  // The picture, drawn a moment after anything about it changes
  const cleaned = cleanCaption(caption);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDrawing(true);
    const timer = setTimeout(() => {
      const date = withDate ? photoDate(latest.current.now(), getLocale()) : null;
      latest.current
        .compose({ portrait: latest.current.portrait, frame, name: blobbi.name, caption: cleaned, date, accessories: worn.current })
        .then((result) => {
          if (cancelled) return;
          const url = URL.createObjectURL(result.blob);
          const alt = `${t('world.photo.alt', { frame: t(`world.photo.frameInAlt.${frame}`), name })}${cleaned ? t('world.photo.altCaption', { caption: cleaned }) : ''}${date ? t('world.photo.altDate', { date }) : ''}`;
          setPicture((previous) => {
            if (previous) URL.revokeObjectURL(previous.url);
            return { url, blob: result.blob, skippedAccessories: result.skippedAccessories, alt };
          });
          setError(null);
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setError(reason instanceof PhotoError ? reason.message : t('world.photo.error.notMade'));
        })
        .finally(() => {
          if (!cancelled) setDrawing(false);
        });
    }, REDRAW_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, frame, cleaned, withDate, portraitKey, wornKey, blobbi.name, name]);

  // The picture is let go with the sheet
  useEffect(() => {
    if (open) return;
    setPicture((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
    setStatus(null);
    setError(null);
  }, [open]);
  const pictureRef = useRef<Picture | null>(null);
  pictureRef.current = picture;
  useEffect(
    () => () => {
      if (pictureRef.current) URL.revokeObjectURL(pictureRef.current.url);
    },
    [],
  );

  const shareable = useMemo(() => (picture ? canSharePhoto(picture.blob, filename) : false), [picture, filename]);

  const onShare = async () => {
    if (!picture) return;
    const outcome = await sharePhoto({ blob: picture.blob, filename, title: name });
    setStatus(outcome === 'shared' ? t('world.photo.shared') : outcome === 'downloaded' ? t('world.photo.downloaded') : outcome === 'unavailable' ? t('world.photo.unavailable') : null);
  };
  const onSave = () => {
    if (!picture) return;
    setStatus(downloadPhoto(picture.blob, filename) ? t('world.photo.downloaded') : t('world.photo.saveFailed'));
  };

  return (
    <GameOverlay open={open} onClose={onClose} title={t('world.photo.title')} subtitle={<span className="text-sm text-muted-foreground">{t('world.photo.subtitle', { name })}</span>} testId="polaroid-sheet" size="tall">
      <div className="polaroid">
        <div className="polaroid__stage" data-drawing={drawing || undefined} aria-busy={drawing || undefined}>
          {picture ? (
            <img className="polaroid__picture" src={picture.url} alt={picture.alt} width={POLAROID_WIDTH} height={POLAROID_HEIGHT} aria-describedby={hintId} data-testid="polaroid-preview" data-frame={frame} />
          ) : (
            <div className="polaroid__picture polaroid__picture--waiting" role="status" data-testid="polaroid-waiting">
              {error ?? t('world.photo.developing')}
            </div>
          )}
        </div>
        {picture && error && (
          <p className="polaroid__note" role="alert" data-testid="polaroid-error">
            {error}
          </p>
        )}
        {picture && picture.skippedAccessories > 0 && (
          <p className="polaroid__note" data-testid="polaroid-skipped">
            {tp('world.photo.skipped', picture.skippedAccessories)}
          </p>
        )}

        <div className="polaroid__frames" role="radiogroup" aria-label={t('world.photo.frameGroup')}>
          {POLAROID_FRAMES.map((f) => (
            <button type="button" key={f} role="radio" aria-checked={frame === f} className="polaroid__frame" data-frame={f} onClick={() => setFrame(f)} data-testid={`polaroid-frame-${f}`}>
              <span className="polaroid__swatch" aria-hidden />
              {frameLabel(f)}
            </button>
          ))}
        </div>

        <div className="polaroid__field">
          <label htmlFor={captionId} className="polaroid__label">
            {t('world.photo.caption')} <span className="polaroid__optional">{t('world.photo.optional')}</span>
          </label>
          <input id={captionId} className="onboard-input" value={caption} onChange={(e) => setCaption(limitCaptionInput(e.target.value))} placeholder={t('world.photo.captionPlaceholder', { name })} autoComplete="off" enterKeyHint="done" data-testid="polaroid-caption" />
          <span className="polaroid__count" aria-hidden data-testid="polaroid-count">
            {cleaned.length === 0 ? t('world.photo.captionMax', { max: CAPTION_MAX }) : `${Array.from(cleaned).length} / ${CAPTION_MAX}`}
          </span>
        </div>

        <label htmlFor={dateId} className="polaroid__check">
          <input id={dateId} type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} data-testid="polaroid-date" />
          {t('world.photo.showDate')}
        </label>

        <div className="polaroid__actions">
          {shareable && (
            <button type="button" className="polaroid__action polaroid__action--primary" onClick={() => void onShare()} disabled={!picture} data-testid="polaroid-share">
              <Share2 className="h-5 w-5" aria-hidden /> {t('world.photo.share')}
            </button>
          )}
          <button type="button" className={`polaroid__action ${shareable ? '' : 'polaroid__action--primary'}`} onClick={onSave} disabled={!picture} data-testid="polaroid-save">
            <Download className="h-5 w-5" aria-hidden /> {t('world.photo.saveImage')}
          </button>
        </div>
        <p className="polaroid__status" role="status" aria-live="polite" data-testid="polaroid-status">
          {status}
        </p>
        <p id={hintId} className="polaroid__hint">
          {t('world.photo.hint')}
        </p>
      </div>
    </GameOverlay>
  );
}

export default PolaroidSheet;
