import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import BlobbiCommunity from '@/pages/BlobbiCommunity';

// Mock the Nostr hook
jest.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: jest.fn().mockResolvedValue([]),
    },
  }),
}));

// Mock the useAuthor hook
jest.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: null,
    isLoading: false,
  }),
}));

describe('BlobbiCommunity', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

  test('renders community page with header', async () => {
    render(<BlobbiCommunity />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Blobbi Community/i)).toBeInTheDocument();
      expect(screen.getByText(/Discover and connect with the Blobbi ecosystem/i)).toBeInTheDocument();
      expect(screen.getByText(/blobbi:ecosystem:v1/i)).toBeInTheDocument();
    });
  });

  test('renders empty state when no posts', async () => {
    const { useNostr } = await import('@nostrify/react');
    const mockNostr = useNostr();
    (mockNostr.nostr.query as jest.Mock).mockResolvedValue([]);

    render(<BlobbiCommunity />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/No Blobbi ecosystem posts yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Any Nostr post \(kind:1\) with the tag/i)).toBeInTheDocument();
    });
  });

  test('renders loading state', () => {
    render(<BlobbiCommunity />, { wrapper });

    // Should show skeleton loaders while loading
    const skeletons = screen.getAllByRole('generic').filter(
      (element) => element.className.includes('skeleton')
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });
});