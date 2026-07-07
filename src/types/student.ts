export type StudentStatus = 'active' | 'paused' | 'archived';
export type StudentSex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type StudentGoal = 'hypertrophy' | 'fat_loss' | 'recomposition' | 'health' | 'performance';

export type Student = {
  id: string;
  trainer_id: string;
  consultancy_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  whatsapp: string | null;
  age: number | null;
  sex: StudentSex | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: StudentGoal;
  activity_level: ActivityLevel;
  experience: TrainingExperience;
  restrictions: string | null;
  display_name?: string | null;
  username?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  status: StudentStatus;
  created_at?: string;
  updated_at?: string;
  notifications_count?: number;
};

export type StudentFormPayload = {
  fullName: string;
  email: string;
  password?: string;
  whatsapp: string;
  age: string;
  sex: StudentSex;
  heightCm: string;
  weightKg: string;
  goal: StudentGoal;
  activityLevel: ActivityLevel;
  experience: TrainingExperience;
  restrictions: string;
};

export type StudentProfilePayload = {
  displayName: string;
  username: string;
  headline: string;
  bio: string;
  location: string;
  instagramUrl: string;
  websiteUrl: string;
  avatarAsset: import('expo-image-picker').ImagePickerAsset | null;
  coverAsset: import('expo-image-picker').ImagePickerAsset | null;
};

export type StudentMetrics = {
  bmi: number | null;
  bmr: number | null;
  dailyCalories: number | null;
  suggestedCalories: number | null;
  goalLabel: string;
};

export type StudentProfileTab =
  | 'profile'
  | 'summary'
  | 'data'
  | 'methodology'
  | 'routine'
  | 'anamnesis'
  | 'evolution'
  | 'training'
  | 'nutrition'
  | 'checkins'
  | 'chat'
  | 'ia';
