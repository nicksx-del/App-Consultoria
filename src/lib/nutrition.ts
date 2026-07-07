import { supabase } from './supabase';
import { activityMultipliers } from './studentCalculations';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Student, StudentGoal } from '../types/student';
import type {
  MacroTotals,
  MealFood,
  NutritionAdherence,
  NutritionConfig,
  NutritionFormula,
  NutritionMeal,
  NutritionPhase,
  NutritionSex,
  NutritionWeekday,
  StudentNutritionPlan,
} from '../types/nutrition';

export const nutritionWeekdayLabels: Record<NutritionWeekday, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const nutritionWeekdayShortLabels: Record<NutritionWeekday, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export const nutritionWeekdayOrder: NutritionWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const formulaLabels: Record<NutritionFormula, { title: string; description: string }> = {
  harris_benedict: {
    title: 'Harris-Benedict',
    description: 'Boa base para iniciar com segurança.',
  },
  mifflin_st_jeor: {
    title: 'Mifflin-St Jeor',
    description: 'Estimativa moderna e conservadora.',
  },
  tinsley_mlm: {
    title: 'Tinsley / massa magra',
    description: 'Usa percentual de gordura quando informado.',
  },
};

export const activityFactorOptions = [
  { value: '1.2', label: 'Sedentário', helper: 'Rotina muito parada' },
  { value: '1.3', label: 'Leve+', helper: 'Poucos passos' },
  { value: '1.375', label: 'Leve', helper: 'Treina 2-3x/sem' },
  { value: '1.55', label: 'Moderado', helper: 'Treina 3-5x/sem' },
  { value: '1.65', label: 'Ativo', helper: 'Treino + passos' },
  { value: '1.725', label: 'Muito ativo', helper: 'Alta rotina' },
  { value: '1.9', label: 'Extremo', helper: 'Atleta/rotina pesada' },
];

export const adherenceOptions: Record<NutritionAdherence, { title: string; description: string; calorieDelta: number }> = {
  steady: {
    title: 'Constante ao processo',
    description: 'Ajuste mais estável, ideal para aderência.',
    calorieDelta: 0,
  },
  driven: {
    title: 'Result driven',
    description: 'Ajuste mais agressivo quando o prazo pede.',
    calorieDelta: -180,
  },
};

const emptyTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

type MacroRules = {
  proteinPerKg?: number;
  fatPerKg?: number;
};

function createNutritionId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseNutritionNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value);
}

function roundMacro(value: number) {
  return Math.max(0, Math.round(value));
}

function safeNumber(value: string | number | null | undefined, fallback = 0) {
  return parseNutritionNumber(value) ?? fallback;
}

function goalAdjustment(goal: StudentGoal, adherence: NutritionAdherence) {
  const base: Record<StudentGoal, number> = {
    hypertrophy: 260,
    fat_loss: -420,
    recomposition: -160,
    health: 0,
    performance: 220,
  };

  const adjustment = base[goal] + adherenceOptions[adherence].calorieDelta;
  return goal === 'hypertrophy' || goal === 'performance' ? base[goal] : adjustment;
}

function defaultProteinPerKg(goal: StudentGoal) {
  return goal === 'fat_loss' || goal === 'recomposition' ? 2.1 : 2;
}

function defaultFatPerKg(goal: StudentGoal) {
  return goal === 'fat_loss' ? 0.7 : 0.8;
}

function protocolNameForGoal(goal: StudentGoal) {
  const names: Record<StudentGoal, string> = {
    hypertrophy: 'Bulking controlado',
    fat_loss: 'Cutting',
    recomposition: 'Recomposição',
    health: 'Manutenção saudável',
    performance: 'Performance',
  };

  return names[goal];
}

function defaultSex(sex: Student['sex']): NutritionSex {
  return sex === 'female' ? 'female' : 'male';
}

export function calculateBmi(weightKg: string | number | null | undefined, heightCm: string | number | null | undefined) {
  const weight = parseNutritionNumber(weightKg);
  const height = parseNutritionNumber(heightCm);

  if (!weight || !height) {
    return null;
  }

  const meters = height / 100;
  return Math.round((weight / (meters * meters)) * 10) / 10;
}

export function calculateBmr(config: NutritionConfig) {
  const weight = parseNutritionNumber(config.weightKg);
  const height = parseNutritionNumber(config.heightCm);
  const age = parseNutritionNumber(config.age);

  if (!weight || !height || !age) {
    return null;
  }

  if (config.formula === 'harris_benedict') {
    if (config.sex === 'female') {
      return round(447.593 + 9.247 * weight + 3.098 * height - 4.33 * age);
    }

    return round(88.362 + 13.397 * weight + 4.799 * height - 5.677 * age);
  }

  if (config.formula === 'tinsley_mlm') {
    const bodyFat = parseNutritionNumber(config.bodyFat);

    if (!bodyFat) {
      return null;
    }

    const leanMass = weight * (1 - bodyFat / 100);
    return round(284 + 25.9 * leanMass);
  }

  return round(10 * weight + 6.25 * height - 5 * age + (config.sex === 'female' ? -161 : 5));
}

export function calculateTdee(config: NutritionConfig) {
  const bmr = calculateBmr(config);
  const factor = parseNutritionNumber(config.activityFactor);

  if (!bmr || !factor) {
    return null;
  }

  return round(bmr * factor);
}

export function calculateTargetCalories(config: NutritionConfig, goal: StudentGoal) {
  const manualCalories = parseNutritionNumber(config.targetCalories);

  if (manualCalories) {
    return Math.max(1000, round(manualCalories));
  }

  const tdee = calculateTdee(config);

  if (!tdee) {
    return null;
  }

  const adjustment = parseNutritionNumber(config.calorieAdjustment) ?? goalAdjustment(goal, config.adherence);
  return Math.max(1000, round(tdee + adjustment));
}

function macroRulesFromConfig(config: NutritionConfig, goal: StudentGoal): { proteinPerKg: number; fatPerKg: number } {
  return {
    proteinPerKg: parseNutritionNumber(config.proteinPerKg) ?? defaultProteinPerKg(goal),
    fatPerKg: parseNutritionNumber(config.fatPerKg) ?? defaultFatPerKg(goal),
  };
}

function buildMacroSet(
  calories: number,
  weightKg: number,
  style: 'low_fat' | 'balanced' | 'low_carb' | 'cycle',
  rules?: MacroRules,
) {
  const fallbackProteinFactor = style === 'low_carb' ? 2.2 : 2;
  const fallbackFatPercent = style === 'low_fat' ? 0.16 : style === 'low_carb' ? 0.3 : 0.22;
  const proteinFactor = rules?.proteinPerKg ?? fallbackProteinFactor;
  const protein = roundMacro(weightKg * proteinFactor);
  const fat = rules?.fatPerKg ? roundMacro(weightKg * rules.fatPerKg) : roundMacro((calories * fallbackFatPercent) / 9);
  const carbs = roundMacro((calories - protein * 4 - fat * 9) / 4);

  return { protein, carbs, fat };
}

export function calculateCoachMacroTargets(config: NutritionConfig, goal: StudentGoal): (MacroTotals & {
  adjustment: number;
  proteinPerKg: number;
  fatPerKg: number;
  weightKg: number;
  macroCalories: number;
  difference: number;
}) | null {
  const targetCalories = calculateTargetCalories(config, goal);
  const tdee = calculateTdee(config);
  const weightKg = parseNutritionNumber(config.weightKg);

  if (!targetCalories || !weightKg) {
    return null;
  }

  const rules = macroRulesFromConfig(config, goal);
  const protein = roundMacro(weightKg * rules.proteinPerKg);
  const fat = roundMacro(weightKg * rules.fatPerKg);
  const carbs = roundMacro((targetCalories - protein * 4 - fat * 9) / 4);
  const macroCalories = macroCaloriesFromValues({ protein, carbs, fat });
  const adjustment = parseNutritionNumber(config.targetCalories)
    ? targetCalories - (tdee ?? targetCalories)
    : parseNutritionNumber(config.calorieAdjustment) ?? goalAdjustment(goal, config.adherence);

  return {
    calories: targetCalories,
    protein,
    carbs,
    fat,
    adjustment: round(adjustment),
    proteinPerKg: rules.proteinPerKg,
    fatPerKg: rules.fatPerKg,
    weightKg,
    macroCalories,
    difference: macroCalories - targetCalories,
  };
}

function macroCaloriesFromValues(totals: Pick<MacroTotals, 'protein' | 'carbs' | 'fat'>) {
  return totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
}

export function buildNutritionPhases(baseCalories: number, weightKg: number, goal: StudentGoal, rules?: MacroRules): NutritionPhase[] {
  const isBulk = goal === 'hypertrophy' || goal === 'performance';
  const base = Math.max(1200, round(baseCalories));
  const phaseBlueprint = isBulk
    ? [
        { name: 'Base limpa', subtitle: 'Superávit leve para iniciar', delta: 0, style: 'balanced' as const, cardio: 15 },
        { name: 'Bulking controlado', subtitle: 'Mais carboidrato nos treinos', delta: 120, style: 'balanced' as const, cardio: 15 },
        { name: 'Performance', subtitle: 'Alta disponibilidade energética', delta: 220, style: 'cycle' as const, cardio: 10 },
        { name: 'Consolidação', subtitle: 'Segura peso e força', delta: 120, style: 'balanced' as const, cardio: 20 },
        { name: 'Mini cut técnico', subtitle: 'Reduz gordura sem matar treino', delta: -180, style: 'low_fat' as const, cardio: 25 },
        { name: 'Retorno progressivo', subtitle: 'Sobe calorias com controle', delta: 80, style: 'cycle' as const, cardio: 20 },
      ]
    : [
        { name: 'Low Fat', subtitle: 'Déficit inicial com boa aderência', delta: 0, style: 'low_fat' as const, cardio: 20 },
        { name: 'QPC', subtitle: 'Queda progressiva controlada', delta: -140, style: 'balanced' as const, cardio: 25 },
        { name: 'QPC avançado', subtitle: 'Mais precisão em carboidratos', delta: -240, style: 'balanced' as const, cardio: 30 },
        { name: 'Low Carb', subtitle: 'Reduz carbo em dias estratégicos', delta: -340, style: 'low_carb' as const, cardio: 35 },
        { name: 'Carb Cycling', subtitle: 'Distribuição semanal variável', delta: -140, style: 'cycle' as const, cardio: 30 },
        { name: 'Ciclo intenso', subtitle: 'Fase final mais agressiva', delta: -280, style: 'cycle' as const, cardio: 40 },
      ];

  return phaseBlueprint.map((phase, index) => {
    const calories = Math.max(1200, round(base + phase.delta));
    const macros = buildMacroSet(calories, weightKg, phase.style, rules);

    return {
      id: createNutritionId('phase'),
      month: index + 1,
      name: phase.name,
      subtitle: phase.subtitle,
      calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      cardioMinutes: phase.cardio,
      notes: index === 0 ? 'Fase atual. Ajuste conforme check-ins e aderência.' : '',
    };
  });
}

export function buildDefaultNutritionPlan(student: Student): StudentNutritionPlan {
  const defaultAdjustment = goalAdjustment(student.goal, 'steady');
  const proteinPerKg = defaultProteinPerKg(student.goal);
  const fatPerKg = defaultFatPerKg(student.goal);
  const config: NutritionConfig = {
    sex: defaultSex(student.sex),
    weightKg: student.weight_kg ? String(student.weight_kg) : '',
    heightCm: student.height_cm ? String(student.height_cm) : '',
    age: student.age ? String(student.age) : '',
    bodyFat: '',
    formula: 'harris_benedict',
    activityFactor: String(activityMultipliers[student.activity_level] ?? 1.55),
    adherence: 'steady',
    targetCalories: '',
    calorieAdjustment: String(defaultAdjustment),
    proteinPerKg: String(proteinPerKg),
    fatPerKg: String(fatPerKg),
    carbCycle: student.goal === 'fat_loss',
    protocolName: protocolNameForGoal(student.goal),
    coachNotes: '',
  };

  const weight = parseNutritionNumber(config.weightKg) ?? 70;
  const targetCalories = calculateTargetCalories(config, student.goal) ?? 2200;

  return {
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    config,
    phases: buildNutritionPhases(targetCalories, weight, student.goal, { proteinPerKg, fatPerKg }),
    meals: [],
  };
}

export function createEmptyFood(): MealFood {
  return {
    id: createNutritionId('food'),
    name: '',
    quantity: '',
    unit: 'g',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  };
}

export function createEmptyMeal(weekday: NutritionWeekday, name: string): NutritionMeal {
  return {
    id: createNutritionId('meal'),
    weekday,
    name: name.trim() || 'Nova refeição',
    foods: [],
    notes: '',
  };
}

export function calculateFoodTotals(food: MealFood): MacroTotals {
  return {
    calories: safeNumber(food.calories),
    protein: safeNumber(food.protein),
    carbs: safeNumber(food.carbs),
    fat: safeNumber(food.fat),
  };
}

export function sumMacroTotals(items: MacroTotals[]): MacroTotals {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    { ...emptyTotals },
  );
}

export function calculateMealTotals(meal: NutritionMeal) {
  return sumMacroTotals(meal.foods.map(calculateFoodTotals));
}

export function calculateDayTotals(plan: StudentNutritionPlan, weekday: NutritionWeekday) {
  return sumMacroTotals(plan.meals.filter((meal) => meal.weekday === weekday).map(calculateMealTotals));
}

export function calculateWeeklyTotals(plan: StudentNutritionPlan) {
  return sumMacroTotals(nutritionWeekdayOrder.map((weekday) => calculateDayTotals(plan, weekday)));
}

export function getActivePhase(plan: StudentNutritionPlan) {
  return plan.phases[0] ?? null;
}

function normalizeConfig(value: unknown, student: Student): NutritionConfig {
  const fallback = buildDefaultNutritionPlan(student).config;

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const config = value as Partial<NutritionConfig>;

  return {
    ...fallback,
    ...config,
    sex: config.sex === 'female' ? 'female' : 'male',
    formula: config.formula ?? fallback.formula,
    adherence: config.adherence ?? fallback.adherence,
    targetCalories: String(config.targetCalories ?? fallback.targetCalories),
    calorieAdjustment: String(config.calorieAdjustment ?? fallback.calorieAdjustment),
    proteinPerKg: String(config.proteinPerKg ?? fallback.proteinPerKg),
    fatPerKg: String(config.fatPerKg ?? fallback.fatPerKg),
    carbCycle: Boolean(config.carbCycle),
  };
}

function normalizePhases(value: unknown, student: Student, config: NutritionConfig): NutritionPhase[] {
  if (Array.isArray(value) && value.length) {
    return value as NutritionPhase[];
  }

  const weight = parseNutritionNumber(config.weightKg) ?? student.weight_kg ?? 70;
  const calories = calculateTargetCalories(config, student.goal) ?? 2200;
  return buildNutritionPhases(calories, weight, student.goal, macroRulesFromConfig(config, student.goal));
}

function normalizeMeals(value: unknown): NutritionMeal[] {
  return Array.isArray(value) ? (value as NutritionMeal[]) : [];
}

function mapNutritionRow(row: any, student: Student): StudentNutritionPlan {
  const config = normalizeConfig(row.config, student);

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    config,
    phases: normalizePhases(row.phases, student, config),
    meals: normalizeMeals(row.meals),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchStudentNutritionPlan(student: Student) {
  if (student.id.startsWith('local-student-')) {
    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-nutrition-plan:${student.id}`);
      return raw ? JSON.parse(raw) as StudentNutritionPlan : null;
    } catch (e) {
      console.warn('Failed to load local nutrition plan', e);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('student_nutrition_plans')
    .select('id, student_id, trainer_id, consultancy_id, config, phases, meals, created_at, updated_at')
    .eq('student_id', student.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapNutritionRow(data, student) : null;
}

export async function saveStudentNutritionPlan(student: Student, plan: StudentNutritionPlan) {
  if (student.id.startsWith('local-student-')) {
    try {
      const planWithIds = {
        ...plan,
        id: plan.id || `local-nutrition-plan-${student.id}`,
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`@consultoria:local-nutrition-plan:${student.id}`, JSON.stringify(planWithIds));
      return planWithIds;
    } catch (e) {
      console.warn('Failed to save local nutrition plan', e);
      return plan;
    }
  }

  const payload = {
    student_id: student.id,
    trainer_id: student.trainer_id,
    consultancy_id: student.consultancy_id,
    config: plan.config,
    phases: plan.phases,
    meals: plan.meals,
  };

  const { data, error } = await supabase
    .from('student_nutrition_plans')
    .upsert(payload, { onConflict: 'student_id' })
    .select('id, student_id, trainer_id, consultancy_id, config, phases, meals, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapNutritionRow(data, student);
}

export function rebuildPhasesFromConfig(plan: StudentNutritionPlan, goal: StudentGoal) {
  const weight = parseNutritionNumber(plan.config.weightKg) ?? 70;
  const calories = calculateTargetCalories(plan.config, goal) ?? 2200;

  return {
    ...plan,
    phases: buildNutritionPhases(calories, weight, goal, macroRulesFromConfig(plan.config, goal)),
  };
}
