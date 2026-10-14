/**
 * A render error in the room stays in the room: the page keeps standing,
 * the error is named with a copyable report, Try again mounts the room
 * afresh, Try again with Classic switches the drawing first, and the error is kept
 * for the dev tools. Errors outside rendering are not caught here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoomErrorBoundary } from './RoomErrorBoundary';
import { APPEARANCE_STORAGE_KEY } from '../lib/blobbi-appearance';
import { clearRuntimeErrors, runtimeErrors } from '../lib/runtime-errors';

let explode = true;
function Room() {
  if (explode) throw new Error('the model has no eyes');
  return <div data-testid="room-ok">room</div>;
}

afterEach(() => {
  explode = true;
  clearRuntimeErrors();
  vi.restoreAllMocks();
});

describe('the room error boundary', () => {
  it('replaces only the room with the cause, keeps the page, and Try again mounts it afresh', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <div data-testid="page">
          <RoomErrorBoundary>
            <Room />
          </RoomErrorBoundary>
        </div>
      </MemoryRouter>,
    );
    const crash = screen.getByTestId('room-crash');
    expect(crash).toHaveAttribute('role', 'alert');
    expect(crash).toHaveTextContent('the model has no eyes');
    expect(screen.getByTestId('page')).toBeInTheDocument();
    expect(screen.getByTestId<HTMLTextAreaElement>('room-crash-report').value).toMatch(/Error: the model has no eyes/);
    expect(runtimeErrors()[0]).toMatchObject({ kind: 'render', message: 'Error: the model has no eyes' });
    explode = false;
    fireEvent.click(screen.getByTestId('room-crash-retry'));
    expect(screen.getByTestId('room-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('room-crash')).toBeNull();
  });

  it('offers the 2D drawing as the lighter retry when the 3D model was on, and switches before mounting again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '3d');
    render(
      <MemoryRouter>
        <RoomErrorBoundary>
          <Room />
        </RoomErrorBoundary>
      </MemoryRouter>,
    );
    explode = false;
    fireEvent.click(screen.getByTestId('room-crash-2d'));
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('2d');
    expect(screen.getByTestId('room-ok')).toBeInTheDocument();
  });

  it('renders the room untouched when nothing throws', () => {
    explode = false;
    render(
      <MemoryRouter>
        <RoomErrorBoundary>
          <Room />
        </RoomErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('room-ok')).toBeInTheDocument();
    expect(runtimeErrors()).toHaveLength(0);
  });
});
