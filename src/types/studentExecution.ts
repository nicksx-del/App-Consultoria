import type {
  ConsumedMealFood,
  MacroTotals,
  MealFoodSubstitution,
  NutritionMeal,
  NutritionWeekday,
} from './nutrition';
import type { CardioIntensity } from './training';
import type { WorkoutDay } from './training';

export type WorkoutSessionStatus = 'in_progress' | 'completed';

export type WorkoutSetExecutionLog = {
  setId: string;
  setIndex: number;
  targetReps: string;
  targetSetType: string;
  targetWeight: string;
  targetLoadPercent: string;
  targetRir: string;
  instruction: string;
  completed: boolean;
  weight: string;
  reps: string;
  actualRir: string;
  executionQuality: string;
  completedAt: string;
  notes: string;
};

export type WorkoutExerciseExecutionLog = {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  completed: boolean;
  sets: WorkoutSetExecutionLog[];
};

export type StudentWorkoutSession = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  trainingPlanId: string | null;
  workoutDayId: string;
  workoutDayName: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  exerciseLogs: WorkoutExerciseExecutionLog[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MealLogStatus = 'planned' | 'eaten' | 'partial' | 'skipped';

export type StudentMealLog = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  nutritionPlanId: string | null;
  mealId: string;
  mealName: string;
  logDate: string;
  weekday: NutritionWeekday;
  status: MealLogStatus;
  totals: MacroTotals;
  consumedFoods: ConsumedMealFood[];
  substitutions: MealFoodSubstitution[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CardioLogSource = 'manual' | 'timer';

export type StudentCardioLog = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  trainingPlanId: string | null;
  logDate: string;
  source: CardioLogSource;
  modality: string;
  intensity: CardioIntensity;
  durationSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  calories: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveMealLogPayload = {
  planId: string | null;
  meal: NutritionMeal;
  logDate: string;
  weekday: NutritionWeekday;
  status: MealLogStatus;
  notes: string;
  consumedFoods?: ConsumedMealFood[];
  substitutions?: MealFoodSubstitution[];
};

export type SaveCardioLogPayload = {
  planId: string | null;
  logDate: string;
  source: CardioLogSource;
  modality: string;
  intensity: CardioIntensity;
  durationSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  calories: number | null;
  notes: string;
};

export type StartWorkoutSessionPayload = {
  planId: string | null;
  workoutDay: WorkoutDay;
};
