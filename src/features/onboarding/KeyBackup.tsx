import { useEffect, useState } from 'react';
import { Check, Copy, Download, Eye, EyeOff } from 'lucide-react';
import { t } from '@/i18n';
import { downloadNsecBackup, nsecBackupFilename } from './new-account';

interface KeyBackupProps {
  nsec: string;
  /** Called when the player copied or downloaded, for a gate elsewhere. */
  onBackedUp?: (how: 'copy' | 'download') => void;
  /** Reveal the key by default (signup shows it once; the menu keeps it hidden). */
  revealed?: boolean;
}

/**
 * The secret key with the two ways to keep it: copy it, or download the
 * backup file. Hidden by default in the menu, shown in signup. The key is
 * rendered as text in a code box and handed to the clipboard or a file; it
 * never goes into an input's value, an `href`, or a log.
 */
export function KeyBackup({ nsec, onBackedUp, revealed = false }: KeyBackupProps) {
  const [shown, setShown] = useState(revealed);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(nsec);
      setCopied(true);
      setNote(null);
      onBackedUp?.('copy');
    } catch {
      setNote(t('wayIn.backup.noCopy'));
    }
  };
  const download = () => {
    if (downloadNsecBackup(nsec)) {
      // Only asked of the browser: whether it saved the file is for the player to check
      setNote(t('wayIn.backup.downloaded', { file: nsecBackupFilename(nsec) }));
      onBackedUp?.('download');
    } else setNote(t('wayIn.key.noteNoDownload'));
  };

  return (
    <div className="space-y-2" data-testid="key-backup">
      <div className="flex items-stretch gap-2">
        <code className="key-box" data-testid="nsec-box" aria-label={t('wayIn.key.nsecLabel')} data-shown={shown ? 'true' : 'false'}>
          {shown ? nsec : `${nsec.slice(0, 9)}${'•'.repeat(24)}`}
        </code>
        <button type="button" className="hud-icon-button !h-auto !w-11 shrink-0 !rounded-xl" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? t('wayIn.backup.hide') : t('wayIn.backup.show')} data-testid="nsec-toggle">
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={copy} data-testid="nsec-copy">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? t('wayIn.key.copied') : t('wayIn.key.copy')}
        </button>
        <button type="button" className="onboard-btn onboard-btn--secondary" onClick={download} data-testid="nsec-download">
          <Download className="h-4 w-4" aria-hidden />
          {t('wayIn.backup.downloadFile')}
        </button>
      </div>
      {note && (
        <p className="text-xs text-muted-foreground" role="status" data-testid="nsec-note">
          {note}
        </p>
      )}
    </div>
  );
}
