/**
 * UI Store
 *
 * Zustand store for UI state management (theme, loading states, etc.)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UIState {
  // Theme
  themeMode: ThemeMode;
  isDarkMode: boolean;

  // Loading states
  isGlobalLoading: boolean;
  loadingMessage: string | null;

  // Modals and overlays
  isModalVisible: boolean;
  modalContent: string | null;

  // Toast/Snackbar
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info' | 'warning' | null;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setDarkMode: (isDark: boolean) => void;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  showModal: (content: string) => void;
  hideModal: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  hideToast: () => void;
}

// In-memory storage for React Native (will be replaced with AsyncStorage in production)
const memoryStorage: Record<string, string> = {};

const asyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return memoryStorage[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    memoryStorage[name] = value;
  },
  removeItem: async (name: string): Promise<void> => {
    delete memoryStorage[name];
  },
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      themeMode: 'system',
      isDarkMode: false,
      isGlobalLoading: false,
      loadingMessage: null,
      isModalVisible: false,
      modalContent: null,
      toastMessage: null,
      toastType: null,

      // Actions
      setThemeMode: (mode) =>
        set({
          themeMode: mode,
        }),

      setDarkMode: (isDark) =>
        set({
          isDarkMode: isDark,
        }),

      setGlobalLoading: (isLoading, message) =>
        set({
          isGlobalLoading: isLoading,
          loadingMessage: message ?? null,
        }),

      showModal: (content) =>
        set({
          isModalVisible: true,
          modalContent: content,
        }),

      hideModal: () =>
        set({
          isModalVisible: false,
          modalContent: null,
        }),

      showToast: (message, type) =>
        set({
          toastMessage: message,
          toastType: type,
        }),

      hideToast: () =>
        set({
          toastMessage: null,
          toastType: null,
        }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
    }
  )
);
