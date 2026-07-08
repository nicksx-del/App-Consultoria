import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateFoodsTotals, calculateMealTotals } from './nutrition';
import { supabase } from './supabase';
import type { Profile } from '../types/auth';
import type {
  ConsumedMealFood,
  MacroTotals,
  MealFoodSubstitution,
  NutritionMeal,
  NutritionWeekday,
  StudentNutritionPlan,
} from '../types/nutrition';
import type { Student } from '../types/student';
import type { StudentTrainingPlan, WorkoutDay } from '../types/training';
import type {
  SaveCardioLogPayload,
  MealLogStatus,
  SaveMealLogPayload,
  StartWorkoutSessionPayload,
  StudentCardioLog,
  StudentMealLog,
  StudentWorkoutSession,
  WorkoutExerciseExecutionLog,
  WorkoutSetExecutionLog,
} from '../types/studentExecution';

const WORKOUT_SESSION_SELECT =
  'id, student_id, trainer_id, consultancy_id, training_plan_id, workout_day_id, workout_day_name, status, started_at, completed_at, duration_seconds, exercise_logs, notes, created_at, updated_at';

const MEAL_LOG_SELECT =
  'id, student_id, trainer_id, consultancy_id, nutrition_plan_id, meal_id, meal_name, log_date, weekday, status, totals, consumed_foods, substitutions, notes, created_at, updated_at';

const CARDIO_LOG_SELECT =
  'id, student_id, trainer_id, consultancy_id, training_plan_id, log_date, source, modality, intensity, duration_seconds, started_at, completed_at, distance_km, calories, notes, created_at, updated_at';

export const mealStatusLabels: Record<MealLogStatus, string> = {
  planned: 'Pendente',
  eaten: 'Comeu',
  partial: 'Parcial',
  skipped: 'Nao comeu',
};

export const mealStatusWeights: Record<MealLogStatus, number> = {
  planned: 0,
  eaten: 1,
  partial: 0.5,
  skipped: 0,
};

const emptyTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

const LOCAL_MEAL_LOG_STORAGE_PREFIX = '@consultoria:meal-logs:';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeNullableNumber(value: unknown) {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeMacroTotals(value: unknown): MacroTotals {
  if (!value || typeof value !== 'object') {
    return { ...emptyTotals };
  }

  const totals = value as Partial<MacroTotals>;

  return {
    calories: normalizeNumber(totals.calories),
    protein: normalizeNumber(totals.protein),
    carbs: normalizeNumber(totals.carbs),
    fat: normalizeNumber(totals.fat),
  };
}

function normalizeConsumedFood(value: unknown): ConsumedMealFood | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<ConsumedMealFood>;

  return {
    id: normalizeText(item.id),
    name: normalizeText(item.name),
    quantity: normalizeText(item.quantity),
    unit: normalizeText(item.unit),
    calories: normalizeText(item.calories),
    protein: normalizeText(item.protein),
    carbs: normalizeText(item.carbs),
    fat: normalizeText(item.fat),
    notes: normalizeText(item.notes),
    libraryItemId: typeof item.libraryItemId === 'string' ? item.libraryItemId : null,
    category: (item.category as ConsumedMealFood['category']) ?? null,
    substitutionLocked: Boolean(item.substitutionLocked),
    originalFoodId: typeof item.originalFoodId === 'string' ? item.originalFoodId : null,
    substitutionId: typeof item.substitutionId === 'string' ? item.substitutionId : null,
    substituted: Boolean(item.substituted),
  };
}

function normalizeSubstitution(value: unknown): MealFoodSubstitution | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<MealFoodSubstitution>;

  return {
    id: normalizeText(item.id),
    originalFoodId: normalizeText(item.originalFoodId),
    originalFoodName: normalizeText(item.originalFoodName),
    originalQuantity: normalizeText(item.originalQuantity),
    originalUnit: normalizeText(item.originalUnit),
    originalTotals: normalizeMacroTotals(item.originalTotals),
    replacementLibraryItemId: normalizeText(item.replacementLibraryItemId),
    replacementFoodName: normalizeText(item.replacementFoodName),
    replacementQuantity: normalizeText(item.replacementQuantity),
    replacementUnit: normalizeText(item.replacementUnit),
    replacementTotals: normalizeMacroTotals(item.replacementTotals),
    notes: normalizeText(item.notes),
    createdAt: normalizeText(item.createdAt),
  };
}

function roundMacro(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

function addTotals(total: MacroTotals, next: MacroTotals, multiplier = 1): MacroTotals {
  return {
    calories: roundMacro(total.calories + next.calories * multiplier),
    protein: roundMacro(total.protein + next.protein * multiplier),
    carbs: roundMacro(total.carbs + next.carbs * multiplier),
    fat: roundMacro(total.fat + next.fat * multiplier),
  };
}

function normalizeSetLog(value: unknown): WorkoutSetExecutionLog | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<WorkoutSetExecutionLog>;

  return {
    setId: normalizeText(item.setId),
    setIndex: typeof item.setIndex === 'number' ? item.setIndex : 0,
    targetReps: normalizeText(item.targetReps),
    targetSetType: normalizeText(item.targetSetType),
    targetWeight: normalizeText(item.targetWeight),
    targetLoadPercent: normalizeText(item.targetLoadPercent),
    targetRir: normalizeText(item.targetRir),
    instruction: normalizeText(item.instruction),
    completed: Boolean(item.completed),
    weight: normalizeText(item.weight),
    reps: normalizeText(item.reps),
    actualRir: normalizeText(item.actualRir),
    executionQuality: normalizeText(item.executionQuality),
    completedAt: normalizeText(item.completedAt),
    notes: normalizeText(item.notes),
  };
}

function normalizeExerciseLog(value: unknown): WorkoutExerciseExecutionLog | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<WorkoutExerciseExecutionLog>;
  const sets = Array.isArray(item.sets) ? item.sets.map(normalizeSetLog).filter(Boolean) : [];

  return {
    exerciseId: normalizeText(item.exerciseId),
    exerciseName: normalizeText(item.exerciseName),
    primaryMuscle: normalizeText(item.primaryMuscle),
    completed: Boolean(item.completed),
    sets: sets as WorkoutSetExecutionLog[],
  };
}

function mapWorkoutSessionRow(row: any): StudentWorkoutSession {
  const exerciseLogs = Array.isArray(row.exercise_logs)
    ? row.exercise_logs.map(normalizeExerciseLog).filter(Boolean)
    : [];

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    trainingPlanId: row.training_plan_id,
    workoutDayId: row.workout_day_id,
    workoutDayName: row.workout_day_name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    exerciseLogs: exerciseLogs as WorkoutExerciseExecutionLog[],
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMealLogRow(row: any): StudentMealLog {
  const consumedFoods = Array.isArray(row.consumed_foods)
    ? row.consumed_foods.map(normalizeConsumedFood).filter(Boolean)
    : [];
  const substitutions = Array.isArray(row.substitutions)
    ? row.substitutions.map(normalizeSubstitution).filter(Boolean)
    : [];

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    nutritionPlanId: row.nutrition_plan_id,
    mealId: row.meal_id,
    mealName: row.meal_name,
    logDate: row.log_date,
    weekday: row.weekday,
    status: row.status,
    totals: normalizeMacroTotals(row.totals),
    consumedFoods: consumedFoods as ConsumedMealFood[],
    substitutions: substitutions as MealFoodSubstitution[],
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function localMealLogKey(studentId: string) {
  return `${LOCAL_MEAL_LOG_STORAGE_PREFIX}${studentId}`;
}

function mapCardioLogRow(row: any): StudentCardioLog {
  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    trainingPlanId: row.training_plan_id,
    logDate: row.log_date,
    source: row.source === 'timer' ? 'timer' : 'manual',
    modality: row.modality ?? 'Cardio',
    intensity:
      row.intensity === 'light' || row.intensity === 'vigorous' || row.intensity === 'moderate'
        ? row.intensity
        : 'moderate',
    durationSeconds: normalizeNumber(row.duration_seconds),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    distanceKm: normalizeNullableNumber(row.distance_km),
    calories: normalizeNullableNumber(row.calories),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekdayFromDate(value: string): NutritionWeekday {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  const weekday = date.getDay();

  return ([
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as NutritionWeekday[])[weekday];
}

export function buildSessionFromWorkoutDay(
  student: Student,
  profile: Profile,
  plan: StudentTrainingPlan,
  payload: StartWorkoutSessionPayload,
): Omit<StudentWorkoutSession, 'id' | 'createdAt' | 'updatedAt'> {
  const startedAt = new Date().toISOString();

  return {
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    trainingPlanId: payload.planId,
    workoutDayId: payload.workoutDay.id,
    workoutDayName: payload.workoutDay.name,
    status: 'in_progress',
    startedAt,
    completedAt: null,
    durationSeconds: null,
    exerciseLogs: payload.workoutDay.exercises.map((exercise): WorkoutExerciseExecutionLog => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      completed: false,
      sets: exercise.sets.map((set, setIndex): WorkoutSetExecutionLog => ({
        setId: set.id,
        setIndex: setIndex + 1,
        targetReps: set.reps,
        targetSetType: set.setType ?? 'working',
        targetWeight: set.suggestedWeight,
        targetLoadPercent: set.loadPercent,
        targetRir: set.rir,
        instruction: set.instruction,
        completed: false,
        weight: '',
        reps: '',
        actualRir: '',
        executionQuality: '',
        completedAt: '',
        notes: '',
      })),
    })),
    notes: profile.role === 'student' ? '' : `Registrado por ${profile.full_name ?? 'treinador'}.`,
  };
}

export function calculateWorkoutSessionProgress(session: StudentWorkoutSession | null) {
  if (!session) {
    return {
      completedSets: 0,
      totalSets: 0,
      percent: 0,
      completedExercises: 0,
      totalExercises: 0,
    };
  }

  const totalSets = session.exerciseLogs.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedSets = session.exerciseLogs.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  );
  const totalExercises = session.exerciseLogs.length;
  const completedExercises = session.exerciseLogs.filter((exercise) =>
    exercise.sets.length ? exercise.sets.every((set) => set.completed) : exercise.completed,
  ).length;

  return {
    completedSets,
    totalSets,
    percent: totalSets ? Math.round((completedSets / totalSets) * 100) : 0,
    completedExercises,
    totalExercises,
  };
}

export function calculateConsumedTotals(
  plan: StudentNutritionPlan,
  mealLogs: StudentMealLog[],
  logDate: string,
  weekday: NutritionWeekday,
) {
  const logsByMeal = new Map(
    mealLogs
      .filter((log) => log.logDate === logDate)
      .map((log) => [log.mealId, log]),
  );

  return plan.meals
    .filter((meal) => meal.weekday === weekday)
    .reduce((total, meal) => {
      const log = logsByMeal.get(meal.id);

      if (!log) {
        return total;
      }

      const multiplier = mealStatusWeights[log.status] ?? 0;
      return addTotals(total, log.totals, multiplier);
    }, { ...emptyTotals });
}

export function calculateRemainingTotals(target: MacroTotals, consumed: MacroTotals): MacroTotals {
  return {
    calories: roundMacro(target.calories - consumed.calories),
    protein: roundMacro(target.protein - consumed.protein),
    carbs: roundMacro(target.carbs - consumed.carbs),
    fat: roundMacro(target.fat - consumed.fat),
  };
}

export function mealLogPayloadTotals(meal: NutritionMeal) {
  return calculateMealTotals(meal);
}

function normalizePayloadFoods(payload: SaveMealLogPayload) {
  if (payload.consumedFoods?.length) {
    return payload.consumedFoods.map((food) => ({
      ...food,
      originalFoodId: food.originalFoodId ?? null,
      substitutionId: food.substitutionId ?? null,
      substituted: Boolean(food.substituted),
    }));
  }

  return payload.meal.foods.map((food) => ({
    ...food,
    originalFoodId: null,
    substitutionId: null,
    substituted: false,
  }));
}

function payloadTotals(payload: SaveMealLogPayload) {
  const foods = normalizePayloadFoods(payload);
  return foods.length ? calculateFoodsTotals(foods) : mealLogPayloadTotals(payload.meal);
}

export async function fetchLocalStudentMealLogs(student: Student, logDate: string) {
  try {
    const raw = await AsyncStorage.getItem(localMealLogKey(student.id));
    if (!raw) {
      return [] as StudentMealLog[];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as StudentMealLog[];
    }

    return parsed
      .map((row) =>
        mapMealLogRow({
          ...row,
          consumed_foods: row.consumedFoods ?? row.consumed_foods,
          substitutions: row.substitutions,
        }),
      )
      .filter((log) => log.logDate === logDate);
  } catch {
    return [] as StudentMealLog[];
  }
}

export async function saveLocalStudentMealLog({
  student,
  payload,
}: {
  student: Student;
  payload: SaveMealLogPayload;
}) {
  const current = await fetchLocalStudentMealLogs(student, payload.logDate);
  const raw = await AsyncStorage.getItem(localMealLogKey(student.id));
  const allLogs = raw ? (JSON.parse(raw) as StudentMealLog[]) : [];
  const existing = current.find((item) => item.mealId === payload.meal.id);
  const now = new Date().toISOString();
  const nextLog: StudentMealLog = {
    id: existing?.id ?? `local-meal-log-${student.id}-${payload.logDate}-${payload.meal.id}`,
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    nutritionPlanId: payload.planId,
    mealId: payload.meal.id,
    mealName: payload.meal.name,
    logDate: payload.logDate,
    weekday: payload.weekday,
    status: payload.status,
    totals: payloadTotals(payload),
    consumedFoods: normalizePayloadFoods(payload),
    substitutions: payload.substitutions ?? [],
    notes: payload.notes.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextAllLogs = [...allLogs.filter((item) => !(item.logDate === payload.logDate && item.mealId === payload.meal.id)), nextLog];
  await AsyncStorage.setItem(localMealLogKey(student.id), JSON.stringify(nextAllLogs));
  return nextLog;
}

export async function fetchStudentWorkoutSessions(student: Student) {
  const { data, error } = await supabase
    .from('student_workout_sessions')
    .select(WORKOUT_SESSION_SELECT)
    .eq('student_id', student.id)
    .order('started_at', { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapWorkoutSessionRow);
}

export async function startStudentWorkoutSession({
  student,
  profile,
  plan,
  workoutDay,
}: {
  student: Student;
  profile: Profile;
  plan: StudentTrainingPlan;
  workoutDay: WorkoutDay;
}) {
  const session = buildSessionFromWorkoutDay(student, profile, plan, {
    planId: plan.id ?? null,
    workoutDay,
  });

  const { data, error } = await supabase
    .from('student_workout_sessions')
    .insert({
      student_id: session.studentId,
      trainer_id: session.trainerId,
      consultancy_id: session.consultancyId,
      training_plan_id: session.trainingPlanId,
      workout_day_id: session.workoutDayId,
      workout_day_name: session.workoutDayName,
      status: session.status,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      duration_seconds: session.durationSeconds,
      exercise_logs: session.exerciseLogs,
      notes: session.notes,
      created_by: profile.id,
    })
    .select(WORKOUT_SESSION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapWorkoutSessionRow(data);
}

export async function saveStudentWorkoutSession(session: StudentWorkoutSession) {
  const { data, error } = await supabase
    .from('student_workout_sessions')
    .update({
      status: session.status,
      completed_at: session.completedAt,
      duration_seconds: session.durationSeconds,
      exercise_logs: session.exerciseLogs,
      notes: session.notes || null,
    })
    .eq('id', session.id)
    .select(WORKOUT_SESSION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapWorkoutSessionRow(data);
}

export async function finishStudentWorkoutSession(session: StudentWorkoutSession) {
  const startedAt = new Date(session.startedAt).getTime();
  const completedAt = new Date();
  const durationSeconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.round((completedAt.getTime() - startedAt) / 1000))
    : session.durationSeconds;

  return saveStudentWorkoutSession({
    ...session,
    status: 'completed',
    completedAt: completedAt.toISOString(),
    durationSeconds,
  });
}

export async function fetchStudentMealLogs(student: Student, logDate: string) {
  const { data, error } = await supabase
    .from('student_meal_logs')
    .select(MEAL_LOG_SELECT)
    .eq('student_id', student.id)
    .eq('log_date', logDate)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapMealLogRow);
}

export async function fetchStudentCardioLogs(student: Student) {
  const { data, error } = await supabase
    .from('student_cardio_logs')
    .select(CARDIO_LOG_SELECT)
    .eq('student_id', student.id)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCardioLogRow);
}

export async function saveStudentMealLog({
  student,
  payload,
}: {
  student: Student;
  payload: SaveMealLogPayload;
}) {
  const { data, error } = await supabase
    .from('student_meal_logs')
    .upsert(
      {
        student_id: student.id,
        trainer_id: student.trainer_id,
        consultancy_id: student.consultancy_id,
        nutrition_plan_id: payload.planId,
        meal_id: payload.meal.id,
        meal_name: payload.meal.name,
        log_date: payload.logDate,
        weekday: payload.weekday,
        status: payload.status,
        totals: payloadTotals(payload),
        consumed_foods: normalizePayloadFoods(payload),
        substitutions: payload.substitutions ?? [],
        notes: payload.notes.trim() || null,
      },
      { onConflict: 'student_id,log_date,meal_id' },
    )
    .select(MEAL_LOG_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapMealLogRow(data);
}

export async function saveStudentCardioLog({
  student,
  profile,
  payload,
}: {
  student: Student;
  profile: Profile;
  payload: SaveCardioLogPayload;
}) {
  const { data, error } = await supabase
    .from('student_cardio_logs')
    .insert({
      student_id: student.id,
      trainer_id: student.trainer_id,
      consultancy_id: student.consultancy_id,
      training_plan_id: payload.planId,
      log_date: payload.logDate,
      source: payload.source,
      modality: payload.modality.trim() || 'Cardio',
      intensity: payload.intensity,
      duration_seconds: Math.max(1, Math.round(payload.durationSeconds)),
      started_at: payload.startedAt,
      completed_at: payload.completedAt,
      distance_km: payload.distanceKm,
      calories: payload.calories,
      notes: payload.notes.trim() || null,
      created_by: profile.id,
    })
    .select(CARDIO_LOG_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCardioLogRow(data);
}
