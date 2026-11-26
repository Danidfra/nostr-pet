import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setMessages } from '@/i18n';
import { en } from '@/i18n/messages/en';
import { ptBR } from '@/i18n/messages/pt-BR';
import { CareDock } from './CareDock';
import { careLabel } from './labels';

afterEach(() => setMessages('en', en));

describe('the care dock', () => {
  it('shows the sun for waking by what the button does, not by its words, in every language', () => {
    setMessages('pt-BR', ptBR);
    render(<CareDock actions={[{ action: 'rest', label: careLabel('wake'), available: true, wakes: true }]} selected={null} pendingAction={null} onSelect={() => {}} onOpenItems={() => {}} itemCount={0} />);
    expect(screen.getByTestId('care-rest').querySelector('.lucide-sun')).not.toBeNull();
  });

  it('a resting verb keeps the moon', () => {
    render(<CareDock actions={[{ action: 'rest', label: careLabel('rest'), available: true }]} selected={null} pendingAction={null} onSelect={() => {}} onOpenItems={() => {}} itemCount={0} />);
    expect(screen.getByTestId('care-rest').querySelector('.lucide-moon')).not.toBeNull();
  });
});
