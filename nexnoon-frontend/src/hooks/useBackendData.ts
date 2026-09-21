import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseBackendDataOptions {
  /**
   * Re-fetch this data automatically every N milliseconds while the tab is
   * focused (React Query pauses interval refetching in the background by
   * default). Use this for views where another user's action - an instructor
   * starting/ending a class, adding a session - needs to show up for whoever
   * is currently looking at it, without them having to manually reload.
   * Omit for everything else; polling data nobody else can change is wasted work.
   */
  refetchInterval?: number;
}

export function useBackendData<T>(path: string, isPublic = false, options: UseBackendDataOptions = {}) {
  const { user } = useAuth();
  return useQuery<T>({
    queryKey: ['backend-data', path, user?.id],
    queryFn: async () => (await apiClient.get(path)).data.data,
    enabled: isPublic || !!user,
    staleTime: 0,
    retry: 1,
    refetchInterval: options.refetchInterval,
  });
}
