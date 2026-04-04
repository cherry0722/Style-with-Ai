import client from './client';
import { AvatarRenderConfig } from '../avatar/avatarClothingConfig';
import { WardrobeItemInOutfit } from './ai';

export interface SavedOutfitItem {
  _id: string;
  userId: string;
  occasion: string | null;
  items: WardrobeItemInOutfit[];
  reasons: string[];
  avatarRenderConfig: AvatarRenderConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedOutfitPayload {
  occasion: string | null;
  items: WardrobeItemInOutfit[];
  reasons: string[];
  avatarRenderConfig: AvatarRenderConfig | null;
}

export async function createSavedOutfit(
  payload: CreateSavedOutfitPayload
): Promise<SavedOutfitItem> {
  const res = await client.post<SavedOutfitItem>('/api/saved', payload);
  return res.data;
}

export async function listSavedOutfits(): Promise<SavedOutfitItem[]> {
  const res = await client.get<SavedOutfitItem[]>('/api/saved');
  return res.data;
}

export async function deleteSavedOutfit(id: string): Promise<void> {
  await client.delete(`/api/saved/${id}`);
}
