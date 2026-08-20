"use client";

export interface ThemeColors {
  // IDE Surface Hierarchy
  themeBackground: string;      // Root application / Task Home empty workspace
  themeSurface: string;         // Header, sidebar, activity rail, status bar
  themeSurfacePanel: string;    // Explorer, tool drawers, side panels
  themeSurfaceRaised: string;   // Dropdowns, popovers, active tabs, floating pills
  themeSurfaceCard: string;     // Interactive cards, preset cards, modal dialogs
  themeSurfaceHover: string;    // Hover states on list items, cards, buttons
  themeSurfaceActive: string;   // Active/selected list items, pills, buttons
  themeSurfaceInput: string;    // Inputs, textareas, search boxes
  themeSurfaceBadge: string;    // Accent pills and status badges

  // Borders & Dividers
  themeBorder: string;          // Standard panel/component borders
  themeBorderSubtle: string;    // Subtle interior dividers
  themeBorderCard: string;      // Card and modal borders
  themeBorderFocus: string;     // Active ring, focused inputs

  // Typography
  themeText: string;            // Primary high-contrast text
  themeTextMuted: string;       // Secondary / muted text
  themeTextSubtle: string;      // Tertiary / placeholders / inactive icons
  themeTextAccent: string;      // Accent colored text

  // Accents & Actions
  themeAccent: string;          // Primary theme accent
  themeAccentHover: string;     // Primary accent hover
  themeAccentDim: string;       // Primary accent translucent fill
  themeAccentSecondary: string; // Secondary theme accent
  themeSuccess: string;         // Success state
  themeWarning: string;         // Warning state
  themeError: string;           // Error state
  themeInfo: string;            // Info state

  // Editor Surface
  themeEditorBackground: string;
  themeEditorForeground: string;
  themeSelection: string;

  // Visual Palette Swatches (for picker)
  swatches: [string, string, string, string];
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  category: "Default" | "Vibrant" | "Neutral" | "Cyberpunk" | "Classic";
  colors: ThemeColors;
  monacoThemeId: string;
  monacoThemeData: any;
  isLight?: boolean;
}

export const THEMES: ThemeDefinition[] = [
  // 1. NEXUS Dark — DEFAULT
  {
    id: "nexus-dark",
    name: "NEXUS Dark",
    description: "Technical, minimal & deep black with NEXUS cyan accents",
    category: "Default",
    colors: {
      themeBackground: "#050505",
      themeSurface: "#08080c",
      themeSurfacePanel: "#0a0a0f",
      themeSurfaceRaised: "#0e0e16",
      themeSurfaceCard: "#101018",
      themeSurfaceHover: "#161622",
      themeSurfaceActive: "#1c1c2c",
      themeSurfaceInput: "#08080e",
      themeSurfaceBadge: "#082f49",
      themeBorder: "#161620",
      themeBorderSubtle: "#14141e",
      themeBorderCard: "#1f1f2e",
      themeBorderFocus: "#22d3ee",
      themeText: "#f4f4f5",
      themeTextMuted: "#a1a1aa",
      themeTextSubtle: "#71717a",
      themeTextAccent: "#22d3ee",
      themeAccent: "#22d3ee",
      themeAccentHover: "#06b6d4",
      themeAccentDim: "rgba(34, 211, 238, 0.15)",
      themeAccentSecondary: "#a855f7",
      themeSuccess: "#34d399",
      themeWarning: "#fbbf24",
      themeError: "#f87171",
      themeInfo: "#38bdf8",
      themeEditorBackground: "#050505",
      themeEditorForeground: "#e4e4e7",
      themeSelection: "#083344",
      swatches: ["#050505", "#22d3ee", "#a855f7", "#34d399"],
    },
    monacoThemeId: "nexus-dark",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "e4e4e7", background: "050505" },
        { token: "keyword", foreground: "22d3ee", fontStyle: "bold" },
        { token: "string", foreground: "34d399" },
        { token: "number", foreground: "fbbf24" },
        { token: "comment", foreground: "71717a", fontStyle: "italic" },
        { token: "type", foreground: "a855f7" },
        { token: "function", foreground: "38bdf8" },
        { token: "variable", foreground: "f4f4f5" },
      ],
      colors: {
        "editor.background": "#050505",
        "editor.foreground": "#e4e4e7",
        "editorCursor.foreground": "#22d3ee",
        "editor.lineHighlightBackground": "#0c0c14",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#22d3ee",
        "editor.selectionBackground": "#083344",
      },
    },
  },

  // 2. Dracula
  {
    id: "dracula",
    name: "Dracula",
    description: "Dark violet background with iconic pink, purple & cyan highlights",
    category: "Vibrant",
    colors: {
      themeBackground: "#1e1f29",
      themeSurface: "#21222c",
      themeSurfacePanel: "#282a36",
      themeSurfaceRaised: "#343746",
      themeSurfaceCard: "#383a59",
      themeSurfaceHover: "#44475a",
      themeSurfaceActive: "#4e5169",
      themeSurfaceInput: "#21222c",
      themeSurfaceBadge: "#3d2a45",
      themeBorder: "#383a4c",
      themeBorderSubtle: "#2d303e",
      themeBorderCard: "#44475a",
      themeBorderFocus: "#ff79c6",
      themeText: "#f8f8f2",
      themeTextMuted: "#b6b9cf",
      themeTextSubtle: "#6272a4",
      themeTextAccent: "#8be9fd",
      themeAccent: "#ff79c6",
      themeAccentHover: "#ff92d0",
      themeAccentDim: "rgba(255, 121, 198, 0.18)",
      themeAccentSecondary: "#bd93f9",
      themeSuccess: "#50fa7b",
      themeWarning: "#ffb86c",
      themeError: "#ff5555",
      themeInfo: "#8be9fd",
      themeEditorBackground: "#282a36",
      themeEditorForeground: "#f8f8f2",
      themeSelection: "#44475a",
      swatches: ["#282a36", "#ff79c6", "#bd93f9", "#8be9fd"],
    },
    monacoThemeId: "dracula",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "f8f8f2", background: "282a36" },
        { token: "keyword", foreground: "ff79c6", fontStyle: "bold" },
        { token: "string", foreground: "f1fa8c" },
        { token: "number", foreground: "bd93f9" },
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "type", foreground: "8be9fd" },
        { token: "function", foreground: "50fa7b" },
        { token: "variable", foreground: "f8f8f2" },
      ],
      colors: {
        "editor.background": "#282a36",
        "editor.foreground": "#f8f8f2",
        "editorCursor.foreground": "#ff79c6",
        "editor.lineHighlightBackground": "#343746",
        "editorLineNumber.foreground": "#6272a4",
        "editorLineNumber.activeForeground": "#ff79c6",
        "editor.selectionBackground": "#44475a",
      },
    },
  },



  // 4. Tokyo Night
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Deep blue-black with indigo, purple & soft-neon highlights",
    category: "Vibrant",
    colors: {
      themeBackground: "#16161e",
      themeSurface: "#1a1b26",
      themeSurfacePanel: "#1f2335",
      themeSurfaceRaised: "#24283b",
      themeSurfaceCard: "#292e42",
      themeSurfaceHover: "#343b58",
      themeSurfaceActive: "#3b4261",
      themeSurfaceInput: "#16161e",
      themeSurfaceBadge: "#1e2a4a",
      themeBorder: "#23283b",
      themeBorderSubtle: "#1c2030",
      themeBorderCard: "#292e42",
      themeBorderFocus: "#7aa2f7",
      themeText: "#c0caf5",
      themeTextMuted: "#a9b1d6",
      themeTextSubtle: "#565f89",
      themeTextAccent: "#7dcfff",
      themeAccent: "#7aa2f7",
      themeAccentHover: "#89b4fa",
      themeAccentDim: "rgba(122, 162, 247, 0.18)",
      themeAccentSecondary: "#bb9af7",
      themeSuccess: "#73daca",
      themeWarning: "#ff9e64",
      themeError: "#f7768e",
      themeInfo: "#7dcfff",
      themeEditorBackground: "#1a1b26",
      themeEditorForeground: "#c0caf5",
      themeSelection: "#283457",
      swatches: ["#1a1b26", "#7aa2f7", "#bb9af7", "#7dcfff"],
    },
    monacoThemeId: "tokyo-night",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "c0caf5", background: "1a1b26" },
        { token: "keyword", foreground: "bb9af7", fontStyle: "bold" },
        { token: "string", foreground: "9ece6a" },
        { token: "number", foreground: "ff9e64" },
        { token: "comment", foreground: "565f89", fontStyle: "italic" },
        { token: "type", foreground: "2ac3de" },
        { token: "function", foreground: "7aa2f7" },
        { token: "variable", foreground: "c0caf5" },
      ],
      colors: {
        "editor.background": "#1a1b26",
        "editor.foreground": "#c0caf5",
        "editorCursor.foreground": "#7aa2f7",
        "editor.lineHighlightBackground": "#24283b",
        "editorLineNumber.foreground": "#565f89",
        "editorLineNumber.activeForeground": "#7aa2f7",
        "editor.selectionBackground": "#283457",
      },
    },
  },



  // 6. Monokai Pro
  {
    id: "monokai-pro",
    name: "Monokai Pro",
    description: "Rich dark charcoal with distinct yellow, pink, green & blue syntax",
    category: "Classic",
    colors: {
      themeBackground: "#19181a",
      themeSurface: "#221f22",
      themeSurfacePanel: "#282529",
      themeSurfaceRaised: "#2d2a2e",
      themeSurfaceCard: "#363337",
      themeSurfaceHover: "#403e41",
      themeSurfaceActive: "#4a474b",
      themeSurfaceInput: "#19181a",
      themeSurfaceBadge: "#3d362e",
      themeBorder: "#2f2c30",
      themeBorderSubtle: "#282529",
      themeBorderCard: "#403e41",
      themeBorderFocus: "#ffd866",
      themeText: "#fcfcfa",
      themeTextMuted: "#c1c0c0",
      themeTextSubtle: "#727072",
      themeTextAccent: "#a9dc76",
      themeAccent: "#ffd866",
      themeAccentHover: "#ffe082",
      themeAccentDim: "rgba(255, 216, 102, 0.18)",
      themeAccentSecondary: "#ff6188",
      themeSuccess: "#a9dc76",
      themeWarning: "#fc9867",
      themeError: "#ff6188",
      themeInfo: "#78dce8",
      themeEditorBackground: "#2d2a2e",
      themeEditorForeground: "#fcfcfa",
      themeSelection: "#403e41",
      swatches: ["#2d2a2e", "#ffd866", "#ff6188", "#a9dc76"],
    },
    monacoThemeId: "monokai-pro",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "fcfcfa", background: "2d2a2e" },
        { token: "keyword", foreground: "ff6188", fontStyle: "bold" },
        { token: "string", foreground: "ffd866" },
        { token: "number", foreground: "ab9df2" },
        { token: "comment", foreground: "727072", fontStyle: "italic" },
        { token: "type", foreground: "78dce8" },
        { token: "function", foreground: "a9dc76" },
        { token: "variable", foreground: "fc9867" },
      ],
      colors: {
        "editor.background": "#2d2a2e",
        "editor.foreground": "#fcfcfa",
        "editorCursor.foreground": "#ffd866",
        "editor.lineHighlightBackground": "#3a363b",
        "editorLineNumber.foreground": "#727072",
        "editorLineNumber.activeForeground": "#ffd866",
        "editor.selectionBackground": "#403e41",
      },
    },
  },

  // 7. GitHub
  {
    id: "github",
    name: "GitHub",
    description: "Clean GitHub dark UI with professional blue accents & high readability",
    category: "Neutral",
    colors: {
      themeBackground: "#010409",
      themeSurface: "#0d1117",
      themeSurfacePanel: "#131820",
      themeSurfaceRaised: "#161b22",
      themeSurfaceCard: "#21262d",
      themeSurfaceHover: "#2b313a",
      themeSurfaceActive: "#30363d",
      themeSurfaceInput: "#010409",
      themeSurfaceBadge: "#13233a",
      themeBorder: "#21262d",
      themeBorderSubtle: "#1c2128",
      themeBorderCard: "#30363d",
      themeBorderFocus: "#58a6ff",
      themeText: "#c9d1d9",
      themeTextMuted: "#8b949e",
      themeTextSubtle: "#6e7681",
      themeTextAccent: "#58a6ff",
      themeAccent: "#58a6ff",
      themeAccentHover: "#79c0ff",
      themeAccentDim: "rgba(88, 166, 255, 0.18)",
      themeAccentSecondary: "#bc8cff",
      themeSuccess: "#3fb950",
      themeWarning: "#d29922",
      themeError: "#f85149",
      themeInfo: "#58a6ff",
      themeEditorBackground: "#0d1117",
      themeEditorForeground: "#c9d1d9",
      themeSelection: "#1f3b5c",
      swatches: ["#0d1117", "#58a6ff", "#3fb950", "#bc8cff"],
    },
    monacoThemeId: "github-dark",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "c9d1d9", background: "0d1117" },
        { token: "keyword", foreground: "ff7b72", fontStyle: "bold" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "type", foreground: "ffa657" },
        { token: "function", foreground: "d2a8ff" },
        { token: "variable", foreground: "c9d1d9" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editorCursor.foreground": "#58a6ff",
        "editor.lineHighlightBackground": "#161b22",
        "editorLineNumber.foreground": "#6e7681",
        "editorLineNumber.activeForeground": "#58a6ff",
        "editor.selectionBackground": "#1f3b5c",
      },
    },
  },

  // 8. Neon Genesis
  {
    id: "neon-genesis",
    name: "Neon Genesis",
    description: "High-contrast cyberpunk with holographic cyan, neon pink & matrix green",
    category: "Cyberpunk",
    colors: {
      themeBackground: "#030308",
      themeSurface: "#060710",
      themeSurfacePanel: "#090a18",
      themeSurfaceRaised: "#0b0d1e",
      themeSurfaceCard: "#10132b",
      themeSurfaceHover: "#181c3e",
      themeSurfaceActive: "#202552",
      themeSurfaceInput: "#05060d",
      themeSurfaceBadge: "#220c2b",
      themeBorder: "#151938",
      themeBorderSubtle: "#0e1126",
      themeBorderCard: "#202758",
      themeBorderFocus: "#00f0ff",
      themeText: "#ffffff",
      themeTextMuted: "#b3c0f7",
      themeTextSubtle: "#818cf8",
      themeTextAccent: "#00ff66",
      themeAccent: "#00f0ff",
      themeAccentHover: "#38f8ff",
      themeAccentDim: "rgba(0, 240, 255, 0.2)",
      themeAccentSecondary: "#ff007f",
      themeSuccess: "#00ff66",
      themeWarning: "#ff6600",
      themeError: "#ff0055",
      themeInfo: "#00f0ff",
      themeEditorBackground: "#030308",
      themeEditorForeground: "#ffffff",
      themeSelection: "#2b1040",
      swatches: ["#030308", "#00f0ff", "#ff007f", "#00ff66"],
    },
    monacoThemeId: "neon-genesis",
    monacoThemeData: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "ffffff", background: "030308" },
        { token: "keyword", foreground: "ff007f", fontStyle: "bold" },
        { token: "string", foreground: "00ff66" },
        { token: "number", foreground: "ff6600" },
        { token: "comment", foreground: "818cf8", fontStyle: "italic" },
        { token: "type", foreground: "00f0ff" },
        { token: "function", foreground: "00f0ff" },
        { token: "variable", foreground: "ffffff" },
      ],
      colors: {
        "editor.background": "#030308",
        "editor.foreground": "#ffffff",
        "editorCursor.foreground": "#00f0ff",
        "editor.lineHighlightBackground": "#0e1128",
        "editorLineNumber.foreground": "#434b8c",
        "editorLineNumber.activeForeground": "#00f0ff",
        "editor.selectionBackground": "#2b1040",
      },
    },
  },
];

export const DEFAULT_THEME_ID = "nexus-dark";

export function getTheme(id: string): ThemeDefinition {
  const found = THEMES.find((t) => t.id === id);
  return found || THEMES[0];
}

export function getAllThemes(): ThemeDefinition[] {
  return THEMES;
}

/**
 * Registers all 8 custom Monaco themes so the editor syntax colors
 * match the selected global NEXUS theme.
 */
export function registerMonacoThemes(monaco: any): void {
  if (!monaco?.editor?.defineTheme) return;

  for (const theme of THEMES) {
    try {
      monaco.editor.defineTheme(theme.monacoThemeId, theme.monacoThemeData);
    } catch (e) {
      console.warn(`[THEME] Failed to define Monaco theme ${theme.monacoThemeId}:`, e);
    }
  }
}

/**
 * Applies CSS variables and data-theme attribute to document and roots.
 */
export function applyThemeToDocument(theme: ThemeDefinition, monaco?: any): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);

  const c = theme.colors;

  // Set comprehensive IDE surface hierarchy tokens
  root.style.setProperty("--theme-background", c.themeBackground);
  root.style.setProperty("--theme-surface", c.themeSurface);
  root.style.setProperty("--theme-surface-panel", c.themeSurfacePanel);
  root.style.setProperty("--theme-surface-raised", c.themeSurfaceRaised);
  root.style.setProperty("--theme-surface-card", c.themeSurfaceCard);
  root.style.setProperty("--theme-surface-hover", c.themeSurfaceHover);
  root.style.setProperty("--theme-surface-active", c.themeSurfaceActive);
  root.style.setProperty("--theme-surface-input", c.themeSurfaceInput);
  root.style.setProperty("--theme-surface-badge", c.themeSurfaceBadge);

  root.style.setProperty("--theme-border", c.themeBorder);
  root.style.setProperty("--theme-border-subtle", c.themeBorderSubtle);
  root.style.setProperty("--theme-border-card", c.themeBorderCard);
  root.style.setProperty("--theme-border-focus", c.themeBorderFocus);

  root.style.setProperty("--theme-text", c.themeText);
  root.style.setProperty("--theme-text-muted", c.themeTextMuted);
  root.style.setProperty("--theme-text-subtle", c.themeTextSubtle);
  root.style.setProperty("--theme-text-accent", c.themeTextAccent);

  root.style.setProperty("--theme-accent", c.themeAccent);
  root.style.setProperty("--theme-accent-hover", c.themeAccentHover);
  root.style.setProperty("--theme-accent-dim", c.themeAccentDim);
  root.style.setProperty("--theme-accent-secondary", c.themeAccentSecondary);
  root.style.setProperty("--theme-success", c.themeSuccess);
  root.style.setProperty("--theme-warning", c.themeWarning);
  root.style.setProperty("--theme-error", c.themeError);
  root.style.setProperty("--theme-info", c.themeInfo);

  root.style.setProperty("--theme-editor-background", c.themeEditorBackground);
  root.style.setProperty("--theme-editor-foreground", c.themeEditorForeground);
  root.style.setProperty("--theme-selection", c.themeSelection);

  // Backward-compatibility aliases
  root.style.setProperty("--bg-app", c.themeBackground);
  root.style.setProperty("--bg-header", c.themeSurface);
  root.style.setProperty("--bg-sidebar", c.themeSurface);
  root.style.setProperty("--bg-card", c.themeSurfacePanel);
  root.style.setProperty("--bg-card-hover", c.themeSurfaceHover);
  root.style.setProperty("--bg-editor", c.themeEditorBackground);
  root.style.setProperty("--bg-input", c.themeSurfaceInput);
  root.style.setProperty("--bg-popover", c.themeSurfaceRaised);
  root.style.setProperty("--bg-badge", c.themeSurfaceBadge);

  root.style.setProperty("--border-app", c.themeBorder);
  root.style.setProperty("--border-card", c.themeBorderCard);
  root.style.setProperty("--border-focus", c.themeBorderFocus);
  root.style.setProperty("--border-subtle", c.themeBorderSubtle);

  root.style.setProperty("--accent-primary", c.themeAccent);
  root.style.setProperty("--accent-primary-hover", c.themeAccentHover);
  root.style.setProperty("--accent-primary-dim", c.themeAccentDim);
  root.style.setProperty("--accent-secondary", c.themeAccentSecondary);

  root.style.setProperty("--text-main", c.themeText);
  root.style.setProperty("--text-muted", c.themeTextMuted);
  root.style.setProperty("--text-dim", c.themeTextSubtle);
  root.style.setProperty("--text-accent", c.themeTextAccent);

  if (monaco?.editor?.setTheme) {
    try {
      monaco.editor.setTheme(theme.monacoThemeId);
    } catch (e) {
      console.warn(`[THEME] Failed to set Monaco editor theme:`, e);
    }
  }
}
