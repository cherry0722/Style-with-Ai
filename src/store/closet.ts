import { create } from "zustand";
import { Garment } from "../types";

interface ClosetState {
  items: Garment[];
  add: (item: Garment) => void;
  setItems: (items: Garment[]) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useCloset = create<ClosetState>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
  setItems: (items) => set({ items }),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  reset: () => set({ items: [] }),
}));
