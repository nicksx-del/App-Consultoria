import type { ImagePickerAsset } from 'expo-image-picker';

export type CheckInStatus = 'pending' | 'reviewed' | 'adjusted';

export type CheckInPhotoLabel = 'front' | 'back' | 'left' | 'right' | 'relaxed' | 'other';

export type CheckInPhoto = {
  id: string;
  label: CheckInPhotoLabel;
  path: string;
  url: string | null;
  mimeType: string | null;
  size: number | null;
};

export type CheckInVideoLabel = 'last_set' | 'posing' | 'cardio' | 'other';

export type CheckInVideo = {
  id: string;
  label: CheckInVideoLabel;
  path: string;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  duration: number | null;
};

export type StudentCheckIn = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  submittedBy: string;
  status: CheckInStatus;
  checkinDate: string;
  weightKg: number | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  dietAdherence: number | null;
  trainingAdherence: number | null;
  cardioAdherence: number | null;
  sleepQuality: number | null;
  stressLevel: number | null;
  energyLevel: number | null;
  studentNotes: string | null;
  coachFeedback: string | null;
  coachPrivateNotes: string | null;
  photos: CheckInPhoto[];
  videos: CheckInVideo[];
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CheckInPhotoDraft = {
  id: string;
  label: CheckInPhotoLabel;
  asset: ImagePickerAsset;
};

export type CheckInVideoDraft = {
  id: string;
  label: CheckInVideoLabel;
  asset: ImagePickerAsset;
};

export type SubmitCheckInPayload = {
  checkinDate: string;
  weightKg: string;
  waistCm: string;
  abdomenCm: string;
  hipCm: string;
  chestCm: string;
  armCm: string;
  thighCm: string;
  dietAdherence: string;
  trainingAdherence: string;
  cardioAdherence: string;
  sleepQuality: string;
  stressLevel: string;
  energyLevel: string;
  studentNotes: string;
  photos: CheckInPhotoDraft[];
  videos: CheckInVideoDraft[];
};

export type ReviewCheckInPayload = {
  status: CheckInStatus;
  coachFeedback: string;
  coachPrivateNotes: string;
};
