import Constants from 'expo-constants';

import type {
  NutritionFoodCategory,
  NutritionFoodMeasureMode,
  NutritionLibraryMacroValues,
} from '../types/nutrition';

export type UsdaFoodSearchResult = {
  externalId: string;
  rawName: string;
  name: string;
  category: NutritionFoodCategory;
  measureMode: NutritionFoodMeasureMode;
  portionQuantity: string;
  portionUnit: string;
  portionValues: NutritionLibraryMacroValues;
  per100gValues: NutritionLibraryMacroValues;
  notes: string;
  source: 'usda';
};

type UsdaFoodSearchResponse = {
  foods?: Array<{
    fdcId?: number;
    description?: string;
    dataType?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    householdServingFullText?: string;
    foodNutrients?: Array<{
      nutrientName?: string;
      nutrientNumber?: string;
      value?: number;
    }>;
  }>;
};

function readExpoConfigValue(key: string) {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const env = process.env as Record<string, string | undefined>;
  return extra?.[key] ?? env[key] ?? '';
}

const usdaApiKey = readExpoConfigValue('EXPO_PUBLIC_USDA_API_KEY').trim();

export const isUsdaConfigured = Boolean(usdaApiKey);

const nutrientAliases = {
  calories: ['energy', 'energy (kcal)'],
  protein: ['protein'],
  carbs: ['carbohydrate, by difference', 'carbohydrate'],
  fat: ['total lipid (fat)', 'fat'],
};

function toMacroString(value: number) {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '';
}

function findNutrientValue(
  nutrients: Array<{ nutrientName?: string; nutrientNumber?: string; value?: number }> | undefined,
  target: keyof typeof nutrientAliases,
) {
  if (!nutrients?.length) {
    return 0;
  }

  const aliases = nutrientAliases[target];
  const match = nutrients.find((item) => {
    const nutrientName = item.nutrientName?.trim().toLowerCase() ?? '';
    const nutrientNumber = item.nutrientNumber?.trim() ?? '';

    if (target === 'calories' && nutrientNumber === '1008') {
      return true;
    }

    if (target === 'protein' && nutrientNumber === '1003') {
      return true;
    }

    if (target === 'carbs' && nutrientNumber === '1005') {
      return true;
    }

    if (target === 'fat' && nutrientNumber === '1004') {
      return true;
    }

    return aliases.includes(nutrientName);
  });

  return typeof match?.value === 'number' ? match.value : 0;
}

function scaleMacros(base: NutritionLibraryMacroValues, scale: number): NutritionLibraryMacroValues {
  return {
    calories: toMacroString((Number(base.calories) || 0) * scale),
    protein: toMacroString((Number(base.protein) || 0) * scale),
    carbs: toMacroString((Number(base.carbs) || 0) * scale),
    fat: toMacroString((Number(base.fat) || 0) * scale),
  };
}

function normalizeSpacing(value: string) {
  return value
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWords(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function localizeFoodName(value: string) {
  const normalized = normalizeSpacing(value.toLowerCase());
  const replacements: Array<[RegExp, string]> = [
    [/boneless skinless chicken breast/g, 'peito de frango sem pele'],
    [/chicken breast/g, 'peito de frango'],
    [/ground beef/g, 'carne moida bovina'],
    [/lean beef/g, 'carne bovina magra'],
    [/beef/g, 'carne bovina'],
    [/egg white/g, 'clara de ovo'],
    [/egg/g, 'ovo'],
    [/salmon/g, 'salmao'],
    [/tilapia/g, 'tilapia'],
    [/tuna/g, 'atum'],
    [/rice/g, 'arroz'],
    [/sweet potato/g, 'batata doce'],
    [/potato/g, 'batata'],
    [/cassava/g, 'mandioca'],
    [/oats|oatmeal/g, 'aveia'],
    [/bread/g, 'pao'],
    [/milk/g, 'leite'],
    [/yogurt/g, 'iogurte'],
    [/cheese/g, 'queijo'],
    [/banana/g, 'banana'],
    [/apple/g, 'maca'],
    [/papaya/g, 'mamao'],
    [/mango/g, 'manga'],
    [/grape/g, 'uva'],
    [/strawberr(?:y|ies)/g, 'morango'],
    [/pineapple/g, 'abacaxi'],
    [/broccoli/g, 'brocolis'],
    [/lettuce/g, 'alface'],
    [/tomato/g, 'tomate'],
    [/carrot/g, 'cenoura'],
    [/zucchini/g, 'abobrinha'],
    [/cucumber/g, 'pepino'],
    [/peanut butter/g, 'pasta de amendoim'],
    [/cashew/g, 'castanha de caju'],
    [/brazil nut/g, 'castanha do para'],
    [/avocado/g, 'abacate'],
    [/olive oil/g, 'azeite de oliva'],
    [/coffee/g, 'cafe'],
    [/coconut water/g, 'agua de coco'],
    [/creatine/g, 'creatina'],
    [/whey protein/g, 'whey protein'],
    [/protein bar/g, 'barra de proteina'],
  ];

  let localized = normalized;
  replacements.forEach(([pattern, next]) => {
    localized = localized.replace(pattern, next);
  });

  localized = localized
    .replace(/\braw\b/g, '')
    .replace(/\bcooked\b/g, ' cozido')
    .replace(/\bboiled\b/g, ' cozido')
    .replace(/\broasted\b/g, ' assado')
    .replace(/\bgrilled\b/g, ' grelhado')
    .replace(/\bskinless\b/g, ' sem pele')
    .replace(/\bboneless\b/g, ' sem osso')
    .replace(/\bin water\b/g, ' em agua')
    .replace(/\blow fat\b/g, ' baixo teor de gordura')
    .replace(/\bnonfat\b/g, ' zero gordura');

  return titleCaseWords(normalizeSpacing(localized));
}

function detectCategory(text: string): NutritionFoodCategory {
  const normalized = text.toLowerCase();

  if (/(chicken|beef|egg|salmon|tilapia|tuna|fish|whey|protein|turkey|pork|cottage|cheese)/.test(normalized)) {
    return 'protein';
  }

  if (/(rice|potato|sweet potato|cassava|bread|oat|oatmeal|pasta|bean|tapioca|granola|cereal|couscous)/.test(normalized)) {
    return 'carb';
  }

  if (/(peanut butter|cashew|brazil nut|olive oil|avocado|butter|nuts)/.test(normalized)) {
    return 'fat';
  }

  if (/(banana|apple|papaya|mango|grape|strawberry|pineapple|fruit)/.test(normalized)) {
    return 'fruit';
  }

  if (/(broccoli|lettuce|tomato|carrot|zucchini|cucumber|vegetable|spinach|kale)/.test(normalized)) {
    return 'vegetable';
  }

  if (/(milk|yogurt|cheese|dairy)/.test(normalized)) {
    return 'dairy';
  }

  if (/(coffee|water|juice|drink|coconut water)/.test(normalized)) {
    return 'drink';
  }

  if (/(creatine|whey|albumin|supplement|mass gainer)/.test(normalized)) {
    return 'supplement';
  }

  if (/(bar|cracker|biscuit|cookie|snack|chocolate)/.test(normalized)) {
    return 'snack';
  }

  return 'other';
}

function buildPortionMeta(food: NonNullable<UsdaFoodSearchResponse['foods']>[number]) {
  if (typeof food.servingSize === 'number' && food.servingSize > 0) {
    return {
      portionQuantity: String(Math.round(food.servingSize * 10) / 10),
      portionUnit: food.servingSizeUnit?.trim() || 'g',
      measureMode: 'both' as NutritionFoodMeasureMode,
    };
  }

  return {
    portionQuantity: '100',
    portionUnit: 'g',
    measureMode: 'per_100g' as NutritionFoodMeasureMode,
  };
}

function mapUsdaFood(food: NonNullable<UsdaFoodSearchResponse['foods']>[number]): UsdaFoodSearchResult | null {
  if (!food.fdcId || !food.description) {
    return null;
  }

  const calories = findNutrientValue(food.foodNutrients, 'calories');
  const protein = findNutrientValue(food.foodNutrients, 'protein');
  const carbs = findNutrientValue(food.foodNutrients, 'carbs');
  const fat = findNutrientValue(food.foodNutrients, 'fat');
  const description = normalizeSpacing(food.description);

  const per100gValues: NutritionLibraryMacroValues = {
    calories: toMacroString(calories),
    protein: toMacroString(protein),
    carbs: toMacroString(carbs),
    fat: toMacroString(fat),
  };

  const portionMeta = buildPortionMeta(food);
  const portionScale =
    portionMeta.portionUnit.toLowerCase() === 'g' && Number(portionMeta.portionQuantity) > 0
      ? Number(portionMeta.portionQuantity) / 100
      : 1;

  return {
    externalId: String(food.fdcId),
    rawName: description,
    name: localizeFoodName(description),
    category: detectCategory(description),
    measureMode: portionMeta.measureMode,
    portionQuantity: portionMeta.portionQuantity,
    portionUnit: portionMeta.portionUnit,
    portionValues: scaleMacros(per100gValues, portionScale),
    per100gValues,
    notes: `Importado da USDA FoodData Central (${food.dataType ?? 'Food'}).`,
    source: 'usda',
  };
}

export async function searchUsdaFoods(query: string, limit = 8) {
  if (!isUsdaConfigured) {
    throw new Error('USDA API key nao configurada.');
  }

  const sanitizedQuery = query.trim();
  if (!sanitizedQuery) {
    return [] as UsdaFoodSearchResult[];
  }

  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: sanitizedQuery,
      pageSize: limit,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
      sortBy: 'dataType.keyword',
      sortOrder: 'asc',
    }),
  });

  if (!response.ok) {
    throw new Error(`USDA search falhou (${response.status}).`);
  }

  const data = (await response.json()) as UsdaFoodSearchResponse;
  return (data.foods ?? [])
    .map(mapUsdaFood)
    .filter(Boolean) as UsdaFoodSearchResult[];
}
