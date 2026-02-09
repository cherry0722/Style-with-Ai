import client from './client';
import type { FashionMetadata } from '../types';

export interface WardrobeItemPayload {
  imageUrl: string;
  cleanImageUrl?: string;
  category: string;
  colors?: string[];
  notes?: string;
  metadata?: FashionMetadata;
  tags?: string[];
  styleVibe?: string[];
}

export interface WardrobeV2Availability {
  status: 'available' | 'unavailable';
  reason: 'laundry' | 'packed' | null;
  untilDate: string | null;
}

export interface WardrobeItemResponse {
  _id?: string;
  id?: string;
  userId?: string;
  imageUrl: string;
  cleanImageUrl?: string;
  category: string;
  colors?: string[];
  notes?: string;
  isFavorite?: boolean;
  tags?: string[];
  metadata?: FashionMetadata;
  styleVibe?: string[];
  profile?: { category?: string; type?: string; confidence?: number; [key: string]: unknown } | null;
  type?: string | null;
  primaryColor?: string | null;
  createdAt?: string;
  updatedAt?: string;
  v2?: {
    userTags?: string[];
    overrides?: Record<string, unknown> | null;
    availability?: WardrobeV2Availability;
  };
}

export interface WardrobeAnalyzeResponse {
  imageUrl: string;
  azure_tags: string[];
  azure_colors: {
    dominantColors?: string[];
    accentColor?: string;
    dominantForegroundColor?: string;
    dominantBackgroundColor?: string;
    [key: string]: any;
  };
  llm_metadata: FashionMetadata | null;
  category_hint: string | null;
  color_hint: string | null;
}

const inferMimeTypeFromUri = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  // Expo URIs often don't have extensions; default to jpeg
  return 'image/jpeg';
};

const inferFileNameFromUri = (uri: string): string => {
  try {
    const parts = uri.split('/');
    const last = parts[parts.length - 1] || 'photo.jpg';
    return last.includes('.') ? last : `${last}.jpg`;
  } catch {
    return 'photo.jpg';
  }
};

/** v1 pipeline: POST /api/wardrobe/items (multipart image) — upload → process-item → create. Returns created item with profile. */
export interface WardrobeItemV1Response {
  _id: string;
  userId: string;
  imageUrl: string;
  cleanImageUrl?: string | null;
  profile?: {
    category?: string;
    type?: string;
    primaryColor?: string;
    confidence?: number;
    [key: string]: unknown;
  } | null;
  category?: string | null;
  type?: string | null;
  primaryColor?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function uploadWardrobeItem(uri: string): Promise<WardrobeItemV1Response> {
  const formData = new FormData();
  const fileName = inferFileNameFromUri(uri);
  const mimeType = inferMimeTypeFromUri(uri);
  formData.append('image', {
    uri,
    name: fileName,
    type: mimeType,
  } as any);
  const res = await client.post<WardrobeItemV1Response>('/api/wardrobe/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export const uploadWardrobeImage = async (
  uri: string
): Promise<{ imageUrl: string; cleanImageUrl?: string }> => {
  console.log("[Wardrobe API] uploadWardrobeImage called with uri:", uri);
  
  const formData = new FormData();
  const fileName = inferFileNameFromUri(uri);
  const mimeType = inferMimeTypeFromUri(uri);

  formData.append('image', {
    uri,
    name: fileName,
    type: mimeType,
  } as any);

  console.log("[Wardrobe API] FormData prepared:", {
    fieldName: 'image',
    fileName,
    mimeType,
    uri: uri.substring(0, 50) + '...', // Log partial URI for privacy
  });

  try {
    console.log("[Wardrobe API] Calling POST /api/upload/image");
    const res = await client.post<{ imageUrl: string; cleanImageUrl?: string }>(
      '/api/upload/image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    console.log("[Wardrobe API] /api/upload/image response:", res.data);
    console.log("[Wardrobe API] Response status:", res.status);
    console.log("[Wardrobe API] cleanImageUrl:", res.data?.cleanImageUrl || 'null');

    if (!res.data?.imageUrl) {
      console.error("[Wardrobe API] Upload response missing imageUrl:", res.data);
      throw new Error('Upload response missing imageUrl');
    }

    console.log("[Wardrobe API] Upload successful, imageUrl =", res.data.imageUrl);
    return {
      imageUrl: res.data.imageUrl,
      cleanImageUrl: res.data.cleanImageUrl,
    };
  } catch (err: any) {
    console.error("[Wardrobe API] uploadWardrobeImage error:", {
      message: err?.message,
      status: err?.status ?? err?.response?.status,
      data: err?.response?.data,
      fullError: err,
    });
    throw err;
  }
};

export async function analyzeWardrobeImage(payload: {
  imageUrl: string;
  category?: string;
  colors?: string[];
  notes?: string;
}): Promise<WardrobeAnalyzeResponse> {
  console.log(
    "[Wardrobe API] analyzeWardrobeImage called with payload:",
    payload
  );
  const response = await client.post<WardrobeAnalyzeResponse>(
    "/api/wardrobe/analyze",
    payload
  );
  console.log(
    "[Wardrobe API] /api/wardrobe/analyze response:",
    response.data
  );
  return response.data;
}

export const createWardrobeItem = async (
  payload: WardrobeItemPayload
): Promise<WardrobeItemResponse> => {
  console.log("[Wardrobe API] createWardrobeItem called with payload:", payload);

  try {
    console.log("[Wardrobe API] Calling POST /api/wardrobe");
    const res = await client.post<WardrobeItemResponse>(
      '/api/wardrobe',
      payload
    );

    console.log("[Wardrobe API] /api/wardrobe response:", res.data);
    console.log("[Wardrobe API] Response status:", res.status);
    console.log("[Wardrobe API] Created item _id:", res.data?._id);
    console.log("[Wardrobe API] Created item userId:", res.data?.userId);
    console.log("[Wardrobe API] Created item category:", res.data?.category);

    return res.data;
  } catch (err: any) {
    console.error("[Wardrobe API] createWardrobeItem error:", {
      message: err?.message,
      status: err?.status ?? err?.response?.status,
      data: err?.response?.data,
      fullError: err,
    });
    throw err;
  }
};

/** GET /api/wardrobe — v2 returns { items }. Default excludes unavailable. */
export const fetchWardrobeItems = async (includeUnavailable = false): Promise<WardrobeItemResponse[]> => {
  const url = includeUnavailable ? '/api/wardrobe?includeUnavailable=true' : '/api/wardrobe';
  const res = await client.get<{ items?: WardrobeItemResponse[] } | WardrobeItemResponse[]>(url);
  const data = res.data;
  if (data && typeof data === 'object' && Array.isArray((data as { items?: WardrobeItemResponse[] }).items)) {
    return (data as { items: WardrobeItemResponse[] }).items;
  }
  if (Array.isArray(data)) return data;
  return [];
};

/** Alias for fetchWardrobeItems (GET /api/wardrobe). */
export const listWardrobe = (includeUnavailable?: boolean) => fetchWardrobeItems(includeUnavailable);

export const toggleFavorite = async (
  id: string,
  isFavorite: boolean
): Promise<WardrobeItemResponse> => {
  console.log("[Wardrobe API] toggleFavorite called with id:", id, "isFavorite:", isFavorite);

  try {
    console.log("[Wardrobe API] Calling PATCH /api/wardrobe/:id/favorite");
    const res = await client.patch<WardrobeItemResponse>(
      `/api/wardrobe/${id}/favorite`,
      { isFavorite }
    );

    console.log("[Wardrobe API] /api/wardrobe/:id/favorite response:", res.data);
    console.log("[Wardrobe API] Response status:", res.status);
    console.log("[Wardrobe API] Updated item _id:", res.data?._id);
    console.log("[Wardrobe API] Updated item isFavorite:", res.data?.isFavorite);

    return res.data;
  } catch (err: any) {
    console.error("[Wardrobe API] toggleFavorite error:", {
      message: err?.message,
      status: err?.status ?? err?.response?.status,
      data: err?.response?.data,
      fullError: err,
    });
    throw err;
  }
};

export async function deleteWardrobeItem(id: string): Promise<void> {
  await client.delete(`/api/wardrobe/${id}`);
}

/** PATCH /api/wardrobe/:id/v2 — update only v2 overlay (e.g. availability). */
export async function patchWardrobeV2(
  id: string,
  payload: { userTags?: string[]; overrides?: Record<string, unknown>; availability?: WardrobeV2Availability }
): Promise<WardrobeItemResponse> {
  const res = await client.patch<{ item: WardrobeItemResponse }>(`/api/wardrobe/${id}/v2`, payload);
  return res.data.item;
}
