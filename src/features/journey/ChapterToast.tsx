/**
 * A chapter finished: a small card over the room, once (the journey decides
 * when; this only shows it), with what the chapter opens. It goes by itself
 * after a while, or with a tap.
 */
import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { Chapter } from './journey';

export const CHAPTER_TOAST_MS = 5_500;

interface ChapterToastProps {
  chapter: Chapter | undefined;
  onDone: () => void;
  play: (sound: BlobbiSoundId) => void;
  reducedMotion: boolean;
}

export function ChapterToast({ chapter, onDone, play, reducedMotion }: ChapterToastProps) {
  useEffect(() => {
    if (!chapter) {
      onDone();
      return;
    }
    play('happy');
    const timer = setTimeout(onDone, CHAPTER_TOAST_MS);
    return () => clearTimeout(timer);
    // One showing per chapter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id]);
  if (!chapter) return null;
  return (
    <div className={`chapter-toast ${reducedMotion ? 'chapter-toast--still' : ''}`} role="status" aria-live="polite" data-testid="chapter-toast" data-chapter={chapter.id}>
      <Sparkles className="chapter-toast__icon" aria-hidden />
      <span className="chapter-toast__text">
        <span className="chapter-toast__title">
          Chapter {chapter.number} complete: {chapter.title}
        </span>
        <span className="chapter-toast__opens">Next: {chapter.opens}</span>
      </span>
      <button type="button" className="chapter-toast__ok" onClick={onDone} data-testid="chapter-toast-ok">
        Yay!
      </button>
    </div>
  );
}
