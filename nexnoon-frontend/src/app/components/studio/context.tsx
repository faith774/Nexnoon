import { createContext, useContext } from 'react';
import type { ClassPanel, Flash, StudioData, StudioTab } from './types';

export type StudioContextValue = {
  data: StudioData;
  search: string;
  refetch: () => Promise<unknown>;
  flash: (f: Flash) => void;
  goTo: (tab: StudioTab, params?: Record<string, string>) => void;
  openClass: (classId: string, panel?: ClassPanel) => void;
};

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside the instructor studio');
  return ctx;
}
