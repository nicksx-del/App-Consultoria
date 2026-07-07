export type NutritionFormula = 'harris_benedict' | 'mifflin_st_jeor' | 'tinsley_mlm';
export type NutritionSex = 'male' | 'female';
export type NutritionAdherence = 'steady' | 'driven';
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
