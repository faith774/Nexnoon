import { createContext, useContext } from 'react';
import { getErrorMessage } from '@/lib/api/client';
import type { AdminData, AdminIntent, AdminTab, ClassOp, Flash } from './types';

export type AdminContextValue = {
  data: AdminData;
  /** Derived class rows (falls back to raw classes when the API omits classOps). */
  classOps: ClassOp[];
  seatCap: number;
  search: string;
  intent: AdminIntent;
  refetch: () => Promise<unknown>;
  flash: (flash: Flash) => void;
  goTo: (tab: AdminTab, intent?: AdminIntent) => void;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside the admin dashboard');
  return ctx;
}

/** Wraps an admin mutation with flash messaging + refetch. */
export function useAdminAction() {
  const { flash, refetch } = useAdmin();
  return async function run<T>(
    fn: () => Promise<T>,
    { success, refresh = true }: { success?: string | ((result: T) => string); refresh?: boolean } = {}
  ): Promise<T | undefined> {
    try {
      const result = await fn();
      const msg =
        typeof success === 'function'
          ? success(result)
          : ((result as { data?: { message?: string } })?.data?.message ?? success);
      if (msg) flash({ type: 'ok', text: msg });
      if (refresh) await refetch();
      return result;
    } catch (error) {
      flash({ type: 'err', text: getErrorMessage(error) });
      return undefined;
    }
  };
}
