import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UIPreferenceState {
  viewMode: "table" | "grid";
  compactMode: boolean;
  notificationDrawerOpen: boolean;

  // Actions
  setViewMode: (mode: "table" | "grid") => void;
  toggleCompactMode: () => void;
  setNotificationDrawerOpen: (open: boolean) => void;
  toggleNotificationDrawer: () => void;
}

export const useUIStore = create<UIPreferenceState>()(
  persist(
    (set) => ({
      viewMode: "table",
      compactMode: false,
      notificationDrawerOpen: false,

      setViewMode: (viewMode) => set({ viewMode }),
      toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
      setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),
      toggleNotificationDrawer: () =>
        set((state) => ({ notificationDrawerOpen: !state.notificationDrawerOpen })),
    }),
    {
      name: "ums-ui-preferences",
      partialize: (state) => ({
        viewMode: state.viewMode,
        compactMode: state.compactMode,
      }),
    },
  ),
);
