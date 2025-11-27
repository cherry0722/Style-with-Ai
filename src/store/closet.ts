import { create } from "zustand";
import { Garment } from "../types";

interface ClosetState {
  items: Garment[];
  add: (item: Garment) => void;
  setItems: (items: Garment[]) => void;
  remove: (id: string) => void;
  reset: () => void;
  updateItem: (id: string, partial: Partial<Garment>) => void;
}

export const useCloset = create<ClosetState>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
  setItems: (items) => set({ items }),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  reset: () => set({ items: [] }),
  updateItem: (id, partial) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, ...partial } : item
      ),
    })),
}));
