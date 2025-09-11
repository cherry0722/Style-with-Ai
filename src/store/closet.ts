import { create } from "zustand";
import { Garment } from "../types";

interface ClosetState {
  items: Garment[];
  add: (g: Garment) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useCloset = create<ClosetState>((set) => ({
  items: [],
  add: (g) => set((s) => ({ items: [g, ...s.items] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  reset: () => set({ items: [] }),
}));
