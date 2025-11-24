import { useUserBlobbis } from '@/hooks/useUserBlobbis';

export function useUserBlobbi() {
  const result = useUserBlobbis();

  return {
    ...result,
    data: result.data && result.data.length > 0 ? result.data[0] : null,
  };
}