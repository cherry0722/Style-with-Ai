import { create } from "zustand";
import type { CurrentOutfit } from "../services/recommender";

interface CurrentOutfitState {
  currentOutfit: CurrentOutfit | null;
  setCurrentOutfit: (outfit: CurrentOutfit | null) => void;
}

export const useCurrentOutfitStore = create<CurrentOutfitState>((set) => ({
  currentOutfit: null,
  setCurrentOutfit: (outfit) => set({ currentOutfit: outfit }),
}));


