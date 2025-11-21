import { render } from '@testing-library/react';
import { CommunityPostCard } from './CommunityPostCard';

// Mock the useIsMobile hook
jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

// Mock the community feed hooks
jest.mock('@/hooks/useBlobbiCommunityFeed', () => ({
  formatPostTime: () => '2h ago',
  generateDisplayName: () => 'Test User',
  getAvatarUrl: () => null,
  getAvatarColor: () => 'bg-blue-500',
}));

describe('CommunityPostCard', () => {
  const mockPost = {
    id: 'test-post-id',
    pubkey: 'test-pubkey',
    author: {},
    content: 'Test post content',
    createdAt: new Date(),
    mediaUrl: 'https://example.com/test-image.jpg',
    mediaAlt: 'Test image',
    mediaSummary: 'Test summary',
  };

  it('renders without crashing', () => {
    const { container } = render(
      <CommunityPostCard post={mockPost as any} />
    );
    expect(container).toBeInTheDocument();
  });

  it('applies image constraints and padding', () => {
    const { container } = render(
      <CommunityPostCard post={mockPost as any} />
    );

    const imageContainer = container.querySelector('.relative.overflow-hidden.rounded-lg');
    expect(imageContainer).toBeInTheDocument();

    // Check for image without max-width/max-height constraints
    const image = container.querySelector('img.w-full.h-full.object-contain');
    expect(image).toBeInTheDocument();
    expect(image).not.toHaveClass('max-w-full');
    expect(image).not.toHaveClass('max-h-full');

    // Check for padding around media container
    const mediaWrapper = container.querySelector('.mb-4.px-3');
    expect(mediaWrapper).toBeInTheDocument();

    // Check for inner container with padding and constraints
    const innerContainer = container.querySelector('.relative.flex.items-center.justify-center.p-4');
    expect(innerContainer).toBeInTheDocument();
  });

  it('filters media URL from content', () => {
    const postWithUrl = {
      ...mockPost,
      content: 'Check out this image: https://example.com/test-image.jpg It\'s amazing!'
    };

    const { container } = render(
      <CommunityPostCard post={postWithUrl as any} />
    );

    const content = container.querySelector('.whitespace-pre-wrap');
    expect(content).toBeInTheDocument();
    expect(content?.textContent).not.toContain('https://example.com/test-image.jpg');
    expect(content?.textContent).toContain('Check out this image: It\'s amazing!');
  });

  it('ensures image never touches container edges', () => {
    const { container } = render(
      <CommunityPostCard post={mockPost as any} />
    );

    // Check that the wrapper has rounded corners and border
    const wrapper = container.querySelector('.relative.overflow-hidden.rounded-lg.border');
    expect(wrapper).toBeInTheDocument();

    // Check that blurred background fills the entire wrapper
    const blurredBg = container.querySelector('.absolute.inset-0.bg-cover.blur-xl');
    expect(blurredBg).toBeInTheDocument();

    // Check that main container has padding and constraints
    const mainContainer = container.querySelector('.relative.flex.items-center.justify-center.p-3');
    expect(mainContainer).toBeInTheDocument();

    // Check that inner padding container exists to prevent image from touching limits
    const innerPaddingContainer = container.querySelector('.relative.flex.items-center.justify-center.p-4');
    expect(innerPaddingContainer).toBeInTheDocument();

    // Check that image respects constraints and maintains padding
    const image = container.querySelector('img.max-w-full.max-h-full.object-contain');
    expect(image).toBeInTheDocument();
    expect(image?.className).toContain('max-w-full');
    expect(image?.className).toContain('max-h-full');
    expect(image?.className).toContain('object-contain');
  });

});