import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('the app error boundary', () => {
  it('a render error anywhere is a card with Reload and the message, never a white page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId('app-crash')).toHaveTextContent(/nothing was changed/i);
    expect(screen.getByTestId('app-crash-reload')).toBeInTheDocument();
    expect(screen.getByTestId('app-crash-message')).toHaveTextContent('kaboom');
    spy.mockRestore();
  });

  it('renders its children when nothing goes wrong', () => {
    render(
      <AppErrorBoundary>
        <p>fine</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByTestId('app-crash')).toBeNull();
  });
});
