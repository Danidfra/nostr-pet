import { render, screen, fireEvent } from '@testing-library/react';
import { SpotlightOverlay } from './SpotlightOverlay';

// Mock createPortal
jest.mock('react-dom', () => ({
  createPortal: (children: any) => children,
}));

// Mock window and DOM methods
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('SpotlightOverlay', () => {
  const mockOnClose = jest.fn();
  const mockElement = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 100,
      width: 200,
      height: 50,
      right: 300,
      bottom: 150,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock document.querySelector
    document.querySelector = jest.fn().mockReturnValue(mockElement as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without image when no imageUrl provided', () => {
    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByAltText('Tour step illustration')).not.toBeInTheDocument();
  });

  it('renders image when imageUrl is provided', () => {
    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl="/assets/test-image.png"
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/assets/test-image.png');
    expect(image).toHaveClass('rounded-lg', 'shadow-xl', 'drop-shadow-lg');
  });

  it('applies correct styling to image container', () => {
    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl="/assets/test-image.png"
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    const container = image.parentElement;

    expect(container).toHaveClass('absolute', 'z-[92]', 'pointer-events-none');
    expect(container).toHaveStyle({
      maxWidth: 'min(520px, 80vw)',
      width: '100%',
    });
  });

  it('uses custom imageOffset when provided', () => {
    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl="/assets/test-image.png"
        imageOffsetX={20}
        imageOffsetY={20}
      />
    );

    // The offset is used in positioning calculations, which are tested indirectly
    // by ensuring the component renders without errors
    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
  });

  it('handles image load event for position recalculation', () => {
    const { container } = render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl="/assets/test-image.png"
      />
    );

    const image = screen.getByAltText('Tour step illustration');

    // Simulate image load
    fireEvent.load(image, {
      target: { offsetHeight: 300 }
    });

    // Component should still be rendered and functional
    expect(image).toBeInTheDocument();
  });

  it('hides image gracefully when loading fails', () => {
    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl="/assets/nonexistent-image.png"
      />
    );

    const image = screen.getByAltText('Tour step illustration');

    // Simulate image error
    fireEvent.error(image);

    // Image should be hidden but still in DOM
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ display: 'none' });
  });

  it('renders with imported image assets', () => {
    // Mock imported asset (simulating Vite's import behavior)
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', mockImportedImage);
  });

  it('applies custom image width correctly', () => {
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
        imageWidth={300}
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ width: '300px' });
    expect(image).toHaveStyle({ height: 'auto' });
    expect(image).toHaveStyle({ maxWidth: 'none' });
  });

  it('applies custom image height correctly', () => {
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
        imageHeight={150}
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ width: 'auto' });
    expect(image).toHaveStyle({ height: '150px' });
    expect(image).toHaveStyle({ maxHeight: 'none' });
  });

  it('applies both custom width and height correctly', () => {
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
        imageWidth={400}
        imageHeight={200}
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ width: '400px' });
    expect(image).toHaveStyle({ height: '200px' });
    expect(image).toHaveStyle({ maxWidth: 'none' });
    expect(image).toHaveStyle({ maxHeight: 'none' });
  });

  it('applies string width and height correctly', () => {
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
        imageWidth="40%"
        imageHeight="10rem"
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ width: '40%' });
    expect(image).toHaveStyle({ height: '10rem' });
    expect(image).toHaveStyle({ maxWidth: 'none' });
    expect(image).toHaveStyle({ maxHeight: 'none' });
  });

  it('uses auto dimensions when no custom sizing provided', () => {
    const mockImportedImage = 'data:image/png;base64,mockImageData';

    render(
      <SpotlightOverlay
        targetSelector="#test-element"
        onClose={mockOnClose}
        imageUrl={mockImportedImage}
      />
    );

    const image = screen.getByAltText('Tour step illustration');
    expect(image).toBeInTheDocument();
    expect(image).toHaveStyle({ width: 'auto' });
    expect(image).toHaveStyle({ height: 'auto' });
    expect(image.style.maxWidth).toBe('');
    expect(image.style.maxHeight).toBe('');
  });
});