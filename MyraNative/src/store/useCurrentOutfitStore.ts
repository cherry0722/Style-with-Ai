import { create } from "zustand";
import type { CurrentOutfit } from "../services/recommender";

interface CurrentOutfitState {
  currentOutfit: CurrentOutfit | null;
  setCurrentOutfit: (outfit: CurrentOutfit | null) => void;
  reset: () => void;
}

export const useCurrentOutfitStore = create<CurrentOutfitState>((set) => ({
  currentOutfit: null,
  setCurrentOutfit: (outfit) => set({ currentOutfit: outfit }),
  reset: () => set({ currentOutfit: null }),
}));
