export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export type CardioIntensity = 'light' | 'moderate' | 'vigorous';
export type WeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type WeekdayMode = 'rest' | 'cardio';
export type WorkoutSetType = 'working' | 'warmup' | 'preparatory' | 'biset' | 'dropset' | 'failure';

export type WorkoutSet = {
  id: string;
  setType: WorkoutSetType;
  reps: string;
  suggestedWeight: string;
  loadPercent: string;
  instruction: string;
  rir: string;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sets: WorkoutSet[];
};

export type WorkoutDay = {
  id: string;
  name: string;
  subtitle: string;
  exercises: WorkoutExercise[];
};

export type WeeklyScheduleDay = {
  workoutDayId: string | null;
  mode: WeekdayMode;
};

export type WeeklySchedule = Record<WeekdayKey, WeeklyScheduleDay>;

export type CardioConfig = {
  weeklyMinutes: string;
  intensity: CardioIntensity;
  notes: string;
};

export type StudentTrainingPlan = {
  id?: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  workoutDays: WorkoutDay[];
  baseWorkoutDays: WorkoutDay[];
  weeklySchedule: WeeklySchedule;
  cardioConfig: CardioConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type TrainingTemplate = {
  id: string;
  name: string;
  emoji: string;
  days: string;
  description: string;
  workoutDays: WorkoutDay[];
  weeklySchedule: WeeklySchedule;
};
