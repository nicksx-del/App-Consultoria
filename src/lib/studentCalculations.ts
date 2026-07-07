import type {
  ActivityLevel,
  Student,
  StudentFormPayload,
  StudentGoal,
  StudentMetrics,
  StudentSex,
} from '../types/student';

export const activityLevelLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário',
  light: 'Leve',
  moderate: 'Moderado',
  active: 'Ativo',
  very_active: 'Muito ativo',
};

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const sexLabels: Record<StudentSex, string> = {
  male: 'Masculino',
  female: 'Feminino',
  other: 'Outro',
};

export const goalLabels: Record<StudentGoal, string> = {
  hypertrophy: 'Hipertrofia',
  fat_loss: 'Emagrecimento',
  recomposition: 'Recomposição',
  health: 'Saúde',
  performance: 'Performance',
};

const goalCalorieAdjustments: Record<StudentGoal, number> = {
  hypertrophy: 250,
  fat_loss: -400,
  recomposition: -150,
  health: 0,
  performance: 200,
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateStudentMetrics(student: Student | StudentFormPayload): StudentMetrics {
  let weight: number | string | null;
  let height: number | string | null;
  let age: number | string | null;
  let sex: StudentSex | null;
  let goal: StudentGoal;
  let activityLevel: ActivityLevel;

  if ('weight_kg' in student) {
    weight = student.weight_kg;
    height = student.height_cm;
    age = student.age;
    sex = student.sex;
    goal = student.goal;
    activityLevel = student.activity_level;
  } else {
    weight = student.weightKg;
    height = student.heightCm;
    age = student.age;
    sex = student.sex;
    goal = student.goal;
    activityLevel = student.activityLevel;
  }

  const weightKg = toNumber(weight);
  const heightCm = toNumber(height);
  const ageYears = toNumber(age);
  const heightMeters = heightCm ? heightCm / 100 : null;
  const bmi = weightKg && heightMeters ? round(weightKg / (heightMeters * heightMeters)) : null;

  if (!weightKg || !heightCm || !ageYears || !sex) {
    return {
      bmi,
      bmr: null,
      dailyCalories: null,
      suggestedCalories: null,
      goalLabel: goalLabels[goal],
    };
  }

  const sexAdjustment = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexAdjustment);
  const dailyCalories = Math.round(bmr * activityMultipliers[activityLevel]);
  const suggestedCalories = dailyCalories + goalCalorieAdjustments[goal];

  return {
    bmi,
    bmr,
    dailyCalories,
    suggestedCalories,
    goalLabel: goalLabels[goal],
  };
}
