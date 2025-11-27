import client from './client';

export interface WardrobeItemPayload {
  imageUrl: string;
  category: string;
  colors?: string[];
  notes?: string;
}

export interface WardrobeItemResponse {
  _id: string;
  userId: string;
  imageUrl: string;
  category: string;
  colors: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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

export const uploadWardrobeImage = async (uri: string): Promise<string> => {
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
    const res = await client.post<{ imageUrl: string }>(
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

    if (!res.data?.imageUrl) {
      console.error("[Wardrobe API] Upload response missing imageUrl:", res.data);
      throw new Error('Upload response missing imageUrl');
    }

    console.log("[Wardrobe API] Upload successful, imageUrl =", res.data.imageUrl);
    return res.data.imageUrl;
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

export const fetchWardrobeItems = async (): Promise<WardrobeItemResponse[]> => {
  const res = await client.get<WardrobeItemResponse[]>('/api/wardrobe');
  return res.data;
};
