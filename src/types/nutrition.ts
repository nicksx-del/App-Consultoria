export type NutritionFormula = 'harris_benedict' | 'mifflin_st_jeor' | 'tinsley_mlm';
export type NutritionSex = 'male' | 'female';
export type NutritionAdherence = 'steady' | 'driven';
export type NutritionFoodMeasureMode = 'portion' | 'per_100g' | 'both';
export type NutritionFoodCategory =
  | 'protein'
  | 'carb'
  | 'fat'
  | 'fruit'
  | 'vegetable'
  | 'dairy'
  | 'drink'
  | 'supplement'
  | 'snack'
  | 'other';
export type NutritionWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type NutritionConfig = {
  sex: NutritionSex;
  weightKg: string;
  heightCm: string;
  age: string;
  bodyFat: string;
  formula: NutritionFormula;
  activityFactor: string;
  adherence: NutritionAdherence;
  targetCalories: string;
  calorieAdjustment: string;
  proteinPerKg: string;
  fatPerKg: string;
  carbCycle: boolean;
  protocolName: string;
  coachNotes: string;
};

export type NutritionPhase = {
  id: string;
  month: number;
  name: string;
  subtitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cardioMinutes: number;
  notes: string;
};

export type NutritionLibraryMacroValues = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

export type NutritionLibrarySource = 'seed' | 'usda' | 'manual';

export type NutritionLibraryItem = {
  id: string;
  trainerId: string;
  consultancyId: string;
  name: string;
  category: NutritionFoodCategory;
  measureMode: NutritionFoodMeasureMode;
  portionQuantity: string;
  portionUnit: string;
  portionValues: NutritionLibraryMacroValues;
  per100gValues: NutritionLibraryMacroValues;
  active: boolean;
  notes: string;
  source?: NutritionLibrarySource;
  externalId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MealFood = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
  libraryItemId?: string | null;
  category?: NutritionFoodCategory | null;
  substitutionLocked?: boolean;
};

export type NutritionMeal = {
  id: string;
  weekday: NutritionWeekday;
  name: string;
  foods: MealFood[];
  notes: string;
};

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealFoodSubstitution = {
  id: string;
  originalFoodId: string;
  originalFoodName: string;
  originalQuantity: string;
  originalUnit: string;
  originalTotals: MacroTotals;
  replacementLibraryItemId: string;
  replacementFoodName: string;
  replacementQuantity: string;
  replacementUnit: string;
  replacementTotals: MacroTotals;
  notes: string;
  createdAt: string;
};

export type ConsumedMealFood = MealFood & {
  originalFoodId?: string | null;
  substitutionId?: string | null;
  substituted?: boolean;
};

export type StudentNutritionPlan = {
  id?: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  config: NutritionConfig;
  phases: NutritionPhase[];
  meals: NutritionMeal[];
  createdAt?: string;
  updatedAt?: string;
};
