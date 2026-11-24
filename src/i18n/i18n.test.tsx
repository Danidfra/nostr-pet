import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { en } from './messages/en';
import { ptBR } from './messages/pt-BR';
import { es } from './messages/es';
import { changeLocale, getLocale, setMessages, t, tp, formatNumber } from './t';
import { tRich } from './rich';
import { LOCALE_STORAGE_KEY, detectLocale, matchLocale } from './locales';
import type { Messages } from './types';

afterEach(() => setMessages('en', en));

function leaves(tree: unknown, prefix = ''): [string, string][] {
  return Object.entries(tree as Record<string, unknown>).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('choosing a language', () => {
  it('matches the browser languages in order, by region and then by language, else English', () => {
    expect(matchLocale(['pt-BR'])).toBe('pt-BR');
    expect(matchLocale(['pt-PT', 'en'])).toBe('pt-BR');
    expect(matchLocale(['es-MX'])).toBe('es');
    expect(matchLocale(['de-DE', 'es'])).toBe('es');
    expect(matchLocale(['de', 'fr'])).toBe('en');
    expect(matchLocale([])).toBe('en');
  });

  it('prefers a stored choice over the browser', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    expect(detectLocale()).toBe('es');
    localStorage.setItem(LOCALE_STORAGE_KEY, 'klingon');
    expect(detectLocale()).toBe('en');
  });

  it('stores a new choice and reloads only when it changes', () => {
    const reload = vi.fn();
    changeLocale('en', reload);
    expect(reload).not.toHaveBeenCalled();
    changeLocale('pt-BR', reload);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('messages', () => {
  it('fills placeholders and falls back to English where a translation is missing', () => {
    expect(t('menu.guest.save', { name: 'Lupa' })).toBe('Save Lupa');
    const partial = structuredClone(ptBR) as Messages;
    (partial.menu.guest as Record<string, string>).save = undefined as unknown as string;
    setMessages('pt-BR', partial);
    expect(getLocale()).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(t('menu.guest.save', { name: 'Lupa' })).toBe('Save Lupa');
    expect(t('menu.title')).toBe('Menu');
  });

  it('writes numbers the language’s way', () => {
    setMessages('pt-BR', ptBR);
    expect(formatNumber(1234.5)).toBe('1.234,5');
  });

  it('puts React nodes into a message where the translation places them', () => {
    const { container } = render(<p>{tRich('menu.guest.save', { name: <strong>Lupa</strong> })}</p>);
    expect(container.innerHTML).toBe('<p>Save <strong>Lupa</strong></p>');
  });

  it('picks plural forms by the language’s rules', () => {
    const plural = Object.keys(Object.fromEntries(leaves(en))).filter((k) => k.endsWith('_other'));
    if (plural.length === 0) return;
    const key = plural[0].slice(0, -'_other'.length) as Parameters<typeof tp>[0];
    expect(tp(key, 2)).toContain('2');
  });

  it.each([
    ['pt-BR', ptBR],
    ['es', es],
  ])('%s has every English message, none empty, with the same placeholders', (_, messages) => {
    const theirs = new Map(leaves(messages));
    for (const [key, source] of leaves(en)) {
      expect(theirs.has(key), key).toBe(true);
      expect(theirs.get(key)!.trim(), key).not.toBe('');
      expect(placeholders(theirs.get(key)!), key).toEqual(placeholders(source));
    }
    expect(theirs.size).toBe(leaves(en).length);
  });
});
