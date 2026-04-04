import { create } from 'zustand';
import {
  SavedOutfitItem,
  CreateSavedOutfitPayload,
  createSavedOutfit,
  listSavedOutfits,
  deleteSavedOutfit,
} from '../api/saved';

interface SavedOutfitsState {
  items: SavedOutfitItem[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (payload: CreateSavedOutfitPayload) => Promise<SavedOutfitItem>;
  remove: (id: string) => Promise<void>;
}

export const useSavedOutfits = create<SavedOutfitsState>((set, get) => ({
  items: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const items = await listSavedOutfits();
      set({ items, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  add: async (payload: CreateSavedOutfitPayload) => {
    // Optimistic: create a temp item immediately
    const tempId = `temp_${Date.now()}`;
    const tempItem: SavedOutfitItem = {
      _id: tempId,
      userId: '',
      occasion: payload.occasion,
      items: payload.items,
      reasons: payload.reasons,
      avatarRenderConfig: payload.avatarRenderConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set(state => ({ items: [tempItem, ...state.items] }));

    try {
      const confirmed = await createSavedOutfit(payload);
      // Replace temp with real
      set(state => ({
        items: state.items.map(i => (i._id === tempId ? confirmed : i)),
      }));
      return confirmed;
    } catch (err) {
      // Revert on failure
      set(state => ({ items: state.items.filter(i => i._id !== tempId) }));
      throw err;
    }
  },

  remove: async (id: string) => {
    const snapshot = get().items;
    // Optimistic remove
    set(state => ({ items: state.items.filter(i => i._id !== id) }));
    try {
      await deleteSavedOutfit(id);
    } catch (err) {
      // Revert on failure
      set({ items: snapshot });
      throw err;
    }
  },
}));
