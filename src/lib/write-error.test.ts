import { afterEach, describe, expect, it } from 'vitest';
import { setMessages } from '@/i18n/t';
import { en } from '@/i18n/messages/en';
import { ptBR } from '@/i18n/messages/pt-BR';
import { PublishUnconfirmedError } from './relay-transport';
import { describeWriteError } from './write-error';

afterEach(() => setMessages('en', en));

describe('describeWriteError', () => {
  it('says the relays refused it, never the runtime’s "All promises were rejected"', () => {
    const refused = new AggregateError([new Error('blocked: rate-limited')], 'All promises were rejected');
    expect(describeWriteError(refused)).toBe(en.home.notice.notAccepted);
    expect(describeWriteError(new AggregateError([]))).toBe(en.home.notice.notAccepted);
  });

  it('speaks the page’s language for a refusal', () => {
    setMessages('pt-BR', ptBR);
    expect(describeWriteError(new AggregateError([], 'All promises were rejected'))).toBe(ptBR.home.notice.notAccepted);
  });

  it('keeps an error’s own message, which the home already translates', () => {
    const unconfirmed = new PublishUnconfirmedError(['wss://other.example']);
    expect(describeWriteError(unconfirmed)).toBe(unconfirmed.message);
    expect(describeWriteError(new Error('Signer timed out'))).toBe('Signer timed out');
  });

  it('is never empty', () => {
    expect(describeWriteError(new Error(''))).toBe(en.home.notice.notAccepted);
    expect(describeWriteError('refused')).toBe(en.home.notice.notAccepted);
    expect(describeWriteError(undefined)).toBe(en.home.notice.notAccepted);
  });
});
