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
  const formData = new FormData();

  formData.append('image', {
    uri,
    name: inferFileNameFromUri(uri),
    type: inferMimeTypeFromUri(uri),
  } as any);

  const res = await client.post<{ imageUrl: string }>(
    '/api/upload/image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  if (!res.data?.imageUrl) {
    throw new Error('Upload response missing imageUrl');
  }

  return res.data.imageUrl;
};

export const createWardrobeItem = async (
  payload: WardrobeItemPayload
): Promise<WardrobeItemResponse> => {
  const res = await client.post<WardrobeItemResponse>(
    '/api/wardrobe',
    payload
  );
  return res.data;
};
