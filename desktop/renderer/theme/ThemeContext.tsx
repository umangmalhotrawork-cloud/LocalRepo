"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  ThemeDefinition, 
  THEMES, 
  DEFAULT_THEME_ID, 
  getTheme, 
  applyThemeToDocument, 
  registerMonacoThemes 
} from "./themeRegistry";

const THEME_STORAGE_KEY = "nexus_theme_id";

interface ThemeContextType {
  activeThemeId: string;
  theme: ThemeDefinition;
  setThemeId: (id: string) => void;
  themes: ThemeDefinition[];
  registerMonaco: (monaco: any) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  activeThemeId: DEFAULT_THEME_ID,
  theme: getTheme(DEFAULT_THEME_ID),
  setThemeId: () => {},
  themes: THEMES,
  registerMonaco: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [monacoInstance, setMonacoInstance] = useState<any>(null);

  // Load persisted theme on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved && THEMES.some((t) => t.id === saved)) {
          setActiveThemeId(saved);
        }
      }
    } catch (e) {
      console.warn("[THEME] Failed to load theme from localStorage:", e);
    }
  }, []);

  const currentTheme = getTheme(activeThemeId);

  // Apply theme to document element
  useEffect(() => {
    applyThemeToDocument(currentTheme, monacoInstance);
  }, [currentTheme, monacoInstance]);

  const handleSetThemeId = useCallback((id: string) => {
    if (!THEMES.some((t) => t.id === id)) return;
    setActiveThemeId(id);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, id);
      }
    } catch (e) {
      console.warn("[THEME] Failed to save theme to localStorage:", e);
    }
  }, []);

  const handleRegisterMonaco = useCallback((monaco: any) => {
    if (!monaco) return;
    setMonacoInstance(monaco);
    registerMonacoThemes(monaco);
    if (monaco?.editor?.setTheme) {
      monaco.editor.setTheme(currentTheme.monacoThemeId);
    }
  }, [currentTheme]);

  return (
    <ThemeContext.Provider
      value={{
        activeThemeId,
        theme: currentTheme,
        setThemeId: handleSetThemeId,
        themes: THEMES,
        registerMonaco: handleRegisterMonaco,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

export default ThemeContext;
