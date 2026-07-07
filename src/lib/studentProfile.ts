import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from './supabase';
import { STUDENT_SELECT } from './students';
import type { Student, StudentProfilePayload } from '../types/student';

const STUDENT_PROFILE_MEDIA_BUCKET = 'student-profile-media';

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

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`;
  }

  if (trimmed.includes('instagram.com/') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function uploadStudentProfileImage({
  studentId,
  asset,
  kind,
}: {
  studentId: string;
  asset: ImagePickerAsset;
  kind: 'avatar' | 'cover';
}) {
  const extension = getFileExtension(asset);
  const contentType = getContentType(asset);
  const filePath = `${studentId}/${kind}-${Date.now()}.${extension}`;
  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem selecionada.');
  }

  const fileBody = await response.arrayBuffer();

  const { data, error } = await supabase.storage
    .from(STUDENT_PROFILE_MEDIA_BUCKET)
    .upload(filePath, fileBody, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STUDENT_PROFILE_MEDIA_BUCKET).getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl,
  };
}

export async function updateStudentProfile(
  studentId: string,
  payload: StudentProfilePayload,
): Promise<Student> {
  const normalizedUsername = optionalText(payload.username)?.replace(/^@+/, '').toLowerCase() ?? null;

  const updates: Record<string, unknown> = {
    display_name: optionalText(payload.displayName),
    username: normalizedUsername || null,
    headline: optionalText(payload.headline),
    bio: optionalText(payload.bio),
    location: optionalText(payload.location),
    instagram_url: normalizeUrl(payload.instagramUrl),
    website_url: normalizeUrl(payload.websiteUrl),
  };

  if (payload.avatarAsset) {
    const uploadedAvatar = await uploadStudentProfileImage({
      studentId,
      asset: payload.avatarAsset,
      kind: 'avatar',
    });

    updates.avatar_path = uploadedAvatar.path;
    updates.avatar_url = uploadedAvatar.publicUrl;
  }

  if (payload.coverAsset) {
    const uploadedCover = await uploadStudentProfileImage({
      studentId,
      asset: payload.coverAsset,
      kind: 'cover',
    });

    updates.cover_path = uploadedCover.path;
    updates.cover_url = uploadedCover.publicUrl;
  }

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select(STUDENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as Student;
}
