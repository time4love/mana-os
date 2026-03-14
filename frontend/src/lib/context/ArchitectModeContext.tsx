"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "mana_architect_mode";

interface ArchitectModeContextValue {
  isArchitectMode: boolean;
  setArchitectMode: (value: boolean) => void;
  toggleArchitectMode: () => void;
}

const ArchitectModeContext = createContext<ArchitectModeContextValue | null>(null);

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

function writeStored(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

export function ArchitectModeProvider({ children }: { children: ReactNode }) {
  const [isArchitectMode, setState] = useState(false);

  useEffect(() => {
    setState(readStored());
  }, []);

  const setArchitectMode = useCallback((value: boolean) => {
    setState(value);
    writeStored(value);
  }, []);

  const toggleArchitectMode = useCallback(() => {
    setState((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }, []);

  const value = useMemo<ArchitectModeContextValue>(
    () => ({ isArchitectMode, setArchitectMode, toggleArchitectMode }),
    [isArchitectMode, setArchitectMode, toggleArchitectMode]
  );

  return (
    <ArchitectModeContext.Provider value={value}>
      {children}
    </ArchitectModeContext.Provider>
  );
}

export function useArchitectMode(): ArchitectModeContextValue {
  const ctx = useContext(ArchitectModeContext);
  if (!ctx) {
    return {
      isArchitectMode: false,
      setArchitectMode: () => {},
      toggleArchitectMode: () => {},
    };
  }
  return ctx;
}
