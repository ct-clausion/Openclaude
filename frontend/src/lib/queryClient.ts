import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../api/client';

// Unwrap the best user-facing message we can find on an unknown error.
function extractMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    // 401 is already handled by client.ts (forces logout). Don't double-notify.
    if (error.status === 401) return '';
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
  // Query failures surface as a toast unless the caller opts out via meta.silent.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return;
      const msg = extractMessage(error, '데이터를 불러오지 못했습니다.');
      if (msg) toast.error(msg);
    },
  }),
  // Mutation failures default to a toast too. Set meta.silent when the call site
  // renders its own inline error (e.g. form field validation).
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return;
      const msg = extractMessage(error, '요청을 처리하지 못했습니다.');
      if (msg) toast.error(msg);
    },
  }),
});
