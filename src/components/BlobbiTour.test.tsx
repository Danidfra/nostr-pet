import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BlobbiTour } from './BlobbiTour';
import { vi } from 'vitest';

// Mock the SpotlightOverlay component
vi.mock('./SpotlightOverlay', () => ({
  SpotlightOverlay: ({ children, onClose, imageUrl }: any) => (
    <div data-testid="spotlight-overlay">
      {imageUrl && <img data-testid="tour-image" src={imageUrl} alt="Tour step" />}
      {children}
      <button data-testid="close-overlay" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock image imports
vi.mock('@/assets/blobbi-overboard-step-1.png', () => 'mock-step1-image-data', { virtual: true });
vi.mock('@/assets/blobbi-overboard-step-2.png', () => 'mock-step2-image-data', { virtual: true });

describe('BlobbiTour', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <BlobbiTour
        isOpen={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders tour when open', () => {
    render(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByTestId('spotlight-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('tour-image')).toBeInTheDocument();
  });

  it('shows correct step content', () => {
    render(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('My Blobbies')).toBeInTheDocument();
  });

  it('renders with imported image assets', () => {
    render(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const image = screen.getByTestId('tour-image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'mock-step1-image-data');
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    fireEvent.click(screen.getByTestId('close-overlay'));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('resets to first step when reopened', async () => {
    const { rerender } = render(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    // Navigate to second step (simulate user clicking next)
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Close and reopen
    fireEvent.click(screen.getByTestId('close-overlay'));
    rerender(
      <BlobbiTour
        isOpen={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );
    rerender(
      <BlobbiTour
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    // Should be back to first step
    expect(screen.getByText('My Blobbies')).toBeInTheDocument();
  });
});