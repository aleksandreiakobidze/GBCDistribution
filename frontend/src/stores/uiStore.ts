import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0c1222' : '#2563eb');
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
    (set, get) => ({
      sidebarOpen: true,
      theme: 'system',
      resolvedTheme: getSystemTheme(),
      language: 'en',
      defaultWarehouseId: '1',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
        applyThemeToDOM(resolved);
        set({ theme, resolvedTheme: resolved });
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
        const resolved: ResolvedTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
        state.resolvedTheme = resolved;
        applyThemeToDOM(resolved);
      },
    }
  )
);

if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    const store = useUiStore.getState();
    if (store.theme === 'system') {
      const resolved = getSystemTheme();
      applyThemeToDOM(resolved);
      useUiStore.setState({ resolvedTheme: resolved });
    }
  });
}
