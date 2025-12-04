/**
 * Auth Store
 *
 * Zustand store for authentication state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setOnboarded: (isOnboarded: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  clearError: () => void;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state - start with loading false for simplicity
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isOnboarded: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      setOnboarded: (isOnboarded) =>
        set({
          isOnboarded,
        }),

      setLoading: (isLoading) =>
        set({
          isLoading,
        }),

      setError: (error) =>
        set({
          error,
        }),

      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          error: null,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isOnboarded: false,
          error: null,
        }),

      clearError: () =>
        set({
          error: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
