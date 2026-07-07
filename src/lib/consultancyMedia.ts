import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from './supabase';
import type { UploadedConsultancyImage } from '../types/consultancy';

const CONSULTANCY_MEDIA_BUCKET = 'consultancy-media';

function getFileExtension(asset: ImagePickerAsset) {
  const mimeExtension = asset.mimeType?.split('/')[1]?.split('+')[0];
  const uriExtension = asset.uri.split('?')[0]?.split('.').pop();
  const extension = mimeExtension || uriExtension || 'jpg';

  if (extension === 'jpeg' || extension === 'jpg') {
    return 'jpg';
  }

  if (extension === 'png' || extension === 'webp') {
    return extension;
  }

  return 'jpg';
}

function getContentType(asset: ImagePickerAsset) {
  if (asset.mimeType === 'image/png' || asset.mimeType === 'image/webp') {
    return asset.mimeType;
  }

  return 'image/jpeg';
}

export async function uploadConsultancyImage({
  asset,
  kind,
  userId,
}: {
  asset: ImagePickerAsset;
  kind: 'banner' | 'image';
  userId: string;
}): Promise<UploadedConsultancyImage> {
  const extension = getFileExtension(asset);
  const contentType = getContentType(asset);
  const filePath = `${userId}/${kind}-${Date.now()}.${extension}`;
  const response = await fetch(asset.uri);
  const fileBody = await response.arrayBuffer();

  const { data, error } = await supabase.storage
    .from(CONSULTANCY_MEDIA_BUCKET)
    .upload(filePath, fileBody, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(CONSULTANCY_MEDIA_BUCKET).getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl,
  };
}
