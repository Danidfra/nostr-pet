/**
 * Renaming a Blobbi (`useRenameBlobbi`): a small sheet with the name, its
 * length, Save and Cancel. Saving is said while it runs; a failure (a relay
 * that did not answer, a save not confirmed) keeps the dialog open with the
 * reason and the old name standing; only a saved rename closes it.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import type { BlobbiCompanion, NostrEvent } from '@blobbi-kit/core';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { NAME_MAX_LENGTH } from '@/features/adoption/adoption-plan';
import { useRenameBlobbi } from '@/features/care/useRenameBlobbi';
import { t } from '@/i18n';

/** The pencil beside the Blobbi's name in its details. */
export function RenamePencil({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="touch-hit inline-flex shrink-0 items-center justify-center rounded-full p-1.5 opacity-80 hover:opacity-100" aria-label={t('home.rename.edit', { name })} data-testid="rename-blobbi">
      <Pencil className="h-4 w-4" aria-hidden />
    </button>
  );
}

interface RenameBlobbiDialogProps {
  open: boolean;
  onClose: () => void;
  blobbi: BlobbiCompanion;
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  /** Told the new name once it is saved (a notice, say). */
  onRenamed?: (name: string) => void;
}

export function RenameBlobbiDialog({ open, onClose, blobbi, pubkey, updateCompanionEvent, onRenamed }: RenameBlobbiDialogProps) {
  const rename = useRenameBlobbi({ pubkey, updateCompanionEvent });
  const [value, setValue] = useState(blobbi.name);
  const inputId = useId();
  const { reset } = rename;
  // Each opening starts from the current name, with no old error
  useEffect(() => {
    if (!open) return;
    setValue(blobbi.name);
    reset();
  }, [open, blobbi.name, reset]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (rename.isPending) return;
    rename.mutate(
      { d: blobbi.d, name: value, current: blobbi.name },
      {
        onSuccess: ({ name }) => {
          onRenamed?.(name);
          onClose();
        },
      },
    );
  };

  const length = [...value.trim()].length;
  return (
    <GameOverlay open={open} onClose={rename.isPending ? () => {} : onClose} title={t('home.rename.title', { name: blobbi.name })} testId="rename-dialog" size="medium">
      <form onSubmit={submit} className="menu" data-testid="rename-form">
        <p className="menu-section__hint">{t('home.rename.hint')}</p>
        <label htmlFor={inputId} className="text-sm font-semibold">
          {t('home.rename.label')}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={NAME_MAX_LENGTH * 2}
          autoComplete="off"
          disabled={rename.isPending}
          aria-invalid={rename.isError}
          aria-describedby={`${inputId}-count`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
          data-testid="rename-input"
        />
        <p id={`${inputId}-count`} className={`text-right text-xs ${length > NAME_MAX_LENGTH ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`}>
          {t('home.rename.counter', { count: length, max: NAME_MAX_LENGTH })}
        </p>
        {rename.isError && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300" data-testid="rename-error">
            {rename.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={rename.isPending} className="menu-tile menu-tile--on min-h-11 px-4 py-2" data-testid="rename-save">
            {rename.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('home.rename.saving')}
              </>
            ) : (
              t('home.rename.save')
            )}
          </button>
          <button type="button" disabled={rename.isPending} onClick={onClose} className="menu-tile min-h-11 px-4 py-2" data-testid="rename-cancel">
            {t('home.rename.cancel')}
          </button>
        </div>
      </form>
    </GameOverlay>
  );
}
