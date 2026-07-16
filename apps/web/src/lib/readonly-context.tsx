'use client';
import { createContext, useContext } from 'react';

const ReadOnlyCtx = createContext(false);

export function ReadOnlyProvider({ value = true, children }: { value?: boolean; children: React.ReactNode }) {
  return <ReadOnlyCtx.Provider value={value}>{children}</ReadOnlyCtx.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyCtx);
}
