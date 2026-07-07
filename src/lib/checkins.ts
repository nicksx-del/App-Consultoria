import { supabase } from './supabase';
import type { Profile } from '../types/auth';
import type { Student } from '../types/student';
import type {
  CheckInPhoto,
  CheckInPhotoDraft,
  CheckInStatus,
  CheckInVideo,
  CheckInVideoDraft,
  ReviewCheckInPayload,
  StudentCheckIn,
  SubmitCheckInPayload,
} from '../types/checkin';

const CHECKIN_MEDIA_BUCKET = 'checkin-media';
const CHECKIN_SELECT =
  'id, student_id, trainer_id, consultancy_id, submitted_by, status, checkin_date, weight_kg, waist_cm, abdomen_cm, hip_cm, chest_cm, arm_cm, thigh_cm, diet_adherence, training_adherence, cardio_adherence, sleep_quality, stress_level, energy_level, student_notes, coach_feedback, coach_private_notes, photos, videos, reviewed_at, created_at, updated_at';

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function optionalNumber(value: string) {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: string) {
  const parsed = optionalNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function clampScale(value: string) {
  const parsed = optionalNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function getImageMimeType(assetMime?: string | null) {
  if (assetMime === 'image/png' || assetMime === 'image/webp' || assetMime === 'image/gif') {
    return assetMime;
  }

  return 'image/jpeg';
}

function getVideoMimeType(assetMime?: string | null) {
  if (assetMime === 'video/quicktime' || assetMime === 'video/webm') {
    return assetMime;
  }

  return 'video/mp4';
}

function getExtensionFromMime(mimeType: string | null | undefined) {
  const subtype = mimeType?.split('/')[1]?.split(';')[0]?.split('+')[0];

  if (!subtype) {
    return 'jpg';
  }

  return subtype === 'jpeg' ? 'jpg' : subtype;
}

function mediaFolder(student: Student, profile: Profile) {
  return `${student.id}/${profile.id}`;
}

async function createSignedUrl(path: string | null) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage.from(CHECKIN_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

async function uploadPhoto(student: Student, profile: Profile, photo: CheckInPhotoDraft): Promise<CheckInPhoto> {
  const mimeType = getImageMimeType(photo.asset.mimeType);
  const response = await fetch(photo.asset.uri);
  const fileBody = await response.arrayBuffer();
  const extension = getExtensionFromMime(mimeType);
  const filePath = `${mediaFolder(student, profile)}/checkin-${photo.label}-${Date.now()}-${photo.id}.${extension}`;

  const { data, error } = await supabase.storage.from(CHECKIN_MEDIA_BUCKET).upload(filePath, fileBody, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return {
    id: photo.id,
    label: photo.label,
    path: data.path,
    url: await createSignedUrl(data.path),
    mimeType,
    size: fileBody.byteLength,
  };
}

async function uploadVideo(student: Student, profile: Profile, video: CheckInVideoDraft): Promise<CheckInVideo> {
  const mimeType = getVideoMimeType(video.asset.mimeType);
  const response = await fetch(video.asset.uri);
  const fileBody = await response.arrayBuffer();
  const extension = getExtensionFromMime(mimeType);
  const filePath = `${mediaFolder(student, profile)}/checkin-video-${video.label}-${Date.now()}-${video.id}.${extension}`;

  const { data, error } = await supabase.storage.from(CHECKIN_MEDIA_BUCKET).upload(filePath, fileBody, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return {
    id: video.id,
    label: video.label,
    path: data.path,
    url: await createSignedUrl(data.path),
    mimeType,
    size: fileBody.byteLength,
    duration: video.asset.duration ?? null,
  };
}

async function mapCheckInRow(row: any): Promise<StudentCheckIn> {
  const photos = Array.isArray(row.photos) ? row.photos : [];
  const videos = Array.isArray(row.videos) ? row.videos : [];

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    submittedBy: row.submitted_by,
    status: row.status,
    checkinDate: row.checkin_date,
    weightKg: row.weight_kg,
    waistCm: row.waist_cm,
    abdomenCm: row.abdomen_cm,
    hipCm: row.hip_cm,
    chestCm: row.chest_cm,
    armCm: row.arm_cm,
    thighCm: row.thigh_cm,
    dietAdherence: row.diet_adherence,
    trainingAdherence: row.training_adherence,
    cardioAdherence: row.cardio_adherence,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    energyLevel: row.energy_level,
    studentNotes: row.student_notes,
    coachFeedback: row.coach_feedback,
    coachPrivateNotes: row.coach_private_notes,
    photos: await Promise.all(
      photos.map(async (photo: CheckInPhoto) => ({
        ...photo,
        url: await createSignedUrl(photo.path),
      })),
    ),
    videos: await Promise.all(
      videos.map(async (video: CheckInVideo) => ({
        ...video,
        url: await createSignedUrl(video.path),
      })),
    ),
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchStudentCheckIns(student: Student) {
  const { data, error } = await supabase
    .from('student_checkins')
    .select(CHECKIN_SELECT)
    .eq('student_id', student.id)
    .order('checkin_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(52);

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map(mapCheckInRow));
}

export async function submitStudentCheckIn({
  student,
  profile,
  payload,
}: {
  student: Student;
  profile: Profile;
  payload: SubmitCheckInPayload;
}) {
  const uploadedPhotos = await Promise.all(payload.photos.map((photo) => uploadPhoto(student, profile, photo)));
  const uploadedVideos = await Promise.all(payload.videos.map((video) => uploadVideo(student, profile, video)));

  const { data, error } = await supabase
    .from('student_checkins')
    .insert({
      student_id: student.id,
      trainer_id: student.trainer_id,
      consultancy_id: student.consultancy_id,
      submitted_by: profile.id,
      checkin_date: payload.checkinDate,
      weight_kg: optionalNumber(payload.weightKg),
      waist_cm: optionalNumber(payload.waistCm),
      abdomen_cm: optionalNumber(payload.abdomenCm),
      hip_cm: optionalNumber(payload.hipCm),
      chest_cm: optionalNumber(payload.chestCm),
      arm_cm: optionalNumber(payload.armCm),
      thigh_cm: optionalNumber(payload.thighCm),
      diet_adherence: clampPercent(payload.dietAdherence),
      training_adherence: clampPercent(payload.trainingAdherence),
      cardio_adherence: clampPercent(payload.cardioAdherence),
      sleep_quality: clampScale(payload.sleepQuality),
      stress_level: clampScale(payload.stressLevel),
      energy_level: clampScale(payload.energyLevel),
      student_notes: optionalText(payload.studentNotes),
      photos: uploadedPhotos.map(({ url, ...photo }) => photo),
      videos: uploadedVideos.map(({ url, ...video }) => video),
    })
    .select(CHECKIN_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCheckInRow(data);
}

export async function reviewStudentCheckIn(checkIn: StudentCheckIn, payload: ReviewCheckInPayload) {
  const status: CheckInStatus = payload.status;
  const reviewedAt = status === 'pending' ? null : new Date().toISOString();

  const { data, error } = await supabase
    .from('student_checkins')
    .update({
      status,
      coach_feedback: optionalText(payload.coachFeedback),
      coach_private_notes: optionalText(payload.coachPrivateNotes),
      reviewed_at: reviewedAt,
    })
    .eq('id', checkIn.id)
    .select(CHECKIN_SELECT)
    .single();

  if (error) {
    throw error;
  }

  await supabase
    .from('student_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('student_id', checkIn.studentId)
    .eq('type', 'checkin')
    .eq('is_read', false);

  return mapCheckInRow(data);
}
