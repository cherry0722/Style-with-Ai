import { create } from "zustand";
import type { OutfitSuggestion } from "../types";

interface FavState {
  items: OutfitSuggestion[];
  isFav: (s: OutfitSuggestion) => boolean;
  toggle: (s: OutfitSuggestion) => void;
  clear: () => void;
}

export const useFavorites = create<FavState>((set, get) => ({
  items: [],
  isFav: (s) => get().items.some((x) => x.id === s.id),
  toggle: (s) =>
    set((state) => {
      const exists = state.items.find((x) => x.id === s.id);
      return exists
        ? { items: state.items.filter((x) => x.id !== s.id) }
        : { items: [s, ...state.items] };
    }),
  clear: () => set({ items: [] }),
}));

