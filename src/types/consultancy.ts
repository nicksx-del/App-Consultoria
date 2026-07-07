import type { ImagePickerAsset } from 'expo-image-picker';

export type Consultancy = {
  id: string;
  trainer_id: string;
  name: string;
  whatsapp: string | null;
  instagram_url: string | null;
  website_url: string | null;
  banner_path: string | null;
  banner_url: string | null;
  image_path: string | null;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ConsultancySetupPayload = {
  name: string;
  whatsapp: string;
  instagramUrl: string;
  websiteUrl: string;
  bannerAsset: ImagePickerAsset | null;
  imageAsset: ImagePickerAsset | null;
};

export type UploadedConsultancyImage = {
  path: string;
  publicUrl: string;
};
