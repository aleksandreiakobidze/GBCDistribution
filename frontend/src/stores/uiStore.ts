import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'medium' | 'dark';
export type ResolvedTheme = ThemeMode;

function normalizeTheme(theme: string | undefined): ThemeMode {
  if (theme === 'dark' || theme === 'medium' || theme === 'light') return theme;
  if (theme === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

const themeColors: Record<ResolvedTheme, string> = {
  light: '#2563eb',
  medium: '#f4efe6',
  dark: '#0c1222',
};

function applyThemeToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('medium', resolved === 'medium');
  root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', themeColors[resolved]);
  }
}

interface UiState {
  sidebarOpen: boolean;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  language: 'en' | 'ka';
  defaultWarehouseId: string;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (lang: 'en' | 'ka') => void;
  setDefaultWarehouseId: (id: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'light',
      resolvedTheme: 'light',
      language: 'en',
      defaultWarehouseId: '1',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme, resolvedTheme: theme });
      },
      setLanguage: (language) => set({ language }),
      setDefaultWarehouseId: (id) => set({ defaultWarehouseId: id }),
    }),
    {
      name: 'bsc-ui',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        language: state.language,
        defaultWarehouseId: state.defaultWarehouseId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const stored = state.theme as string;
        const theme = normalizeTheme(stored);
        state.theme = theme;
        state.resolvedTheme = theme;
        applyThemeToDOM(theme);
        if (stored !== theme) {
          queueMicrotask(() => {
            useUiStore.setState({ theme, resolvedTheme: theme });
          });
        }
      },
    }
  )
);

