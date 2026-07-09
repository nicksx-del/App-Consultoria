import { supabase } from './supabase';
import { activityMultipliers } from './studentCalculations';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Student, StudentGoal } from '../types/student';
import type {
  ConsumedMealFood,
  MacroTotals,
  MealFood,
  MealFoodSubstitution,
  NutritionAdherence,
  NutritionConfig,
  NutritionFormula,
  NutritionFoodCategory,
  NutritionFoodMeasureMode,
  NutritionLibraryItem,
  NutritionLibraryMacroValues,
  NutritionLibrarySource,
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

export const nutritionFoodCategoryLabels: Record<NutritionFoodCategory, string> = {
  protein: 'Proteina',
  carb: 'Carboidrato',
  fat: 'Gordura',
  fruit: 'Fruta',
  vegetable: 'Vegetal',
  dairy: 'Laticinio',
  drink: 'Bebida',
  supplement: 'Suplemento',
  snack: 'Lanche',
  other: 'Outro',
};

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

const LOCAL_FOOD_LIBRARY_PREFIX = '@consultoria:nutrition-library:';

const defaultLibraryMacroValues = (): NutritionLibraryMacroValues => ({
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
});

type MacroRules = {
  proteinPerKg?: number;
  fatPerKg?: number;
};

function createNutritionId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createLibraryKey(consultancyId: string, trainerId: string) {
  return `${LOCAL_FOOD_LIBRARY_PREFIX}${consultancyId}:${trainerId}`;
}

function createLibraryItemSeed(
  trainerId: string,
  consultancyId: string,
  category: NutritionFoodCategory,
  name: string,
  measureMode: NutritionFoodMeasureMode,
  portionQuantity: string,
  portionUnit: string,
  portionValues: NutritionLibraryMacroValues,
  per100gValues?: Partial<NutritionLibraryMacroValues>,
  source: NutritionLibrarySource = 'seed',
  externalId: string | null = null,
): NutritionLibraryItem {
  return {
    id: createNutritionId('library_food'),
    trainerId,
    consultancyId,
    name,
    category,
    measureMode,
    portionQuantity,
    portionUnit,
    portionValues,
    per100gValues: {
      ...defaultLibraryMacroValues(),
      ...per100gValues,
    },
    active: true,
    notes: '',
    source,
    externalId,
  };
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

function parseLibraryMacroValues(value: Partial<NutritionLibraryMacroValues> | null | undefined): MacroTotals {
  return {
    calories: parseNutritionNumber(value?.calories) ?? 0,
    protein: parseNutritionNumber(value?.protein) ?? 0,
    carbs: parseNutritionNumber(value?.carbs) ?? 0,
    fat: parseNutritionNumber(value?.fat) ?? 0,
  };
}

function normalizeLibraryMacroValues(value: unknown): NutritionLibraryMacroValues {
  if (!value || typeof value !== 'object') {
    return defaultLibraryMacroValues();
  }

  const current = value as Partial<NutritionLibraryMacroValues>;

  return {
    calories: String(current.calories ?? ''),
    protein: String(current.protein ?? ''),
    carbs: String(current.carbs ?? ''),
    fat: String(current.fat ?? ''),
  };
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

function roundQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function normalizeFood(food: MealFood): MealFood {
  return {
    ...food,
    libraryItemId: food.libraryItemId ?? null,
    category: food.category ?? null,
    substitutionLocked: Boolean(food.substitutionLocked),
  };
}

function normalizeLibraryItem(value: unknown, trainerId: string, consultancyId: string): NutritionLibraryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<NutritionLibraryItem>;

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createNutritionId('library_food'),
    trainerId: typeof item.trainerId === 'string' && item.trainerId ? item.trainerId : trainerId,
    consultancyId:
      typeof item.consultancyId === 'string' && item.consultancyId ? item.consultancyId : consultancyId,
    name: typeof item.name === 'string' ? item.name : '',
    category: item.category ?? 'other',
    measureMode: item.measureMode ?? 'portion',
    portionQuantity: String(item.portionQuantity ?? ''),
    portionUnit: String(item.portionUnit ?? ''),
    portionValues: normalizeLibraryMacroValues(item.portionValues),
    per100gValues: normalizeLibraryMacroValues(item.per100gValues),
    active: item.active !== false,
    notes: typeof item.notes === 'string' ? item.notes : '',
    source: item.source === 'seed' || item.source === 'usda' ? item.source : 'manual',
    externalId: typeof item.externalId === 'string' && item.externalId ? item.externalId : null,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
  };
}

function mergeLibraryMetadata(items: NutritionLibraryItem[], cachedItems: NutritionLibraryItem[]) {
  if (!cachedItems.length) {
    return items;
  }

  const cachedMap = new Map(cachedItems.map((item) => [item.id, item]));
  return items.map((item) => {
    const cached = cachedMap.get(item.id);
    if (!cached) {
      return item;
    }

    return {
      ...item,
      source: cached.source ?? item.source ?? 'manual',
      externalId: cached.externalId ?? item.externalId ?? null,
    };
  });
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

export function createEmptyLibraryItem(
  trainerId: string,
  consultancyId: string,
  category: NutritionFoodCategory = 'other',
): NutritionLibraryItem {
  return {
    id: createNutritionId('library_food'),
    trainerId,
    consultancyId,
    name: '',
    category,
    measureMode: 'portion',
    portionQuantity: '1',
    portionUnit: 'un',
    portionValues: defaultLibraryMacroValues(),
    per100gValues: defaultLibraryMacroValues(),
    active: true,
    notes: '',
    source: 'manual',
    externalId: null,
  };
}

export function buildInitialFoodLibrary(trainerId: string, consultancyId: string): NutritionLibraryItem[] {
  return [
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Peito de frango', 'both', '100', 'g', { calories: '165', protein: '31', carbs: '0', fat: '3.6' }, { calories: '165', protein: '31', carbs: '0', fat: '3.6' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Coxa de frango sem pele', 'both', '100', 'g', { calories: '177', protein: '24', carbs: '0', fat: '8' }, { calories: '177', protein: '24', carbs: '0', fat: '8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Tilapia grelhada', 'both', '100', 'g', { calories: '129', protein: '26', carbs: '0', fat: '2.7' }, { calories: '129', protein: '26', carbs: '0', fat: '2.7' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Atum em agua', 'both', '100', 'g', { calories: '116', protein: '26', carbs: '0', fat: '1' }, { calories: '116', protein: '26', carbs: '0', fat: '1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Salmao grelhado', 'both', '100', 'g', { calories: '208', protein: '20', carbs: '0', fat: '13' }, { calories: '208', protein: '20', carbs: '0', fat: '13' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Patinho moido', 'both', '100', 'g', { calories: '219', protein: '26', carbs: '0', fat: '12' }, { calories: '219', protein: '26', carbs: '0', fat: '12' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Alcatra grelhada', 'both', '100', 'g', { calories: '217', protein: '29', carbs: '0', fat: '10' }, { calories: '217', protein: '29', carbs: '0', fat: '10' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Ovo inteiro', 'portion', '1', 'un', { calories: '70', protein: '6', carbs: '0.6', fat: '5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Clara de ovo', 'portion', '1', 'un', { calories: '17', protein: '3.6', carbs: '0.2', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Queijo cottage', 'portion', '100', 'g', { calories: '98', protein: '11', carbs: '3.4', fat: '4.3' }, { calories: '98', protein: '11', carbs: '3.4', fat: '4.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'protein', 'Whey protein', 'portion', '1', 'scoop', { calories: '120', protein: '24', carbs: '3', fat: '2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Arroz branco cozido', 'both', '100', 'g', { calories: '130', protein: '2.7', carbs: '28', fat: '0.3' }, { calories: '130', protein: '2.7', carbs: '28', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Arroz integral cozido', 'both', '100', 'g', { calories: '124', protein: '2.6', carbs: '25.8', fat: '1' }, { calories: '124', protein: '2.6', carbs: '25.8', fat: '1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Feijao carioca cozido', 'both', '100', 'g', { calories: '76', protein: '4.8', carbs: '13.6', fat: '0.5' }, { calories: '76', protein: '4.8', carbs: '13.6', fat: '0.5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Feijao preto cozido', 'both', '100', 'g', { calories: '77', protein: '4.5', carbs: '14', fat: '0.5' }, { calories: '77', protein: '4.5', carbs: '14', fat: '0.5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Macarrao cozido', 'both', '100', 'g', { calories: '157', protein: '5.8', carbs: '30.9', fat: '0.9' }, { calories: '157', protein: '5.8', carbs: '30.9', fat: '0.9' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Tapioca', 'portion', '50', 'g', { calories: '168', protein: '0', carbs: '42', fat: '0' }, { calories: '336', protein: '0', carbs: '84', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Batata doce cozida', 'both', '100', 'g', { calories: '86', protein: '1.6', carbs: '20', fat: '0.1' }, { calories: '86', protein: '1.6', carbs: '20', fat: '0.1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Batata inglesa cozida', 'both', '100', 'g', { calories: '52', protein: '1.2', carbs: '12', fat: '0.1' }, { calories: '52', protein: '1.2', carbs: '12', fat: '0.1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Mandioca cozida', 'both', '100', 'g', { calories: '125', protein: '1', carbs: '30', fat: '0.3' }, { calories: '125', protein: '1', carbs: '30', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Cuscuz de milho', 'both', '100', 'g', { calories: '112', protein: '2.2', carbs: '25.3', fat: '0.7' }, { calories: '112', protein: '2.2', carbs: '25.3', fat: '0.7' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Pao frances', 'portion', '1', 'un', { calories: '140', protein: '4.5', carbs: '28', fat: '1.8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Pao de forma integral', 'portion', '2', 'fatias', { calories: '138', protein: '6', carbs: '24', fat: '2.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Torrada integral', 'portion', '4', 'un', { calories: '122', protein: '4', carbs: '21', fat: '2.4' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Aveia', 'both', '30', 'g', { calories: '114', protein: '4.2', carbs: '19.5', fat: '2.4' }, { calories: '380', protein: '14', carbs: '65', fat: '8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Granola', 'portion', '30', 'g', { calories: '134', protein: '3', carbs: '20', fat: '5' }, { calories: '447', protein: '10', carbs: '67', fat: '17' }),
    createLibraryItemSeed(trainerId, consultancyId, 'carb', 'Farinha de arroz', 'both', '30', 'g', { calories: '109', protein: '2', carbs: '24', fat: '0.3' }, { calories: '363', protein: '6.7', carbs: '80', fat: '1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Pasta de amendoim', 'portion', '15', 'g', { calories: '90', protein: '4', carbs: '3', fat: '7.5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Amendoim', 'both', '15', 'g', { calories: '85', protein: '3.8', carbs: '2.4', fat: '7.2' }, { calories: '567', protein: '25', carbs: '16', fat: '49' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Castanha de caju', 'both', '15', 'g', { calories: '82', protein: '2.7', carbs: '4.5', fat: '6.6' }, { calories: '553', protein: '18.2', carbs: '30.2', fat: '43.8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Castanha do para', 'both', '15', 'g', { calories: '99', protein: '2.1', carbs: '1.8', fat: '10' }, { calories: '659', protein: '14', carbs: '12', fat: '67' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Abacate', 'both', '100', 'g', { calories: '160', protein: '2', carbs: '9', fat: '15' }, { calories: '160', protein: '2', carbs: '9', fat: '15' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Azeite de oliva', 'portion', '1', 'colher', { calories: '119', protein: '0', carbs: '0', fat: '13.5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fat', 'Manteiga', 'portion', '10', 'g', { calories: '72', protein: '0.1', carbs: '0', fat: '8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Banana prata', 'portion', '1', 'un', { calories: '89', protein: '1.1', carbs: '23', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Maca', 'portion', '1', 'un', { calories: '95', protein: '0.5', carbs: '25', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Mamao', 'portion', '1', 'fatia', { calories: '55', protein: '0.8', carbs: '14', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Manga', 'portion', '1', 'un', { calories: '99', protein: '1.4', carbs: '25', fat: '0.6' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Morango', 'both', '100', 'g', { calories: '32', protein: '0.7', carbs: '7.7', fat: '0.3' }, { calories: '32', protein: '0.7', carbs: '7.7', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Abacaxi', 'portion', '1', 'fatia', { calories: '50', protein: '0.5', carbs: '13', fat: '0.1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'fruit', 'Uva', 'portion', '10', 'un', { calories: '69', protein: '0.7', carbs: '18', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Brocolis cozido', 'both', '100', 'g', { calories: '35', protein: '2.4', carbs: '7', fat: '0.4' }, { calories: '35', protein: '2.4', carbs: '7', fat: '0.4' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Alface', 'both', '100', 'g', { calories: '15', protein: '1.4', carbs: '2.9', fat: '0.2' }, { calories: '15', protein: '1.4', carbs: '2.9', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Tomate', 'both', '100', 'g', { calories: '18', protein: '0.9', carbs: '3.9', fat: '0.2' }, { calories: '18', protein: '0.9', carbs: '3.9', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Cenoura cozida', 'both', '100', 'g', { calories: '35', protein: '0.8', carbs: '8.2', fat: '0.2' }, { calories: '35', protein: '0.8', carbs: '8.2', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Abobrinha', 'both', '100', 'g', { calories: '17', protein: '1.2', carbs: '3.1', fat: '0.3' }, { calories: '17', protein: '1.2', carbs: '3.1', fat: '0.3' }),
    createLibraryItemSeed(trainerId, consultancyId, 'vegetable', 'Pepino', 'both', '100', 'g', { calories: '15', protein: '0.7', carbs: '3.6', fat: '0.1' }, { calories: '15', protein: '0.7', carbs: '3.6', fat: '0.1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'dairy', 'Iogurte grego zero', 'portion', '1', 'pote', { calories: '95', protein: '10', carbs: '6', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'dairy', 'Iogurte natural', 'portion', '170', 'g', { calories: '106', protein: '5.9', carbs: '8.2', fat: '5.5' }),
    createLibraryItemSeed(trainerId, consultancyId, 'dairy', 'Queijo minas frescal', 'portion', '30', 'g', { calories: '79', protein: '5.2', carbs: '1', fat: '6.1' }),
    createLibraryItemSeed(trainerId, consultancyId, 'dairy', 'Queijo muzzarella', 'portion', '30', 'g', { calories: '96', protein: '6.6', carbs: '0.7', fat: '7.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'drink', 'Leite desnatado', 'portion', '200', 'ml', { calories: '70', protein: '6.5', carbs: '10', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'drink', 'Leite integral', 'portion', '200', 'ml', { calories: '122', protein: '6.2', carbs: '9.4', fat: '6.6' }),
    createLibraryItemSeed(trainerId, consultancyId, 'drink', 'Cafe sem acucar', 'portion', '100', 'ml', { calories: '2', protein: '0.3', carbs: '0', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'drink', 'Agua de coco', 'portion', '200', 'ml', { calories: '38', protein: '1.4', carbs: '7.2', fat: '0.2' }),
    createLibraryItemSeed(trainerId, consultancyId, 'supplement', 'Creatina', 'portion', '3', 'g', { calories: '0', protein: '0', carbs: '0', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'supplement', 'Albumina', 'portion', '30', 'g', { calories: '110', protein: '24', carbs: '2', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'supplement', 'Hipercalorico', 'portion', '120', 'g', { calories: '450', protein: '20', carbs: '78', fat: '6' }),
    createLibraryItemSeed(trainerId, consultancyId, 'snack', 'Barra de proteina', 'portion', '1', 'un', { calories: '200', protein: '15', carbs: '20', fat: '7' }),
    createLibraryItemSeed(trainerId, consultancyId, 'snack', 'Biscoito de arroz', 'portion', '4', 'un', { calories: '108', protein: '2', carbs: '24', fat: '0.8' }),
    createLibraryItemSeed(trainerId, consultancyId, 'snack', 'Chocolate 70%', 'portion', '25', 'g', { calories: '150', protein: '2', carbs: '10', fat: '11' }),
    createLibraryItemSeed(trainerId, consultancyId, 'other', 'Mel', 'portion', '20', 'g', { calories: '61', protein: '0', carbs: '17', fat: '0' }),
    createLibraryItemSeed(trainerId, consultancyId, 'other', 'Geleia sem acucar', 'portion', '20', 'g', { calories: '30', protein: '0', carbs: '7', fat: '0' }),
  ];
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
    libraryItemId: null,
    category: null,
    substitutionLocked: false,
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

export function calculateFoodsTotals(foods: Array<MealFood | ConsumedMealFood>) {
  return sumMacroTotals(foods.map((food) => calculateFoodTotals(food)));
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

export function getLibraryItemBaseValues(item: NutritionLibraryItem): MacroTotals {
  if (item.measureMode === 'per_100g') {
    return parseLibraryMacroValues(item.per100gValues);
  }

  return parseLibraryMacroValues(item.portionValues);
}

export function createFoodFromLibraryItem(item: NutritionLibraryItem): MealFood {
  const values = item.measureMode === 'per_100g' ? item.per100gValues : item.portionValues;
  const quantity = item.measureMode === 'per_100g' ? '100' : item.portionQuantity || '1';
  const unit = item.measureMode === 'per_100g' ? 'g' : item.portionUnit || 'un';

  return normalizeFood({
    id: createNutritionId('food'),
    name: item.name,
    quantity,
    unit,
    calories: values.calories,
    protein: values.protein,
    carbs: values.carbs,
    fat: values.fat,
    notes: '',
    libraryItemId: item.id,
    category: item.category,
    substitutionLocked: false,
  });
}

function buildReplacementScale(original: MacroTotals, replacementBase: MacroTotals) {
  const ratios: number[] = [];
  const weights = [
    { current: original.protein, base: replacementBase.protein, weight: 3 },
    { current: original.carbs, base: replacementBase.carbs, weight: 2 },
    { current: original.fat, base: replacementBase.fat, weight: 2 },
    { current: original.calories, base: replacementBase.calories, weight: 1 },
  ];

  weights.forEach(({ current, base, weight }) => {
    if (current > 0 && base > 0) {
      for (let index = 0; index < weight; index += 1) {
        ratios.push(current / base);
      }
    }
  });

  if (!ratios.length) {
    return 1;
  }

  return Math.max(0.25, Math.min(4, ratios.reduce((total, item) => total + item, 0) / ratios.length));
}

function calculateSimilarityScore(original: MacroTotals, candidate: MacroTotals) {
  const proteinGap = Math.abs(original.protein - candidate.protein);
  const carbGap = Math.abs(original.carbs - candidate.carbs);
  const fatGap = Math.abs(original.fat - candidate.fat);
  const calorieGap = Math.abs(original.calories - candidate.calories) / 10;

  return proteinGap * 3 + carbGap * 2 + fatGap * 2 + calorieGap;
}

export function buildFoodSubstitution(
  originalFood: MealFood | ConsumedMealFood,
  replacement: NutritionLibraryItem,
  notes = '',
): { food: ConsumedMealFood; substitution: MealFoodSubstitution } {
  const originalTotals = calculateFoodTotals(originalFood);
  const replacementBase = getLibraryItemBaseValues(replacement);
  const scale = buildReplacementScale(originalTotals, replacementBase);
  const usePer100g = replacement.measureMode === 'per_100g';
  const usePortion = replacement.measureMode === 'portion';
  const baseQuantity = usePer100g ? 100 : parseNutritionNumber(replacement.portionQuantity) ?? 1;
  const baseUnit = usePer100g ? 'g' : replacement.portionUnit || 'un';
  const replacementQuantity = roundQuantity(baseQuantity * scale);
  const replacementTotals = {
    calories: roundMacro(replacementBase.calories * scale),
    protein: roundMacro(replacementBase.protein * scale),
    carbs: roundMacro(replacementBase.carbs * scale),
    fat: roundMacro(replacementBase.fat * scale),
  };
  const substitutionId = createNutritionId('food_substitution');
  const quantityLabel = String(replacementQuantity);

  return {
    food: {
      ...normalizeFood(originalFood),
      id: createNutritionId('food_consumed'),
      originalFoodId: originalFood.id,
      substitutionId,
      substituted: true,
      name: replacement.name,
      quantity: quantityLabel,
      unit: baseUnit,
      calories: String(replacementTotals.calories),
      protein: String(replacementTotals.protein),
      carbs: String(replacementTotals.carbs),
      fat: String(replacementTotals.fat),
      libraryItemId: replacement.id,
      category: replacement.category,
      notes: notes.trim() || originalFood.notes,
      substitutionLocked: usePortion ? false : originalFood.substitutionLocked,
    },
    substitution: {
      id: substitutionId,
      originalFoodId: originalFood.id,
      originalFoodName: originalFood.name,
      originalQuantity: originalFood.quantity,
      originalUnit: originalFood.unit,
      originalTotals,
      replacementLibraryItemId: replacement.id,
      replacementFoodName: replacement.name,
      replacementQuantity: quantityLabel,
      replacementUnit: baseUnit,
      replacementTotals,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    },
  };
}

export function suggestFoodSubstitutions(
  originalFood: MealFood | ConsumedMealFood,
  library: NutritionLibraryItem[],
  limit = 6,
) {
  const normalizedOriginal = normalizeFood(originalFood);
  const originalTotals = calculateFoodTotals(normalizedOriginal);
  const activeItems = library.filter((item) => item.active && item.id !== normalizedOriginal.libraryItemId);
  const sameCategory = normalizedOriginal.category
    ? activeItems.filter((item) => item.category === normalizedOriginal.category)
    : [];
  const remaining = activeItems.filter(
    (item) => !sameCategory.some((sameItem) => sameItem.id === item.id),
  );
  const ranked = [...sameCategory, ...remaining]
    .map((item) => {
      const preview = buildFoodSubstitution(normalizedOriginal, item);

      return {
        item,
        preview,
        score: calculateSimilarityScore(originalTotals, preview.substitution.replacementTotals),
      };
    })
    .sort((left, right) => left.score - right.score);

  return ranked.slice(0, limit);
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
  const formula =
    config.formula === 'mifflin_st_jeor' || config.formula === 'tinsley_mlm' || config.formula === 'harris_benedict'
      ? config.formula
      : fallback.formula;
  const adherence = config.adherence === 'driven' || config.adherence === 'steady' ? config.adherence : fallback.adherence;

  return {
    ...fallback,
    ...config,
    weightKg: String(config.weightKg ?? fallback.weightKg),
    heightCm: String(config.heightCm ?? fallback.heightCm),
    age: String(config.age ?? fallback.age),
    bodyFat: String(config.bodyFat ?? fallback.bodyFat),
    sex: config.sex === 'female' ? 'female' : 'male',
    formula,
    activityFactor: String(config.activityFactor ?? fallback.activityFactor),
    adherence,
    targetCalories: String(config.targetCalories ?? fallback.targetCalories),
    calorieAdjustment: String(config.calorieAdjustment ?? fallback.calorieAdjustment),
    proteinPerKg: String(config.proteinPerKg ?? fallback.proteinPerKg),
    fatPerKg: String(config.fatPerKg ?? fallback.fatPerKg),
    carbCycle: Boolean(config.carbCycle),
    protocolName: String(config.protocolName ?? fallback.protocolName),
    coachNotes: String(config.coachNotes ?? fallback.coachNotes),
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
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((meal) => {
    const current = meal as NutritionMeal;

    return {
      ...current,
      foods: Array.isArray(current.foods) ? current.foods.map((food) => normalizeFood(food as MealFood)) : [],
      notes: typeof current.notes === 'string' ? current.notes : '',
    };
  });
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
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<StudentNutritionPlan> | null;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return mapNutritionRow(
        {
          id: parsed.id,
          student_id: parsed.studentId ?? student.id,
          trainer_id: parsed.trainerId ?? student.trainer_id,
          consultancy_id: parsed.consultancyId ?? student.consultancy_id,
          config: parsed.config,
          phases: parsed.phases,
          meals: parsed.meals,
          created_at: parsed.createdAt,
          updated_at: parsed.updatedAt,
        },
        student,
      );
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

export async function fetchNutritionFoodLibrary(student: Student) {
  const localKey = createLibraryKey(student.consultancy_id, student.trainer_id);
  const cachedRaw = await AsyncStorage.getItem(localKey);
  const cachedItems = (() => {
    if (!cachedRaw) {
      return [] as NutritionLibraryItem[];
    }

    try {
      const parsed = JSON.parse(cachedRaw);
      if (!Array.isArray(parsed)) {
        return [] as NutritionLibraryItem[];
      }

      return parsed
        .map((item) => normalizeLibraryItem(item, student.trainer_id, student.consultancy_id))
        .filter(Boolean) as NutritionLibraryItem[];
    } catch {
      return [] as NutritionLibraryItem[];
    }
  })();

  if (student.id.startsWith('local-student-')) {
    return loadLocalNutritionFoodLibrary(student);
  }

  const { data, error } = await supabase
    .from('nutrition_food_library')
    .select('id, trainer_id, consultancy_id, name, category, measure_mode, portion_quantity, portion_unit, portion_values, per100g_values, active, notes, created_at, updated_at')
    .eq('consultancy_id', student.consultancy_id)
    .eq('trainer_id', student.trainer_id)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return buildInitialFoodLibrary(student.trainer_id, student.consultancy_id);
  }

  const normalized = data
    .map((row) =>
      normalizeLibraryItem(
        {
          id: row.id,
          trainerId: row.trainer_id,
          consultancyId: row.consultancy_id,
          name: row.name,
          category: row.category,
          measureMode: row.measure_mode,
          portionQuantity: row.portion_quantity,
          portionUnit: row.portion_unit,
          portionValues: row.portion_values,
          per100gValues: row.per100g_values,
          active: row.active,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        student.trainer_id,
        student.consultancy_id,
      ),
    )
    .filter(Boolean) as NutritionLibraryItem[];

  return mergeLibraryMetadata(normalized, cachedItems);
}

export async function saveNutritionFoodLibrary(student: Student, items: NutritionLibraryItem[]) {
  const normalized = items
    .map((item) => normalizeLibraryItem(item, student.trainer_id, student.consultancy_id))
    .filter(Boolean) as NutritionLibraryItem[];
  const localKey = createLibraryKey(student.consultancy_id, student.trainer_id);

  if (student.id.startsWith('local-student-')) {
    return saveLocalNutritionFoodLibrary(student, normalized);
  }

  const payload = normalized.map((item) => ({
    id: item.id,
    trainer_id: student.trainer_id,
    consultancy_id: student.consultancy_id,
    name: item.name.trim(),
    category: item.category,
    measure_mode: item.measureMode,
    portion_quantity: item.portionQuantity,
    portion_unit: item.portionUnit,
    portion_values: item.portionValues,
    per100g_values: item.per100gValues,
    active: item.active,
    notes: item.notes.trim() || null,
  }));

  const { error } = await supabase.from('nutrition_food_library').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  await AsyncStorage.setItem(localKey, JSON.stringify(normalized));
  return normalized;
}

export async function loadLocalNutritionFoodLibrary(student: Student) {
  const localKey = createLibraryKey(student.consultancy_id, student.trainer_id);
  const raw = await AsyncStorage.getItem(localKey);

  if (!raw) {
    return buildInitialFoodLibrary(student.trainer_id, student.consultancy_id);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return buildInitialFoodLibrary(student.trainer_id, student.consultancy_id);
    }

    return parsed
      .map((item) => normalizeLibraryItem(item, student.trainer_id, student.consultancy_id))
      .filter(Boolean) as NutritionLibraryItem[];
  } catch {
    return buildInitialFoodLibrary(student.trainer_id, student.consultancy_id);
  }
}

export async function saveLocalNutritionFoodLibrary(student: Student, items: NutritionLibraryItem[]) {
  const normalized = items
    .map((item) => normalizeLibraryItem(item, student.trainer_id, student.consultancy_id))
    .filter(Boolean) as NutritionLibraryItem[];
  const localKey = createLibraryKey(student.consultancy_id, student.trainer_id);
  await AsyncStorage.setItem(localKey, JSON.stringify(normalized));
  return normalized;
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
