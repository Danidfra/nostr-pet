import { useEffect, useState } from 'react';

export interface Speech {
  text: string;
  /** Changes with each new line so the same words can be said twice. */
  key: number;
}

interface SpeechBubbleProps {
  speech: Speech | null;
  /** How long a line stays. */
  durationMs?: number;
}

/**
 * A short line above the Blobbi's head. Presentation only: the overview
 * decides what is said and when (a care result, waking, a lifecycle
 * moment); this shows it and lets it go. Also announced politely for
 * assistive technology.
 */
export function SpeechBubble({ speech, durationMs = 2_600 }: SpeechBubbleProps) {
  const [visible, setVisible] = useState<Speech | null>(null);
  useEffect(() => {
    if (!speech) return;
    setVisible(speech);
    const id = setTimeout(() => setVisible((v) => (v?.key === speech.key ? null : v)), durationMs);
    return () => clearTimeout(id);
  }, [speech, durationMs]);

  return (
    <>
      {visible && (
        <div key={visible.key} className="speech-bubble animate-bubble-in" data-testid="speech-bubble" aria-hidden>
          {visible.text}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only" data-testid="speech-status">
        {visible?.text ?? ''}
      </p>
    </>
  );
}
