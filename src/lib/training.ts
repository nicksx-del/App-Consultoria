import { supabase } from './supabase';
import type { Student } from '../types/student';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CardioConfig,
  CardioIntensity,
  MuscleGroup,
  StudentTrainingPlan,
  TrainingTemplate,
  WeekdayKey,
  WeeklySchedule,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from '../types/training';

export const muscleLabels: Record<MuscleGroup, string> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quads: 'Quadríceps',
  hamstrings: 'Posterior',
  glutes: 'Glúteos',
  calves: 'Panturrilha',
  abs: 'Abdômen',
};

export const muscleOptions = Object.entries(muscleLabels).map(([value, label]) => ({
  value: value as MuscleGroup,
  label,
}));

export const muscleVolumeTargets: Record<MuscleGroup, { min: number; max: number }> = {
  chest: { min: 12, max: 16 },
  back: { min: 14, max: 22 },
  shoulders: { min: 16, max: 22 },
  biceps: { min: 14, max: 20 },
  triceps: { min: 10, max: 14 },
  quads: { min: 12, max: 18 },
  hamstrings: { min: 10, max: 16 },
  glutes: { min: 12, max: 16 },
  calves: { min: 12, max: 16 },
  abs: { min: 6, max: 16 },
};

export const weekdayLabels: Record<WeekdayKey, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const weekdayOrder: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const cardioIntensityLabels: Record<CardioIntensity, string> = {
  light: 'Leve - Zona 1',
  moderate: 'Moderada - Zona 2',
  vigorous: 'Vigorosa - Zona 3',
};

export const defaultCardioConfig: CardioConfig = {
  weeklyMinutes: '150',
  intensity: 'moderate',
  notes: '',
};

const validSetTypes = new Set<WorkoutSetType>(['working', 'warmup', 'preparatory', 'biset', 'dropset', 'failure']);

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkoutSet(reps = '10-12'): WorkoutSet {
  return {
    id: createId('set'),
    setType: 'working',
    reps,
    suggestedWeight: '',
    loadPercent: '100',
    instruction: '',
    rir: '',
  };
}

function createSets(count: number, reps: string) {
  return Array.from({ length: count }, () => createWorkoutSet(reps));
}

function exercise(
  name: string,
  primaryMuscle: MuscleGroup,
  secondaryMuscles: MuscleGroup[],
  sets: number,
  reps: string,
  difficulty: WorkoutExercise['difficulty'] = 'intermediate',
): WorkoutExercise {
  return {
    id: createId('exercise'),
    name,
    primaryMuscle,
    secondaryMuscles,
    difficulty,
    sets: createSets(sets, reps),
  };
}

function day(name: string, subtitle: string, exercises: WorkoutExercise[]): WorkoutDay {
  return {
    id: createId('day'),
    name,
    subtitle,
    exercises,
  };
}

export function createDefaultWeeklySchedule(workoutDays: WorkoutDay[] = []): WeeklySchedule {
  return {
    monday: { workoutDayId: workoutDays[0]?.id ?? null, mode: 'rest' },
    tuesday: { workoutDayId: workoutDays[1]?.id ?? null, mode: 'rest' },
    wednesday: { workoutDayId: workoutDays[2]?.id ?? null, mode: 'rest' },
    thursday: { workoutDayId: null, mode: 'cardio' },
    friday: { workoutDayId: workoutDays[0]?.id ?? null, mode: 'rest' },
    saturday: { workoutDayId: null, mode: 'cardio' },
    sunday: { workoutDayId: null, mode: 'rest' },
  };
}

function pplDays() {
  const push = day('Push', 'Peito · Ombro · Triceps', [
    exercise('Supino Reto com Barra', 'chest', ['triceps', 'shoulders'], 4, '8-10'),
    exercise('Supino Inclinado com Halteres', 'chest', ['triceps', 'shoulders'], 3, '10-12'),
    exercise('Desenvolvimento com Halteres', 'shoulders', ['triceps'], 3, '10-12'),
    exercise('Elevacao Lateral', 'shoulders', [], 3, '12-15'),
    exercise('Triceps Corda no Pulley', 'triceps', [], 3, '12-15'),
  ]);

  const pull = day('Pull', 'Costas · Biceps · Posterior de ombro', [
    exercise('Puxada Frente', 'back', ['biceps'], 4, '8-10'),
    exercise('Remada Curvada com Barra', 'back', ['biceps'], 4, '8-10'),
    exercise('Remada Baixa', 'back', ['biceps'], 3, '10-12'),
    exercise('Face Pull', 'shoulders', ['back'], 3, '12-15'),
    exercise('Rosca Direta', 'biceps', [], 3, '10-12'),
  ]);

  const legs = day('Legs', 'Quadriceps · Posterior · Gluteos', [
    exercise('Agachamento Livre', 'quads', ['glutes'], 4, '6-10'),
    exercise('Leg Press 45', 'quads', ['glutes'], 4, '10-12'),
    exercise('Stiff com Barra', 'hamstrings', ['glutes'], 3, '8-10'),
    exercise('Mesa Flexora', 'hamstrings', [], 3, '10-12'),
    exercise('Panturrilha em Pe', 'calves', [], 4, '12-15'),
  ]);

  return [push, pull, legs];
}

function upperLowerDays() {
  return [
    day('Upper A', 'Peito · Costas · Ombros', [
      exercise('Supino Reto com Barra', 'chest', ['triceps'], 4, '6-8'),
      exercise('Remada Curvada', 'back', ['biceps'], 4, '6-8'),
      exercise('Desenvolvimento Militar', 'shoulders', ['triceps'], 3, '8-10'),
      exercise('Puxada Frente', 'back', ['biceps'], 3, '10-12'),
    ]),
    day('Lower A', 'Quadriceps · Posterior', [
      exercise('Agachamento Livre', 'quads', ['glutes'], 4, '6-8'),
      exercise('Stiff', 'hamstrings', ['glutes'], 4, '8-10'),
      exercise('Cadeira Extensora', 'quads', [], 3, '12-15'),
      exercise('Panturrilha Sentado', 'calves', [], 4, '12-15'),
    ]),
    day('Upper B', 'Volume de superiores', [
      exercise('Supino Inclinado com Halteres', 'chest', ['triceps'], 3, '8-10'),
      exercise('Remada Baixa', 'back', ['biceps'], 3, '10-12'),
      exercise('Elevacao Lateral', 'shoulders', [], 4, '12-15'),
      exercise('Rosca Alternada', 'biceps', [], 3, '10-12'),
      exercise('Triceps Testa', 'triceps', [], 3, '10-12'),
    ]),
    day('Lower B', 'Gluteos · Posterior · Core', [
      exercise('Levantamento Terra', 'hamstrings', ['glutes', 'back'], 3, '5-6', 'advanced'),
      exercise('Bulgarian Split Squat', 'quads', ['glutes'], 3, '8-10'),
      exercise('Hip Thrust', 'glutes', ['hamstrings'], 4, '8-12'),
      exercise('Abdominal na Polia', 'abs', [], 3, '12-15'),
    ]),
  ];
}

function fullBodyDays() {
  return [
    day('Full Body A', 'Base tecnica', [
      exercise('Agachamento Goblet', 'quads', ['glutes'], 3, '10-12', 'beginner'),
      exercise('Supino com Halteres', 'chest', ['triceps'], 3, '10-12', 'beginner'),
      exercise('Puxada Frente', 'back', ['biceps'], 3, '10-12', 'beginner'),
      exercise('Prancha', 'abs', [], 3, '30-45s', 'beginner'),
    ]),
    day('Full Body B', 'Forca e controle', [
      exercise('Leg Press', 'quads', ['glutes'], 3, '10-12'),
      exercise('Remada Baixa', 'back', ['biceps'], 3, '10-12'),
      exercise('Desenvolvimento com Halteres', 'shoulders', ['triceps'], 3, '10-12'),
      exercise('Rosca Direta', 'biceps', [], 2, '12-15'),
    ]),
    day('Full Body C', 'Volume moderado', [
      exercise('Stiff com Halteres', 'hamstrings', ['glutes'], 3, '10-12'),
      exercise('Flexao de Bracos', 'chest', ['triceps'], 3, 'AMRAP', 'beginner'),
      exercise('Pulldown Neutro', 'back', ['biceps'], 3, '10-12'),
      exercise('Panturrilha em Pe', 'calves', [], 3, '12-15'),
    ]),
  ];
}

function abcDays() {
  return [
    day('A', 'Peito · Ombros · Triceps', [
      exercise('Supino Reto', 'chest', ['triceps'], 4, '8-10'),
      exercise('Crucifixo Inclinado', 'chest', [], 3, '10-12'),
      exercise('Desenvolvimento', 'shoulders', ['triceps'], 3, '8-10'),
      exercise('Triceps Polia', 'triceps', [], 3, '12-15'),
    ]),
    day('B', 'Costas · Biceps', [
      exercise('Barra Fixa', 'back', ['biceps'], 4, '6-10', 'advanced'),
      exercise('Remada Unilateral', 'back', ['biceps'], 3, '10-12'),
      exercise('Pullover', 'back', [], 3, '12-15'),
      exercise('Rosca Scott', 'biceps', [], 3, '10-12'),
    ]),
    day('C', 'Pernas completas', [
      exercise('Agachamento Livre', 'quads', ['glutes'], 4, '6-10'),
      exercise('Hack Squat', 'quads', ['glutes'], 3, '10-12'),
      exercise('Mesa Flexora', 'hamstrings', [], 3, '10-12'),
      exercise('Panturrilha Leg Press', 'calves', [], 4, '12-15'),
    ]),
  ];
}

function scheduleFor(workoutDays: WorkoutDay[], mode: 'three' | 'four' | 'six') {
  if (mode === 'six') {
    return {
      monday: { workoutDayId: workoutDays[0]?.id ?? null, mode: 'rest' },
      tuesday: { workoutDayId: workoutDays[1]?.id ?? null, mode: 'rest' },
      wednesday: { workoutDayId: workoutDays[2]?.id ?? null, mode: 'rest' },
      thursday: { workoutDayId: workoutDays[0]?.id ?? null, mode: 'rest' },
      friday: { workoutDayId: workoutDays[1]?.id ?? null, mode: 'rest' },
      saturday: { workoutDayId: workoutDays[2]?.id ?? null, mode: 'rest' },
      sunday: { workoutDayId: null, mode: 'rest' },
    } satisfies WeeklySchedule;
  }

  if (mode === 'four') {
    return {
      monday: { workoutDayId: workoutDays[0]?.id ?? null, mode: 'rest' },
      tuesday: { workoutDayId: workoutDays[1]?.id ?? null, mode: 'rest' },
      wednesday: { workoutDayId: null, mode: 'cardio' },
      thursday: { workoutDayId: workoutDays[2]?.id ?? null, mode: 'rest' },
      friday: { workoutDayId: workoutDays[3]?.id ?? null, mode: 'rest' },
      saturday: { workoutDayId: null, mode: 'cardio' },
      sunday: { workoutDayId: null, mode: 'rest' },
    } satisfies WeeklySchedule;
  }

  return createDefaultWeeklySchedule(workoutDays);
}

function template(id: string, name: string, emoji: string, days: string, description: string, workoutDays: WorkoutDay[], mode: 'three' | 'four' | 'six'): TrainingTemplate {
  return {
    id,
    name,
    emoji,
    days,
    description,
    workoutDays,
    weeklySchedule: scheduleFor(workoutDays, mode),
  };
}

export const trainingTemplates: TrainingTemplate[] = [
  template('ppl_3x', 'Push Pull Legs 3x', '🔁', '3 dias', 'Classico hipertrofia', pplDays(), 'three'),
  template('ppl_6x', 'Push Pull Legs 6x', '💪', '6 dias', 'Volume alto', pplDays(), 'six'),
  template('upper_lower_4x', 'Upper / Lower 4x', '⚡', '4 dias', 'Forca + hipertrofia', upperLowerDays(), 'four'),
  template('full_body_3x', 'Full Body 3x', '🏋️', '3 dias', 'Iniciantes · funcional', fullBodyDays(), 'three'),
  template('abc_3x', 'ABC 3x', '🅰️', '3 dias', 'Classico brasileiro', abcDays(), 'three'),
];

export function cloneWorkoutDays(workoutDays: WorkoutDay[]) {
  const dayIdMap = new Map<string, string>();
  const cloned = workoutDays.map((workoutDay) => {
    const nextDayId = createId('day');
    dayIdMap.set(workoutDay.id, nextDayId);

    return {
      ...workoutDay,
      id: nextDayId,
      exercises: workoutDay.exercises.map((item) => ({
        ...item,
        id: createId('exercise'),
        sets: item.sets.map((set) => ({ ...set, id: createId('set') })),
      })),
    };
  });

  return { workoutDays: cloned, dayIdMap };
}

export function buildTrainingPlanFromTemplate(student: Student, templateItem: TrainingTemplate): StudentTrainingPlan {
  const { workoutDays, dayIdMap } = cloneWorkoutDays(templateItem.workoutDays);
  const weeklySchedule = Object.fromEntries(
    weekdayOrder.map((weekday) => {
      const schedule = templateItem.weeklySchedule[weekday];
      return [
        weekday,
        {
          mode: schedule.mode,
          workoutDayId: schedule.workoutDayId ? dayIdMap.get(schedule.workoutDayId) ?? null : null,
        },
      ];
    }),
  ) as WeeklySchedule;

  return {
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    workoutDays,
    baseWorkoutDays: [],
    weeklySchedule,
    cardioConfig: defaultCardioConfig,
  };
}

export function buildDefaultTrainingPlan(student: Student) {
  return buildTrainingPlanFromTemplate(student, trainingTemplates[0]);
}

export function createBlankWorkoutDay() {
  return day('Novo treino', 'Defina grupos e foco', []);
}

export function createExerciseFromForm(name: string, setCount: number, reps: string, primaryMuscle: MuscleGroup) {
  return exercise(name.trim(), primaryMuscle, [], Math.max(1, setCount), reps.trim() || '10-12');
}

export function calculateVolumeByMuscle(workoutDays: WorkoutDay[]) {
  const volume = Object.fromEntries(muscleOptions.map((option) => [option.value, 0])) as Record<MuscleGroup, number>;

  for (const workoutDay of workoutDays) {
    for (const item of workoutDay.exercises) {
      const validSets = item.sets.filter((set) => {
        const type = set.setType ?? 'working';
        const percent = Number(set.loadPercent.replace(',', '.'));
        const countsByType = type !== 'warmup' && type !== 'preparatory';
        return countsByType && (!set.loadPercent.trim() || (Number.isFinite(percent) && percent >= 80));
      }).length;

      volume[item.primaryMuscle] += validSets;

      for (const secondary of item.secondaryMuscles) {
        volume[secondary] += validSets * 0.5;
      }
    }
  }

  return volume;
}

export function getVolumeStatus(value: number, target: { min: number; max: number }) {
  if (value < target.min) {
    return { label: 'Abaixo do minimo', color: '#F87171' };
  }

  if (value < Math.ceil(target.min * 1.12)) {
    return { label: 'Minimo efetivo', color: '#FBBF24' };
  }

  if (value <= target.max) {
    return { label: 'Volume ideal', color: '#34D399' };
  }

  return { label: 'Alto volume', color: '#A78BFA' };
}

export const exerciseAlternatives: Record<MuscleGroup, Array<Omit<WorkoutExercise, 'id' | 'sets'>>> = {
  chest: [
    { name: 'Supino Reto com Halteres', primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], difficulty: 'intermediate' },
    { name: 'Flexao de Bracos', primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], difficulty: 'beginner' },
    { name: 'Supino Inclinado com Barra', primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], difficulty: 'intermediate' },
    { name: 'Supino com Smith Machine', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], difficulty: 'beginner' },
  ],
  back: [
    { name: 'Remada Maquina', primaryMuscle: 'back', secondaryMuscles: ['biceps'], difficulty: 'beginner' },
    { name: 'Remada Unilateral', primaryMuscle: 'back', secondaryMuscles: ['biceps'], difficulty: 'intermediate' },
    { name: 'Puxada Neutra', primaryMuscle: 'back', secondaryMuscles: ['biceps'], difficulty: 'intermediate' },
    { name: 'Barra Fixa Assistida', primaryMuscle: 'back', secondaryMuscles: ['biceps'], difficulty: 'beginner' },
  ],
  shoulders: [
    { name: 'Desenvolvimento Maquina', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], difficulty: 'beginner' },
    { name: 'Elevacao Lateral no Cabo', primaryMuscle: 'shoulders', secondaryMuscles: [], difficulty: 'intermediate' },
    { name: 'Arnold Press', primaryMuscle: 'shoulders', secondaryMuscles: ['triceps'], difficulty: 'advanced' },
  ],
  biceps: [
    { name: 'Rosca Alternada', primaryMuscle: 'biceps', secondaryMuscles: [], difficulty: 'beginner' },
    { name: 'Rosca Scott', primaryMuscle: 'biceps', secondaryMuscles: [], difficulty: 'intermediate' },
    { name: 'Rosca Martelo', primaryMuscle: 'biceps', secondaryMuscles: [], difficulty: 'intermediate' },
  ],
  triceps: [
    { name: 'Triceps Polia', primaryMuscle: 'triceps', secondaryMuscles: [], difficulty: 'beginner' },
    { name: 'Triceps Frances', primaryMuscle: 'triceps', secondaryMuscles: [], difficulty: 'intermediate' },
    { name: 'Mergulho no Banco', primaryMuscle: 'triceps', secondaryMuscles: ['chest'], difficulty: 'beginner' },
  ],
  quads: [
    { name: 'Hack Squat', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], difficulty: 'intermediate' },
    { name: 'Leg Press', primaryMuscle: 'quads', secondaryMuscles: ['glutes'], difficulty: 'beginner' },
    { name: 'Cadeira Extensora', primaryMuscle: 'quads', secondaryMuscles: [], difficulty: 'beginner' },
  ],
  hamstrings: [
    { name: 'Stiff com Halteres', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes'], difficulty: 'beginner' },
    { name: 'Mesa Flexora', primaryMuscle: 'hamstrings', secondaryMuscles: [], difficulty: 'beginner' },
    { name: 'Good Morning', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes'], difficulty: 'advanced' },
  ],
  glutes: [
    { name: 'Hip Thrust', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'], difficulty: 'intermediate' },
    { name: 'Afundo', primaryMuscle: 'glutes', secondaryMuscles: ['quads'], difficulty: 'intermediate' },
    { name: 'Cadeira Abdutora', primaryMuscle: 'glutes', secondaryMuscles: [], difficulty: 'beginner' },
  ],
  calves: [
    { name: 'Panturrilha Sentado', primaryMuscle: 'calves', secondaryMuscles: [], difficulty: 'beginner' },
    { name: 'Panturrilha Leg Press', primaryMuscle: 'calves', secondaryMuscles: [], difficulty: 'beginner' },
  ],
  abs: [
    { name: 'Abdominal na Polia', primaryMuscle: 'abs', secondaryMuscles: [], difficulty: 'intermediate' },
    { name: 'Prancha', primaryMuscle: 'abs', secondaryMuscles: [], difficulty: 'beginner' },
    { name: 'Elevar Pernas', primaryMuscle: 'abs', secondaryMuscles: [], difficulty: 'intermediate' },
  ],
};

function normalizeSetType(value: unknown): WorkoutSetType {
  return typeof value === 'string' && validSetTypes.has(value as WorkoutSetType) ? (value as WorkoutSetType) : 'working';
}

function normalizeWorkoutDays(value: unknown): WorkoutDay[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as WorkoutDay[]).map((workoutDay) => ({
    ...workoutDay,
    exercises: (workoutDay.exercises ?? []).map((exerciseItem) => ({
      ...exerciseItem,
      sets: (exerciseItem.sets ?? []).map((setItem) => ({
        ...setItem,
        setType: normalizeSetType(setItem.setType),
      })),
    })),
  }));
}

function normalizeWeeklySchedule(value: unknown, workoutDays: WorkoutDay[]): WeeklySchedule {
  const fallback = createDefaultWeeklySchedule(workoutDays);

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const schedule = value as Partial<WeeklySchedule>;

  return Object.fromEntries(
    weekdayOrder.map((weekday) => [
      weekday,
      {
        workoutDayId: schedule[weekday]?.workoutDayId ?? fallback[weekday].workoutDayId,
        mode: schedule[weekday]?.mode ?? fallback[weekday].mode,
      },
    ]),
  ) as WeeklySchedule;
}

function normalizeCardioConfig(value: unknown): CardioConfig {
  if (!value || typeof value !== 'object') {
    return defaultCardioConfig;
  }

  const config = value as Partial<CardioConfig>;

  return {
    weeklyMinutes: String(config.weeklyMinutes ?? defaultCardioConfig.weeklyMinutes),
    intensity: config.intensity ?? defaultCardioConfig.intensity,
    notes: config.notes ?? '',
  };
}

function mapTrainingRow(row: any, student: Student): StudentTrainingPlan {
  const workoutDays = normalizeWorkoutDays(row.workout_days);

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    workoutDays,
    baseWorkoutDays: normalizeWorkoutDays(row.base_workout_days),
    weeklySchedule: normalizeWeeklySchedule(row.weekly_schedule, workoutDays),
    cardioConfig: normalizeCardioConfig(row.cardio_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchStudentTrainingPlan(student: Student) {
  if (student.id.startsWith('local-student-')) {
    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-training-plan:${student.id}`);
      return raw ? JSON.parse(raw) as StudentTrainingPlan : null;
    } catch (e) {
      console.warn('Failed to load local training plan', e);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('student_training_plans')
    .select('id, student_id, trainer_id, consultancy_id, workout_days, base_workout_days, weekly_schedule, cardio_config, created_at, updated_at')
    .eq('student_id', student.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapTrainingRow(data, student) : null;
}

export async function saveStudentTrainingPlan(student: Student, plan: StudentTrainingPlan) {
  if (student.id.startsWith('local-student-')) {
    try {
      const planWithIds = {
        ...plan,
        id: plan.id || `local-plan-${student.id}`,
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`@consultoria:local-training-plan:${student.id}`, JSON.stringify(planWithIds));
      return planWithIds;
    } catch (e) {
      console.warn('Failed to save local training plan', e);
      return plan;
    }
  }

  const payload = {
    student_id: student.id,
    trainer_id: student.trainer_id,
    consultancy_id: student.consultancy_id,
    workout_days: plan.workoutDays,
    base_workout_days: plan.baseWorkoutDays,
    weekly_schedule: plan.weeklySchedule,
    cardio_config: plan.cardioConfig,
  };

  const { data, error } = await supabase
    .from('student_training_plans')
    .upsert(payload, { onConflict: 'student_id' })
    .select('id, student_id, trainer_id, consultancy_id, workout_days, base_workout_days, weekly_schedule, cardio_config, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapTrainingRow(data, student);
}

export function replaceExerciseWithAlternative(exerciseItem: WorkoutExercise, alternative: Omit<WorkoutExercise, 'id' | 'sets'>) {
  return {
    ...exerciseItem,
    name: alternative.name,
    primaryMuscle: alternative.primaryMuscle,
    secondaryMuscles: alternative.secondaryMuscles,
    difficulty: alternative.difficulty,
  };
}
