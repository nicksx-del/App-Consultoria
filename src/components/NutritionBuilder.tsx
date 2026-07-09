import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  type KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import {
  activityFactorOptions,
  adherenceOptions,
  calculateBmi,
  calculateBmr,
  calculateCoachMacroTargets,
  calculateDayTotals,
  calculateMealTotals,
  calculateTdee,
  calculateWeeklyTotals,
  createEmptyLibraryItem,
  createEmptyFood,
  createFoodFromLibraryItem,
  createEmptyMeal,
  formulaLabels,
  getActivePhase,
  nutritionFoodCategoryLabels,
  nutritionWeekdayLabels,
  nutritionWeekdayOrder,
  nutritionWeekdayShortLabels,
  parseNutritionNumber,
  rebuildPhasesFromConfig,
} from '../lib/nutrition';
import { isUsdaConfigured, searchUsdaFoods, type UsdaFoodSearchResult } from '../lib/usdaFoods';
import type { StudentGoal } from '../types/student';
import type {
  MacroTotals,
  MealFood,
  NutritionFoodCategory,
  NutritionLibraryItem,
  NutritionLibrarySource,
  NutritionAdherence,
  NutritionFormula,
  NutritionMeal,
  NutritionPhase,
  NutritionSex,
  NutritionWeekday,
  StudentNutritionPlan,
} from '../types/nutrition';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type NutritionBuilderTab = 'control' | 'phases' | 'meals' | 'summary';
type SectionKey = 'physical' | 'formula' | 'activity' | 'targets' | 'phases' | 'meals' | 'library' | 'summary';

type NutritionBuilderProps = {
  plan: StudentNutritionPlan | null;
  foodLibrary: NutritionLibraryItem[];
  studentName: string;
  studentGoal: StudentGoal;
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  canEdit: boolean;
  mealLogs: Array<{
    mealId: string;
    mealName: string;
    status: string;
    consumedFoods: Array<{ name: string; quantity: string; unit: string; substituted?: boolean }>;
    substitutions: Array<{ originalFoodName: string; replacementFoodName: string; replacementQuantity: string; replacementUnit: string }>;
    notes: string;
  }>;
  mealLogDate: string;
  onSaveLibrary: (items: NutritionLibraryItem[]) => Promise<NutritionLibraryItem[] | void> | NutritionLibraryItem[] | void;
  onSave: (plan: StudentNutritionPlan) => Promise<void> | void;
};

type SectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  icon: IconName;
  expanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
};

type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  onChangeText: (value: string) => void;
};

type FoodDraft = Omit<MealFood, 'id'>;

const builderTabs: Array<{ id: NutritionBuilderTab; label: string; icon: IconName }> = [
  { id: 'control', label: 'Controle', icon: 'calculator-variant-outline' },
  { id: 'phases', label: 'Fases', icon: 'chart-timeline-variant' },
  { id: 'meals', label: 'Refeições', icon: 'silverware-fork-knife' },
  { id: 'summary', label: 'Resumo', icon: 'chart-donut' },
];

const emptyFoodDraft: FoodDraft = {
  name: '',
  quantity: '',
  unit: 'g',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  notes: '',
};

const sexOptions: Array<{ value: NutritionSex; label: string; icon: IconName }> = [
  { value: 'male', label: 'Masculino', icon: 'gender-male' },
  { value: 'female', label: 'Feminino', icon: 'gender-female' },
];

const jsDayToNutrition: NutritionWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const foodCategoryOptions = Object.entries(nutritionFoodCategoryLabels) as Array<
  [NutritionFoodCategory, string]
>;
const librarySourceLabels: Record<NutritionLibrarySource, string> = {
  seed: 'Base pronta',
  usda: 'USDA',
  manual: 'Manual',
};

function getCurrentWeekday(): NutritionWeekday {
  return jsDayToNutrition[new Date().getDay()] ?? 'monday';
}

function formatKcal(value: number | null | undefined) {
  return value ? `${Math.round(value).toLocaleString('pt-BR')} kcal` : 'Completar';
}

function formatMacro(value: number | null | undefined, suffix = 'g') {
  return typeof value === 'number' ? `${Math.round(value).toLocaleString('pt-BR')}${suffix}` : '0g';
}

function macroCalories(totals: MacroTotals) {
  return totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
}

function percent(current: number, target: number) {
  if (!target) {
    return 0;
  }

  return Math.min(100, Math.round((current / target) * 100));
}

function toNumberInput(value: string, fallback = 0) {
  return parseNutritionNumber(value) ?? fallback;
}

function Section({ eyebrow, title, description, icon, expanded = true, onToggle, children }: SectionProps) {
  const header = (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons name={icon} size={20} color="#061007" />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.kicker}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {onToggle ? (
        <View style={styles.sectionChevron}>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CF02E" />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.sectionCard}>
      {onToggle ? (
        <Pressable onPress={onToggle} style={({ pressed }) => [pressed && styles.pressed]}>
          {header}
        </Pressable>
      ) : (
        header
      )}

      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function TextField({
  label,
  value,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  editable = true,
  onChangeText,
}: TextFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(220, 244, 200, 0.34)"
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.disabledInput]}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  disabled,
  icon,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  icon?: IconName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.activeChip,
        disabled && styles.disabledChip,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={15} color={active ? '#061007' : '#9CF02E'} /> : null}
      <Text style={[styles.chipText, active && styles.activeChipText]}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: IconName }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={17} color="#061007" />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function MacroBar({
  label,
  current,
  target,
  color,
  suffix = 'g',
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  suffix?: string;
}) {
  const progress = percent(current, target);

  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarTop}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {formatMacro(current, suffix)} / {formatMacro(target, suffix)}
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function FoodLine({
  food,
  canEdit,
  onChange,
  onRemove,
  onToggleLocked,
}: {
  food: MealFood;
  canEdit: boolean;
  onChange: (food: MealFood) => void;
  onRemove: () => void;
  onToggleLocked: () => void;
}) {
  return (
    <View style={styles.foodLine}>
      <View style={styles.foodLineHeader}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={food.name}
            placeholder="Alimento"
            placeholderTextColor="rgba(220, 244, 200, 0.34)"
            editable={canEdit}
            onChangeText={(value) => onChange({ ...food, name: value })}
            style={[styles.foodNameInput, !canEdit && styles.disabledInput]}
          />
          {food.libraryItemId ? (
            <Text style={styles.foodMetaText}>
              Biblioteca {food.category ? `· ${nutritionFoodCategoryLabels[food.category]}` : ''}
            </Text>
          ) : null}
        </View>
        {canEdit ? (
          <>
            <Pressable onPress={onToggleLocked} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Feather name={food.substitutionLocked ? 'lock' : 'unlock'} size={15} color="#9CF02E" />
            </Pressable>
            <Pressable onPress={onRemove} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Feather name="trash-2" size={15} color="#FCA5A5" />
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.foodFields}>
        <SmallInput label="Qtd" value={food.quantity} editable={canEdit} onChangeText={(value) => onChange({ ...food, quantity: value })} />
        <SmallInput label="Un." value={food.unit} editable={canEdit} onChangeText={(value) => onChange({ ...food, unit: value })} />
        <SmallInput label="Kcal" value={food.calories} editable={canEdit} numeric onChangeText={(value) => onChange({ ...food, calories: value })} />
        <SmallInput label="Prot" value={food.protein} editable={canEdit} numeric onChangeText={(value) => onChange({ ...food, protein: value })} />
        <SmallInput label="Carb" value={food.carbs} editable={canEdit} numeric onChangeText={(value) => onChange({ ...food, carbs: value })} />
        <SmallInput label="Gord" value={food.fat} editable={canEdit} numeric onChangeText={(value) => onChange({ ...food, fat: value })} />
      </View>
    </View>
  );
}

function SmallInput({
  label,
  value,
  editable,
  numeric,
  onChangeText,
}: {
  label: string;
  value: string;
  editable: boolean;
  numeric?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.smallInputWrap}>
      <Text style={styles.smallInputLabel}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder="-"
        placeholderTextColor="rgba(220, 244, 200, 0.3)"
        onChangeText={onChangeText}
        style={[styles.smallInput, !editable && styles.disabledInput]}
      />
    </View>
  );
}

export function NutritionBuilder({
  plan,
  foodLibrary,
  studentName,
  studentGoal,
  loading,
  saving,
  errorMessage,
  canEdit,
  mealLogs,
  mealLogDate,
  onSaveLibrary,
  onSave,
}: NutritionBuilderProps) {
  const [draft, setDraft] = useState<StudentNutritionPlan | null>(plan);
  const [activeTab, setActiveTab] = useState<NutritionBuilderTab>('control');
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    physical: true,
    formula: true,
    activity: true,
    targets: true,
    phases: true,
    meals: true,
    library: true,
    summary: true,
  });
  const [selectedWeekday, setSelectedWeekday] = useState<NutritionWeekday>(getCurrentWeekday());
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [newMealName, setNewMealName] = useState('');
  const [foodDrafts, setFoodDrafts] = useState<Record<string, FoodDraft>>({});
  const [libraryDraft, setLibraryDraft] = useState<NutritionLibraryItem | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState<NutritionFoodCategory | 'all'>('all');
  const [librarySearchByMeal, setLibrarySearchByMeal] = useState<Record<string, string>>({});
  const [usdaQuery, setUsdaQuery] = useState('');
  const [usdaResults, setUsdaResults] = useState<UsdaFoodSearchResult[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [usdaImportedIds, setUsdaImportedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDraft(plan);
    setEditingPhaseId(null);
    setExpandedMealId(null);
    setFoodDrafts({});
  }, [plan?.id, plan?.updatedAt, plan?.studentId]);

  useEffect(() => {
    setLibraryDraft((current) =>
      current && plan ? current : plan ? createEmptyLibraryItem(plan.trainerId, plan.consultancyId) : null,
    );
  }, [plan?.trainerId, plan?.consultancyId]);

  const canInteract = Boolean(canEdit && draft && !saving);
  const activePhase = draft ? getActivePhase(draft) : null;
  const selectedMeals = draft ? draft.meals.filter((meal) => meal.weekday === selectedWeekday) : [];
  const normalizedMealLogs = useMemo(
    () =>
      (Array.isArray(mealLogs) ? mealLogs : []).map((log) => ({
        mealId: log?.mealId ?? '',
        mealName: log?.mealName ?? 'Refeição',
        status: log?.status ?? 'pending',
        consumedFoods: Array.isArray(log?.consumedFoods) ? log.consumedFoods : [],
        substitutions: Array.isArray(log?.substitutions) ? log.substitutions : [],
        notes: typeof log?.notes === 'string' ? log.notes : '',
      })),
    [mealLogs],
  );
  const filteredLibrary = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return foodLibrary.filter(
      (item) =>
        item.active &&
        (libraryCategoryFilter === 'all' || item.category === libraryCategoryFilter) &&
        (!query || item.name.toLowerCase().includes(query)),
    );
  }, [foodLibrary, libraryCategoryFilter, librarySearch]);
  const dayTotals = useMemo(
    () => (draft ? calculateDayTotals(draft, selectedWeekday) : { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    [draft, selectedWeekday],
  );
  const weeklyTotals = useMemo(
    () => (draft ? calculateWeeklyTotals(draft) : { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    [draft],
  );
  const bmr = draft ? calculateBmr(draft.config) : null;
  const tdee = draft ? calculateTdee(draft.config) : null;
  const bmi = draft ? calculateBmi(draft.config.weightKg, draft.config.heightCm) : null;
  const coachTargets = draft ? calculateCoachMacroTargets(draft.config, studentGoal) : null;

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function updateDraft(updater: (current: StudentNutritionPlan) => StudentNutritionPlan) {
    if (!canInteract) {
      return;
    }

    setDraft((current) => (current ? updater(current) : current));
  }

  function updateConfig<Field extends keyof StudentNutritionPlan['config']>(
    field: Field,
    value: StudentNutritionPlan['config'][Field],
  ) {
    updateDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        [field]: value,
      },
    }));
  }

  function updatePhase(phaseId: string, patch: Partial<NutritionPhase>) {
    updateDraft((current) => ({
      ...current,
      phases: current.phases.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase)),
    }));
  }

  function updateMeal(mealId: string, patch: Partial<NutritionMeal>) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
    }));
  }

  function saveLibraryDraft() {
    if (!libraryDraft?.name.trim() || !draft) {
      return;
    }

    const nextItem = {
      ...libraryDraft,
      trainerId: draft.trainerId,
      consultancyId: draft.consultancyId,
      updatedAt: new Date().toISOString(),
      createdAt: libraryDraft.createdAt ?? new Date().toISOString(),
    };

    void onSaveLibrary(buildNextLibraryItems(nextItem));
    setLibraryDraft(createEmptyLibraryItem(draft.trainerId, draft.consultancyId));
  }

  function removeLibraryItem(itemId: string) {
    void onSaveLibrary(foodLibrary.filter((item) => item.id !== itemId));
  }

  function buildNextLibraryItems(nextItem: NutritionLibraryItem) {
    return [...foodLibrary.filter((item) => item.id !== nextItem.id), nextItem].sort((left, right) =>
      left.name.localeCompare(right.name, 'pt-BR'),
    );
  }

  async function handleSearchUsda() {
    const query = usdaQuery.trim();
    if (!query || !isUsdaConfigured) {
      return;
    }

    setUsdaLoading(true);
    setUsdaError(null);

    try {
      const results = await searchUsdaFoods(query, 10);
      setUsdaResults(results);
      setUsdaImportedIds(
        Object.fromEntries(
          results.map((result) => [
            result.externalId,
            foodLibrary.some((item) => item.externalId === result.externalId),
          ]),
        ),
      );
    } catch (error) {
      setUsdaResults([]);
      setUsdaError(error instanceof Error ? error.message : 'Nao foi possivel buscar alimentos na USDA agora.');
    } finally {
      setUsdaLoading(false);
    }
  }

  async function importUsdaFood(result: UsdaFoodSearchResult) {
    if (!draft) {
      return;
    }

    const existingItem = foodLibrary.find((item) => item.externalId === result.externalId);
    if (existingItem) {
      setUsdaImportedIds((current) => ({ ...current, [result.externalId]: true }));
      return;
    }

    const importedItem: NutritionLibraryItem = {
      ...createEmptyLibraryItem(draft.trainerId, draft.consultancyId, result.category),
      name: result.name,
      category: result.category,
      measureMode: result.measureMode,
      portionQuantity: result.portionQuantity,
      portionUnit: result.portionUnit,
      portionValues: result.portionValues,
      per100gValues: result.per100gValues,
      notes: result.notes,
      source: 'usda',
      externalId: result.externalId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveLibrary(buildNextLibraryItems(importedItem));
    setUsdaImportedIds((current) => ({ ...current, [result.externalId]: true }));
  }

  function addFoodFromLibrary(mealId: string, item: NutritionLibraryItem) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId ? { ...meal, foods: [...meal.foods, createFoodFromLibraryItem(item)] } : meal,
      ),
    }));
  }

  function addMeal() {
    if (!newMealName.trim()) {
      return;
    }

    const meal = createEmptyMeal(selectedWeekday, newMealName);
    updateDraft((current) => ({
      ...current,
      meals: [...current.meals, meal],
    }));
    setExpandedMealId(meal.id);
    setNewMealName('');
  }

  function removeMeal(mealId: string) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.filter((meal) => meal.id !== mealId),
    }));

    if (expandedMealId === mealId) {
      setExpandedMealId(null);
    }
  }

  function toggleFoodLock(mealId: string, foodId: string) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: meal.foods.map((food) =>
                food.id === foodId
                  ? { ...food, substitutionLocked: !food.substitutionLocked }
                  : food,
              ),
            }
          : meal,
      ),
    }));
  }

  function updateFoodDraft(mealId: string, patch: Partial<FoodDraft>) {
    setFoodDrafts((current) => ({
      ...current,
      [mealId]: {
        ...(current[mealId] ?? emptyFoodDraft),
        ...patch,
      },
    }));
  }

  function addFood(mealId: string) {
    const form = foodDrafts[mealId] ?? emptyFoodDraft;
    const food = {
      ...createEmptyFood(),
      ...form,
      name: form.name.trim() || 'Novo alimento',
    };

    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: [...meal.foods, food],
            }
          : meal,
      ),
    }));
    setFoodDrafts((current) => ({ ...current, [mealId]: emptyFoodDraft }));
  }

  function updateFood(mealId: string, food: MealFood) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: meal.foods.map((item) => (item.id === food.id ? food : item)),
            }
          : meal,
      ),
    }));
  }

  function removeFood(mealId: string, foodId: string) {
    updateDraft((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              foods: meal.foods.filter((food) => food.id !== foodId),
            }
          : meal,
      ),
    }));
  }

  async function handleSave() {
    if (!draft || !canEdit) {
      return;
    }

    await onSave(draft);
  }

  function handleRebuildPhases() {
    updateDraft((current) => rebuildPhasesFromConfig(current, studentGoal));
    setActiveTab('phases');
  }

  function handleApplyTargetsToActivePhase() {
    if (!coachTargets) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      phases: current.phases.length
        ? current.phases.map((phase, index) =>
            index === 0
              ? {
                  ...phase,
                  calories: coachTargets.calories,
                  protein: coachTargets.protein,
                  carbs: coachTargets.carbs,
                  fat: coachTargets.fat,
                  notes: phase.notes || 'Meta ajustada pelo coach a partir do painel de calculo.',
                }
              : phase,
          )
        : rebuildPhasesFromConfig(current, studentGoal).phases,
    }));
    setActiveTab('phases');
  }

  if (loading && !draft) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#9CF02E" />
        <Text style={styles.loadingText}>Abrindo plano alimentar...</Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.emptyBox}>
        <MaterialCommunityIcons name="food-apple-outline" size={30} color="#9CF02E" />
        <Text style={styles.emptyTitle}>Plano alimentar ainda não iniciado</Text>
        <Text style={styles.emptyText}>Abra o perfil do aluno para montar a dieta.</Text>
      </View>
    );
  }

  const activePhaseCalories = activePhase?.calories ?? 0;
  const totalMeals = draft.meals.length;
  const totalFoods = draft.meals.reduce((sum, meal) => sum + meal.foods.length, 0);

  return (
    <View style={styles.container} testID="nutrition-builder">
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.22)', 'rgba(5, 11, 6, 0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Plano alimentar</Text>
            <Text style={styles.heroTitle}>{draft.config.protocolName || 'Plano alimentar'}</Text>
            <Text style={styles.heroSubtitle}>{studentName} · fases, refeições e macros em um único painel.</Text>
          </View>

          {canEdit ? (
            <Pressable
              onPress={() => void handleSave()}
              disabled={saving}
              style={({ pressed }) => [styles.saveButton, saving && styles.disabledButton, pressed && !saving && styles.pressed]}
            >
              {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="save" size={15} color="#061007" />}
              <Text style={styles.saveButtonText}>{saving ? 'Salvando' : 'Salvar plano'}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroStats}>
          <MetricCard label="Fase atual" value={activePhase?.name ?? 'Criar fase'} hint={formatKcal(activePhaseCalories)} icon="flag-checkered" />
          <MetricCard label="Refeições" value={String(totalMeals)} hint={`${totalFoods} alimentos`} icon="silverware-fork-knife" />
          <MetricCard label="Hoje" value={formatKcal(dayTotals.calories)} hint={`${percent(dayTotals.calories, activePhaseCalories)}% da meta`} icon="calendar-today" />
        </View>
      </LinearGradient>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {builderTabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={({ pressed }) => [styles.tabButton, activeTab === tab.id && styles.activeTabButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={tab.icon} size={17} color={activeTab === tab.id ? '#061007' : '#9CF02E'} />
            <Text style={[styles.tabButtonText, activeTab === tab.id && styles.activeTabButtonText]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeTab === 'control' ? (
        <View style={styles.stack}>
          <Section
            eyebrow="Dados físicos"
            title="Base dos cálculos"
            icon="scale-bathroom"
            expanded={openSections.physical}
            onToggle={() => toggleSection('physical')}
            description="Peso, altura, idade e sexo alimentam IMC, TMB e gasto diário."
          >
            <View style={styles.metricGrid}>
              <MetricCard label="IMC" value={bmi ? bmi.toLocaleString('pt-BR') : 'Completar'} icon="human-male-height" />
              <MetricCard label="TMB" value={formatKcal(bmr)} icon="fire" />
              <MetricCard label="Gasto diário" value={formatKcal(tdee)} icon="run-fast" />
            </View>

            <View style={styles.chipWrap}>
              {sexOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  active={draft.config.sex === option.value}
                  disabled={!canInteract}
                  onPress={() => updateConfig('sex', option.value)}
                />
              ))}
            </View>

            <View style={styles.twoColumns}>
              <TextField label="Peso (kg)" value={draft.config.weightKg} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updateConfig('weightKg', value)} />
              <TextField label="Altura (cm)" value={draft.config.heightCm} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updateConfig('heightCm', value)} />
              <TextField label="Idade" value={draft.config.age} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updateConfig('age', value)} />
              <TextField label="% gordura" value={draft.config.bodyFat} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updateConfig('bodyFat', value)} />
            </View>
          </Section>

          <Section
            eyebrow="Motor metabólico"
            title="Fórmula da TMB"
            icon="calculator-variant-outline"
            expanded={openSections.formula}
            onToggle={() => toggleSection('formula')}
            description="Escolha a fórmula que melhor representa a leitura do coach."
          >
            <View style={styles.formulaGrid}>
              {(Object.keys(formulaLabels) as NutritionFormula[]).map((formula) => (
                <Pressable
                  key={formula}
                  onPress={() => updateConfig('formula', formula)}
                  disabled={!canInteract}
                  style={({ pressed }) => [
                    styles.formulaCard,
                    draft.config.formula === formula && styles.activeFormulaCard,
                    pressed && canInteract && styles.pressed,
                  ]}
                >
                  <Text style={[styles.formulaTitle, draft.config.formula === formula && styles.activeFormulaText]}>
                    {formulaLabels[formula].title}
                  </Text>
                  <Text style={styles.formulaText}>{formulaLabels[formula].description}</Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section
            eyebrow="FAF e aderência"
            title="Estratégia"
            icon="chart-bell-curve"
            expanded={openSections.activity}
            onToggle={() => toggleSection('activity')}
            description="Ajuste o fator de atividade e o ritmo esperado do processo."
          >
            <Text style={styles.subLabel}>Fator de atividade física</Text>
            <View style={styles.factorGrid}>
              {activityFactorOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => updateConfig('activityFactor', option.value)}
                  disabled={!canInteract}
                  style={({ pressed }) => [
                    styles.factorCard,
                    draft.config.activityFactor === option.value && styles.activeFactorCard,
                    pressed && canInteract && styles.pressed,
                  ]}
                >
                  <Text style={[styles.factorValue, draft.config.activityFactor === option.value && styles.activeFactorText]}>
                    {option.value}
                  </Text>
                  <Text style={styles.factorLabel}>{option.label}</Text>
                  <Text style={styles.factorHelper}>{option.helper}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.subLabel}>Tipo de adesão</Text>
            <View style={styles.twoColumns}>
              {(Object.keys(adherenceOptions) as NutritionAdherence[]).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => updateConfig('adherence', option)}
                  disabled={!canInteract}
                  style={({ pressed }) => [
                    styles.adherenceCard,
                    draft.config.adherence === option && styles.activeAdherenceCard,
                    pressed && canInteract && styles.pressed,
                  ]}
                >
                  <Text style={[styles.adherenceTitle, draft.config.adherence === option && styles.activeAdherenceText]}>
                    {adherenceOptions[option].title}
                  </Text>
                  <Text style={styles.adherenceText}>{adherenceOptions[option].description}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => updateConfig('carbCycle', !draft.config.carbCycle)}
              disabled={!canInteract}
              style={({ pressed }) => [styles.toggleRow, pressed && canInteract && styles.pressed]}
            >
              <View style={[styles.toggleKnob, draft.config.carbCycle && styles.activeToggleKnob]}>
                <Feather name={draft.config.carbCycle ? 'check' : 'minus'} size={13} color={draft.config.carbCycle ? '#061007' : '#9CF02E'} />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Ciclagem de carboidratos</Text>
                <Text style={styles.toggleText}>Permite dias high, médio e low carb dentro da semana.</Text>
              </View>
            </Pressable>
          </Section>

          <Section
            eyebrow="Alvo da dieta"
            title="Meta do coach"
            icon="target"
            expanded={openSections.targets}
            onToggle={() => toggleSection('targets')}
            description="Defina a meta antes de montar os alimentos: kcal, proteína por kg, gordura por kg e carbo automático."
          >
            <View style={styles.calculatorPanel}>
              <View style={styles.calculatorHeader}>
                <View>
                  <Text style={styles.calculatorTitle}>Meta sugerida</Text>
                  <Text style={styles.calculatorText}>
                    {coachTargets
                      ? `${formatKcal(coachTargets.calories)} no dia · ${coachTargets.adjustment >= 0 ? '+' : ''}${coachTargets.adjustment} kcal vs gasto`
                      : 'Complete peso, altura, idade e fator de atividade para gerar a meta.'}
                  </Text>
                </View>
                <View style={styles.calculatorBadge}>
                  <Text style={styles.calculatorBadgeText}>{coachTargets ? formatKcal(coachTargets.macroCalories) : 'Sem meta'}</Text>
                </View>
              </View>

              <View style={styles.macroPreviewGrid}>
                <View style={styles.macroPreviewCard}>
                  <Text style={styles.macroPreviewValue}>{coachTargets ? formatMacro(coachTargets.protein) : '0g'}</Text>
                  <Text style={styles.macroPreviewLabel}>Proteína</Text>
                  <Text style={styles.macroPreviewHint}>{coachTargets ? `${coachTargets.proteinPerKg} g/kg` : 'por kg'}</Text>
                </View>
                <View style={styles.macroPreviewCard}>
                  <Text style={styles.macroPreviewValue}>{coachTargets ? formatMacro(coachTargets.carbs) : '0g'}</Text>
                  <Text style={styles.macroPreviewLabel}>Carboidratos</Text>
                  <Text style={styles.macroPreviewHint}>automático</Text>
                </View>
                <View style={styles.macroPreviewCard}>
                  <Text style={styles.macroPreviewValue}>{coachTargets ? formatMacro(coachTargets.fat) : '0g'}</Text>
                  <Text style={styles.macroPreviewLabel}>Gordura</Text>
                  <Text style={styles.macroPreviewHint}>{coachTargets ? `${coachTargets.fatPerKg} g/kg` : 'por kg'}</Text>
                </View>
              </View>

              {coachTargets && Math.abs(coachTargets.difference) > 30 ? (
                <View style={styles.calculatorWarning}>
                  <Feather name="info" size={14} color="#FBBF24" />
                  <Text style={styles.calculatorWarningText}>
                    Os macros somam {formatKcal(coachTargets.macroCalories)}, diferença de {coachTargets.difference > 0 ? '+' : ''}
                    {Math.round(coachTargets.difference)} kcal. Ajuste gordura/proteína se quiser mais precisão.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.twoColumns}>
              <TextField
                label="Calorias alvo"
                value={draft.config.targetCalories}
                placeholder="Ex.: 2400"
                keyboardType="numeric"
                editable={canInteract}
                onChangeText={(value) => updateConfig('targetCalories', value)}
              />
              <TextField
                label="Ajuste energético"
                value={draft.config.calorieAdjustment}
                placeholder="Ex.: -350 ou +250"
                editable={canInteract}
                onChangeText={(value) => updateConfig('calorieAdjustment', value)}
              />
              <TextField
                label="Proteína (g/kg)"
                value={draft.config.proteinPerKg}
                placeholder="Ex.: 2.0"
                keyboardType="numeric"
                editable={canInteract}
                onChangeText={(value) => updateConfig('proteinPerKg', value)}
              />
              <TextField
                label="Gordura (g/kg)"
                value={draft.config.fatPerKg}
                placeholder="Ex.: 0.8"
                keyboardType="numeric"
                editable={canInteract}
                onChangeText={(value) => updateConfig('fatPerKg', value)}
              />
            </View>

            <TextField
              label="Orientações do coach"
              value={draft.config.coachNotes}
              placeholder="Ex.: preferir refeições simples, ajustar após 2 check-ins."
              multiline
              editable={canInteract}
              onChangeText={(value) => updateConfig('coachNotes', value)}
            />

            {canEdit ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleApplyTargetsToActivePhase}
                  disabled={!canInteract || !coachTargets}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    styles.flexAction,
                    (!canInteract || !coachTargets) && styles.disabledButton,
                    pressed && canInteract && coachTargets && styles.pressed,
                  ]}
                >
                  <Feather name="target" size={15} color="#061007" />
                  <Text style={styles.primaryActionText}>Aplicar na fase atual</Text>
                </Pressable>
                <Pressable
                  onPress={handleRebuildPhases}
                  disabled={!canInteract}
                  style={({ pressed }) => [styles.outlineAction, styles.flexAction, !canInteract && styles.disabledButton, pressed && canInteract && styles.pressed]}
                >
                  <Feather name="refresh-cw" size={15} color="#9CF02E" />
                  <Text style={styles.outlineActionText}>Recriar protocolo</Text>
                </Pressable>
              </View>
            ) : null}
          </Section>
        </View>
      ) : null}

      {activeTab === 'phases' ? (
        <View style={styles.stack}>
          <Section
            eyebrow="Protocolo"
            title={draft.config.protocolName || 'Plano alimentar'}
            icon="flag-checkered"
            expanded={openSections.phases}
            onToggle={() => toggleSection('phases')}
            description="Estrutura de meses/fases inspirada no painel de referência, mas editável pelo treinador."
          >
            <TextField
              label="Nome do protocolo"
              value={draft.config.protocolName}
              editable={canInteract}
              onChangeText={(value) => updateConfig('protocolName', value)}
            />

            <View style={styles.phaseList}>
              {draft.phases.map((phase, index) => {
                const isEditing = editingPhaseId === phase.id;
                const phaseTotals = macroCalories({
                  calories: phase.calories,
                  protein: phase.protein,
                  carbs: phase.carbs,
                  fat: phase.fat,
                });

                return (
                  <View key={phase.id} style={[styles.phaseCard, index === 0 && styles.activePhaseCard]}>
                    <Pressable
                      onPress={() => setEditingPhaseId(isEditing ? null : phase.id)}
                      style={({ pressed }) => [styles.phaseHeader, pressed && styles.pressed]}
                    >
                      <View style={styles.phaseMonth}>
                        <Text style={styles.phaseMonthText}>{phase.month}</Text>
                      </View>
                      <View style={styles.phaseCopy}>
                        <View style={styles.phaseTitleRow}>
                          <Text style={styles.phaseTitle}>{phase.name}</Text>
                          {index === 0 ? <Text style={styles.currentTag}>Atual</Text> : null}
                        </View>
                        <Text style={styles.phaseSubtitle}>{phase.subtitle}</Text>
                      </View>
                      <Feather name={isEditing ? 'chevron-up' : 'chevron-down'} size={18} color="#9CF02E" />
                    </Pressable>

                    <View style={styles.phaseMacros}>
                      <MetricCard label="Kcal" value={formatKcal(phase.calories)} hint={`${phaseTotals} kcal por macros`} icon="fire" />
                      <MetricCard label="Proteína" value={formatMacro(phase.protein)} icon="arm-flex-outline" />
                      <MetricCard label="Carboidratos" value={formatMacro(phase.carbs)} icon="barley" />
                      <MetricCard label="Gordura" value={formatMacro(phase.fat)} icon="water-percent" />
                    </View>

                    {isEditing ? (
                      <View style={styles.editPanel}>
                        <View style={styles.twoColumns}>
                          <TextField label="Nome" value={phase.name} editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { name: value })} />
                          <TextField label="Subtítulo" value={phase.subtitle} editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { subtitle: value })} />
                          <TextField label="Calorias" value={String(phase.calories)} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { calories: toNumberInput(value) })} />
                          <TextField label="Proteína" value={String(phase.protein)} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { protein: toNumberInput(value) })} />
                          <TextField label="Carboidratos" value={String(phase.carbs)} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { carbs: toNumberInput(value) })} />
                          <TextField label="Gordura" value={String(phase.fat)} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { fat: toNumberInput(value) })} />
                          <TextField label="Cardio min/dia" value={String(phase.cardioMinutes)} keyboardType="numeric" editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { cardioMinutes: toNumberInput(value) })} />
                        </View>
                        <TextField label="Notas do ADM" value={phase.notes} multiline editable={canInteract} onChangeText={(value) => updatePhase(phase.id, { notes: value })} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Section>
        </View>
      ) : null}

      {activeTab === 'meals' ? (
        <View style={styles.stack}>
          <Section
            eyebrow="Refeições"
            title={nutritionWeekdayLabels[selectedWeekday]}
            icon="silverware-fork-knife"
            expanded={openSections.meals}
            onToggle={() => toggleSection('meals')}
            description="Monte a dieta por dia, com alimentos e totais comparados à fase atual."
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayBar}>
              {nutritionWeekdayOrder.map((weekday) => (
                <Chip
                  key={weekday}
                  label={nutritionWeekdayShortLabels[weekday]}
                  active={selectedWeekday === weekday}
                  onPress={() => setSelectedWeekday(weekday)}
                />
              ))}
            </ScrollView>

            {activePhase ? (
              <View style={styles.targetPanel}>
                <View style={styles.targetHeader}>
                  <View>
                    <Text style={styles.targetTitle}>Total diário vs meta</Text>
                    <Text style={styles.targetText}>
                      {formatKcal(dayTotals.calories)} de {formatKcal(activePhase.calories)} · {selectedMeals.length} refeições
                    </Text>
                  </View>
                  <View style={styles.targetCircle}>
                    <Text style={styles.targetCircleText}>{percent(dayTotals.calories, activePhase.calories)}%</Text>
                  </View>
                </View>
                <MacroBar label="Proteína" current={dayTotals.protein} target={activePhase.protein} color="#9CF02E" />
                <MacroBar label="Carboidratos" current={dayTotals.carbs} target={activePhase.carbs} color="#58E976" />
                <MacroBar label="Gordura" current={dayTotals.fat} target={activePhase.fat} color="#FBBF24" />
                <MacroBar label="Calorias" current={dayTotals.calories} target={activePhase.calories} color="#22C55E" suffix=" kcal" />
              </View>
            ) : null}

            {canEdit ? (
              <View style={styles.addMealPanel}>
                <TextInput
                  value={newMealName}
                  placeholder="Nome da refeição, ex.: Café da manhã"
                  placeholderTextColor="rgba(220, 244, 200, 0.34)"
                  editable={canInteract}
                  onChangeText={setNewMealName}
                  style={[styles.input, styles.addMealInput, !canInteract && styles.disabledInput]}
                />
                <Pressable
                  onPress={addMeal}
                  disabled={!canInteract || !newMealName.trim()}
                  style={({ pressed }) => [
                    styles.addMealButton,
                    (!canInteract || !newMealName.trim()) && styles.disabledButton,
                    pressed && canInteract && styles.pressed,
                  ]}
                >
                  <Feather name="plus" size={16} color="#061007" />
                  <Text style={styles.addMealButtonText}>Nova</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.mealList}>
              {selectedMeals.length ? (
                selectedMeals.map((meal) => {
                  const mealTotals = calculateMealTotals(meal);
                  const expanded = expandedMealId === meal.id;
                  const form = foodDrafts[meal.id] ?? emptyFoodDraft;

                  return (
                    <View key={meal.id} style={styles.mealCard}>
                      <Pressable
                        onPress={() => setExpandedMealId(expanded ? null : meal.id)}
                        style={({ pressed }) => [styles.mealHeader, pressed && styles.pressed]}
                      >
                        <View style={styles.mealMark}>
                          <MaterialCommunityIcons name="food-variant" size={19} color="#061007" />
                        </View>
                        <View style={styles.mealCopy}>
                          <Text style={styles.mealTitle}>{meal.name}</Text>
                          <Text style={styles.mealText}>
                            {formatKcal(mealTotals.calories)} · {formatMacro(mealTotals.protein)} prot · {meal.foods.length} alimentos
                          </Text>
                        </View>
                        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CF02E" />
                      </Pressable>

                      {expanded ? (
                        <View style={styles.mealBody}>
                          <TextField
                            label="Nome da refeição"
                            value={meal.name}
                            editable={canInteract}
                            onChangeText={(value) => updateMeal(meal.id, { name: value })}
                          />
                          <TextField
                            label="Observações"
                            value={meal.notes}
                            placeholder="Ex.: trocar arroz por batata mantendo macros."
                            multiline
                            editable={canInteract}
                            onChangeText={(value) => updateMeal(meal.id, { notes: value })}
                          />

                            {meal.foods.map((food) => (
                              <FoodLine
                                key={food.id}
                                food={food}
                                canEdit={canInteract}
                                onChange={(nextFood) => updateFood(meal.id, nextFood)}
                                onRemove={() => removeFood(meal.id, food.id)}
                                onToggleLocked={() => toggleFoodLock(meal.id, food.id)}
                              />
                            ))}

                          {canEdit ? (
                            <View style={styles.foodComposer}>
                              <Text style={styles.subLabel}>Adicionar da biblioteca</Text>
                              <TextInput
                                value={librarySearchByMeal[meal.id] ?? ''}
                                placeholder="Buscar alimento da biblioteca"
                                placeholderTextColor="rgba(220, 244, 200, 0.34)"
                                editable={canInteract}
                                onChangeText={(value) =>
                                  setLibrarySearchByMeal((current) => ({ ...current, [meal.id]: value }))
                                }
                                style={[styles.input, !canInteract && styles.disabledInput]}
                              />
                              <View style={styles.librarySuggestionGrid}>
                                {foodLibrary
                                  .filter((item) => {
                                    const query = (librarySearchByMeal[meal.id] ?? '').trim().toLowerCase();
                                    return item.active && (!query || item.name.toLowerCase().includes(query));
                                  })
                                  .slice(0, 12)
                                  .map((item) => (
                                    <Pressable
                                      key={item.id}
                                      onPress={() => addFoodFromLibrary(meal.id, item)}
                                      style={({ pressed }) => [styles.librarySuggestionCard, pressed && styles.pressed]}
                                    >
                                      <Text style={styles.librarySuggestionTitle}>{item.name}</Text>
                                      <Text style={styles.librarySuggestionText}>
                                        {nutritionFoodCategoryLabels[item.category]} · {librarySourceLabels[item.source ?? 'manual']}
                                      </Text>
                                    </Pressable>
                                  ))}
                              </View>
                              <Text style={styles.subLabel}>Adicionar alimento</Text>
                              <View style={styles.foodFields}>
                                <SmallInput label="Nome" value={form.name} editable={canInteract} onChangeText={(value) => updateFoodDraft(meal.id, { name: value })} />
                                <SmallInput label="Qtd" value={form.quantity} editable={canInteract} onChangeText={(value) => updateFoodDraft(meal.id, { quantity: value })} />
                                <SmallInput label="Un." value={form.unit} editable={canInteract} onChangeText={(value) => updateFoodDraft(meal.id, { unit: value })} />
                                <SmallInput label="Kcal" value={form.calories} editable={canInteract} numeric onChangeText={(value) => updateFoodDraft(meal.id, { calories: value })} />
                                <SmallInput label="Prot" value={form.protein} editable={canInteract} numeric onChangeText={(value) => updateFoodDraft(meal.id, { protein: value })} />
                                <SmallInput label="Carb" value={form.carbs} editable={canInteract} numeric onChangeText={(value) => updateFoodDraft(meal.id, { carbs: value })} />
                                <SmallInput label="Gord" value={form.fat} editable={canInteract} numeric onChangeText={(value) => updateFoodDraft(meal.id, { fat: value })} />
                              </View>
                              <View style={styles.mealActions}>
                                <Pressable onPress={() => addFood(meal.id)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                                  <Feather name="plus" size={15} color="#9CF02E" />
                                  <Text style={styles.secondaryActionText}>Adicionar alimento</Text>
                                </Pressable>
                                <Pressable onPress={() => removeMeal(meal.id)} style={({ pressed }) => [styles.dangerAction, pressed && styles.pressed]}>
                                  <Feather name="trash-2" size={15} color="#FCA5A5" />
                                  <Text style={styles.dangerActionText}>Excluir refeição</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyMeals}>
                  <MaterialCommunityIcons name="silverware-clean" size={26} color="#9CF02E" />
                  <Text style={styles.emptyTitle}>Nenhuma refeição neste dia</Text>
                  <Text style={styles.emptyText}>Crie a primeira refeição para começar a montar a dieta.</Text>
                </View>
              )}
            </View>
          </Section>

          <Section
            eyebrow="Biblioteca"
            title="Base de alimentos"
            icon="database-outline"
            expanded={openSections.library}
            onToggle={() => toggleSection('library')}
            description="Cadastre a base de alimentos para montar o plano e liberar trocas equivalentes."
          >
            <TextInput
              value={librarySearch}
              placeholder="Buscar alimento da biblioteca"
              placeholderTextColor="rgba(220, 244, 200, 0.34)"
              editable={canInteract}
              onChangeText={setLibrarySearch}
              style={[styles.input, !canInteract && styles.disabledInput]}
            />

            <View style={styles.chipWrap}>
              <Chip
                label="Todos"
                active={libraryCategoryFilter === 'all'}
                disabled={!canInteract}
                onPress={() => setLibraryCategoryFilter('all')}
              />
              {foodCategoryOptions.map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={libraryCategoryFilter === value}
                  disabled={!canInteract}
                  onPress={() => setLibraryCategoryFilter(value)}
                />
              ))}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Base pronta para o treinador</Text>
              <Text style={styles.noteText}>
                A biblioteca local ja nasce com alimentos principais em PT-BR. Use a busca abaixo para achar rapido e,
                se faltar algo, complemente pela USDA.
              </Text>
            </View>

            <View style={styles.apiCard}>
              <View style={styles.apiHeader}>
                <View>
                  <Text style={styles.noteTitle}>Buscar alimento na USDA</Text>
                  <Text style={styles.noteText}>
                    Importa alimentos extras para a biblioteca do treinador quando a base pronta nao for suficiente.
                  </Text>
                </View>
                <View style={[styles.sourceBadge, !isUsdaConfigured && styles.sourceBadgeMuted]}>
                  <Text style={styles.sourceBadgeText}>{isUsdaConfigured ? 'API ativa' : 'API indisponivel'}</Text>
                </View>
              </View>

              {isUsdaConfigured ? (
                <>
                  <View style={styles.apiSearchRow}>
                    <TextInput
                      value={usdaQuery}
                      placeholder="Ex.: chicken breast, oats, yogurt"
                      placeholderTextColor="rgba(220, 244, 200, 0.34)"
                      editable={canInteract && !usdaLoading}
                      onChangeText={setUsdaQuery}
                      style={[styles.input, styles.apiSearchInput, (!canInteract || usdaLoading) && styles.disabledInput]}
                    />
                    <Pressable
                      onPress={() => void handleSearchUsda()}
                      disabled={!canInteract || usdaLoading || !usdaQuery.trim()}
                      style={({ pressed }) => [
                        styles.secondaryAction,
                        styles.apiSearchButton,
                        (!canInteract || usdaLoading || !usdaQuery.trim()) && styles.disabledAction,
                        pressed && styles.pressed,
                      ]}
                    >
                      {usdaLoading ? <ActivityIndicator size="small" color="#9CF02E" /> : <Feather name="search" size={15} color="#9CF02E" />}
                      <Text style={styles.secondaryActionText}>{usdaLoading ? 'Buscando' : 'Buscar na API'}</Text>
                    </Pressable>
                  </View>

                  {usdaError ? <Text style={styles.apiErrorText}>{usdaError}</Text> : null}

                  {usdaResults.length ? (
                    <View style={styles.apiResultsList}>
                      {usdaResults.map((item) => (
                        <View key={item.externalId} style={styles.apiResultCard}>
                          <View style={styles.libraryItemCopy}>
                            <Text style={styles.libraryItemTitle}>{item.name}</Text>
                            <Text style={styles.libraryItemMeta}>
                              {nutritionFoodCategoryLabels[item.category]} · {item.measureMode === 'per_100g' ? '100g' : `${item.portionQuantity} ${item.portionUnit}`}
                            </Text>
                            <Text style={styles.libraryHistoryMeta}>
                              {item.per100gValues.calories || '0'} kcal · {item.per100gValues.protein || '0'}P · {item.per100gValues.carbs || '0'}C · {item.per100gValues.fat || '0'}G
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => void importUsdaFood(item)}
                            disabled={!canInteract || Boolean(usdaImportedIds[item.externalId])}
                            style={({ pressed }) => [
                              styles.secondaryAction,
                              Boolean(usdaImportedIds[item.externalId]) && styles.disabledAction,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Feather
                              name={usdaImportedIds[item.externalId] ? 'check' : 'download'}
                              size={15}
                              color={usdaImportedIds[item.externalId] ? '#061007' : '#9CF02E'}
                            />
                            <Text style={styles.secondaryActionText}>
                              {usdaImportedIds[item.externalId] ? 'Importado' : 'Importar'}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.noteText}>
                  Configure `EXPO_PUBLIC_USDA_API_KEY` para liberar importacao de alimentos via USDA sem afetar a base pronta.
                </Text>
              )}
            </View>

            {libraryDraft ? (
              <View style={styles.libraryEditor}>
                <Text style={styles.noteTitle}>Cadastro manual e ajustes</Text>
                <Text style={styles.noteText}>
                  Use este bloco apenas para criar um alimento manualmente ou ajustar um item ja existente da biblioteca.
                </Text>
                <TextField
                  label="Nome do alimento"
                  value={libraryDraft.name}
                  editable={canInteract}
                  onChangeText={(value) =>
                    setLibraryDraft((current) => (current ? { ...current, name: value } : current))
                  }
                />
                <View style={styles.chipWrap}>
                  {([
                    ['portion', 'Por porcao'],
                    ['per_100g', 'Por 100g'],
                    ['both', 'Os dois'],
                  ] as const).map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      active={libraryDraft.measureMode === value}
                      disabled={!canInteract}
                      onPress={() =>
                        setLibraryDraft((current) => (current ? { ...current, measureMode: value } : current))
                      }
                    />
                  ))}
                </View>
                <View style={styles.foodFields}>
                  <SmallInput label="Qtd porção" value={libraryDraft.portionQuantity} editable={canInteract} onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionQuantity: value } : current))} />
                  <SmallInput label="Unidade" value={libraryDraft.portionUnit} editable={canInteract} onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionUnit: value } : current))} />
                  <SmallInput label="Kcal porção" value={libraryDraft.portionValues.calories} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionValues: { ...current.portionValues, calories: value } } : current))} />
                  <SmallInput label="Prot porção" value={libraryDraft.portionValues.protein} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionValues: { ...current.portionValues, protein: value } } : current))} />
                  <SmallInput label="Carb porção" value={libraryDraft.portionValues.carbs} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionValues: { ...current.portionValues, carbs: value } } : current))} />
                  <SmallInput label="Gord porção" value={libraryDraft.portionValues.fat} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, portionValues: { ...current.portionValues, fat: value } } : current))} />
                  <SmallInput label="Kcal 100g" value={libraryDraft.per100gValues.calories} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, per100gValues: { ...current.per100gValues, calories: value } } : current))} />
                  <SmallInput label="Prot 100g" value={libraryDraft.per100gValues.protein} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, per100gValues: { ...current.per100gValues, protein: value } } : current))} />
                  <SmallInput label="Carb 100g" value={libraryDraft.per100gValues.carbs} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, per100gValues: { ...current.per100gValues, carbs: value } } : current))} />
                  <SmallInput label="Gord 100g" value={libraryDraft.per100gValues.fat} editable={canInteract} numeric onChangeText={(value) => setLibraryDraft((current) => (current ? { ...current, per100gValues: { ...current.per100gValues, fat: value } } : current))} />
                </View>
                <View style={styles.mealActions}>
                  <Pressable onPress={saveLibraryDraft} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                    <Feather name="save" size={15} color="#9CF02E" />
                    <Text style={styles.secondaryActionText}>Salvar alimento</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.libraryList}>
              {filteredLibrary.map((item) => (
                <View key={item.id} style={styles.libraryItemCard}>
                  <View style={styles.libraryItemCopy}>
                    <Text style={styles.libraryItemTitle}>{item.name}</Text>
                    <Text style={styles.libraryItemMeta}>
                      {nutritionFoodCategoryLabels[item.category]} · {item.measureMode === 'per_100g' ? '100g' : `${item.portionQuantity} ${item.portionUnit}`}
                    </Text>
                    <Text style={styles.libraryHistoryMeta}>{librarySourceLabels[item.source ?? 'manual']}</Text>
                  </View>
                  <View style={styles.libraryItemActions}>
                    <Pressable onPress={() => setLibraryDraft(item)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <Feather name="edit-2" size={14} color="#9CF02E" />
                    </Pressable>
                    <Pressable onPress={() => removeLibraryItem(item.id)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                      <Feather name="trash-2" size={14} color="#FCA5A5" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Historico do dia</Text>
              <Text style={styles.noteText}>Registros carregados de {mealLogDate} para este aluno.</Text>
              {normalizedMealLogs.length ? (
                <View style={styles.libraryHistoryList}>
                  {normalizedMealLogs.map((log) => (
                    <View key={log.mealId} style={styles.libraryHistoryCard}>
                      <Text style={styles.libraryItemTitle}>{log.mealName}</Text>
                      <Text style={styles.libraryHistoryMeta}>Status: {log.status}</Text>
                      {log.substitutions.map((item) => (
                        <Text key={`${item.originalFoodName}-${item.replacementFoodName}`} style={styles.libraryHistoryMeta}>
                          {item.originalFoodName}
                          {' -> '}
                          {item.replacementFoodName} ({item.replacementQuantity} {item.replacementUnit})
                        </Text>
                      ))}
                      {log.notes ? <Text style={styles.libraryHistoryMeta}>Obs: {log.notes}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noteText}>Nenhum registro deste dia ainda.</Text>
              )}
            </View>
          </Section>
        </View>
      ) : null}

      {activeTab === 'summary' ? (
        <View style={styles.stack}>
          <Section
            eyebrow="Distribuição semanal"
            title="Resumo diário"
            icon="chart-donut"
            expanded={openSections.summary}
            onToggle={() => toggleSection('summary')}
            description="Visão rápida para conferir se a dieta está coerente antes de salvar."
          >
            <View style={styles.metricGrid}>
              <MetricCard label="Kcal da semana" value={formatKcal(weeklyTotals.calories)} icon="calendar-week-outline" />
              <MetricCard label="Proteína" value={formatMacro(weeklyTotals.protein)} icon="arm-flex-outline" />
              <MetricCard label="Carboidratos" value={formatMacro(weeklyTotals.carbs)} icon="barley" />
              <MetricCard label="Gordura" value={formatMacro(weeklyTotals.fat)} icon="water-percent" />
            </View>

            <View style={styles.weekSummary}>
              {nutritionWeekdayOrder.map((weekday) => {
                const totals = calculateDayTotals(draft, weekday);
                const meals = draft.meals.filter((meal) => meal.weekday === weekday).length;

                return (
                  <View key={weekday} style={styles.weekSummaryRow}>
                    <View>
                      <Text style={styles.weekSummaryDay}>{nutritionWeekdayLabels[weekday]}</Text>
                      <Text style={styles.weekSummaryText}>{meals} refeições cadastradas</Text>
                    </View>
                    <Text style={styles.weekSummaryKcal}>{formatKcal(totals.calories)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Próximo passo preparado</Text>
              <Text style={styles.noteText}>
                Esta estrutura já separa cálculo, fases e refeições. Depois podemos adicionar substituições de alimentos,
                lista de compras, preferências do aluno e envio do plano como versão mensal.
              </Text>
            </View>
          </Section>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 18,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 6,
    color: '#F4FFE8',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    marginTop: 6,
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 560,
  },
  saveButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  saveButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  heroStats: {
    width: '100%',
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 112,
    maxWidth: '100%',
    flexBasis: 112,
    padding: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(9, 18, 10, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 4,
    color: '#F4FFE8',
    fontSize: 17,
    fontWeight: '900',
  },
  metricHint: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.52)',
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.22)',
  },
  errorText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    gap: 9,
    paddingVertical: 2,
  },
  tabButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(12, 20, 13, 0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#9CF02E',
    borderColor: 'rgba(156, 240, 46, 0.8)',
  },
  tabButtonText: {
    color: '#DCF4C8',
    fontSize: 13,
    fontWeight: '900',
  },
  activeTabButtonText: {
    color: '#061007',
  },
  stack: {
    gap: 14,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(5, 10, 5, 0.84)',
    padding: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: 3,
    color: '#F4FFE8',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionDescription: {
    marginTop: 5,
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionChevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  sectionBody: {
    marginTop: 16,
    gap: 14,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(16, 25, 17, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  activeChip: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  chipText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  activeChipText: {
    color: '#061007',
  },
  disabledChip: {
    opacity: 0.55,
  },
  twoColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldWrap: {
    flexGrow: 1,
    minWidth: 145,
    flexBasis: 145,
    gap: 7,
  },
  fieldLabel: {
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(16, 23, 16, 0.9)',
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '700',
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  disabledInput: {
    opacity: 0.58,
  },
  formulaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formulaCard: {
    flexGrow: 1,
    minWidth: 150,
    flexBasis: 150,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(13, 21, 14, 0.8)',
  },
  activeFormulaCard: {
    borderColor: '#9CF02E',
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  formulaTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  activeFormulaText: {
    color: '#9CF02E',
  },
  formulaText: {
    marginTop: 7,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 12,
    lineHeight: 17,
  },
  subLabel: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  factorCard: {
    flexGrow: 1,
    minWidth: 104,
    flexBasis: 104,
    borderRadius: 17,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(13, 21, 14, 0.78)',
  },
  activeFactorCard: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  factorValue: {
    color: '#9CF02E',
    fontSize: 15,
    fontWeight: '900',
  },
  activeFactorText: {
    color: '#061007',
  },
  factorLabel: {
    marginTop: 5,
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '800',
  },
  factorHelper: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.5)',
    fontSize: 11,
    lineHeight: 15,
  },
  adherenceCard: {
    flexGrow: 1,
    minWidth: 160,
    flexBasis: 160,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(13, 21, 14, 0.8)',
  },
  activeAdherenceCard: {
    borderColor: '#9CF02E',
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  adherenceTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  activeAdherenceText: {
    color: '#9CF02E',
  },
  adherenceText: {
    marginTop: 7,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 12,
    lineHeight: 17,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(13, 21, 14, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  toggleKnob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToggleKnob: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  toggleTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  toggleText: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 12,
    lineHeight: 17,
  },
  calculatorPanel: {
    gap: 13,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  calculatorTitle: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  calculatorText: {
    marginTop: 5,
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 12,
    lineHeight: 18,
  },
  calculatorBadge: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculatorBadgeText: {
    color: '#061007',
    fontSize: 12,
    fontWeight: '900',
  },
  macroPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  macroPreviewCard: {
    flexGrow: 1,
    flexBasis: 104,
    minWidth: 104,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(5, 10, 5, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  macroPreviewValue: {
    color: '#F4FFE8',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  macroPreviewLabel: {
    marginTop: 4,
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  macroPreviewHint: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  calculatorWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.18)',
  },
  calculatorWarningText: {
    flex: 1,
    color: 'rgba(254, 243, 199, 0.88)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flexAction: {
    flexGrow: 1,
    flexBasis: 170,
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  primaryActionText: {
    color: '#061007',
    fontSize: 14,
    fontWeight: '900',
  },
  outlineAction: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(156, 240, 46, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  outlineActionText: {
    color: '#9CF02E',
    fontSize: 14,
    fontWeight: '900',
  },
  phaseList: {
    gap: 12,
  },
  phaseCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(12, 19, 13, 0.82)',
    padding: 13,
    gap: 12,
  },
  activePhaseCard: {
    borderColor: 'rgba(156, 240, 46, 0.5)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseMonth: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseMonthText: {
    color: '#061007',
    fontSize: 16,
    fontWeight: '900',
  },
  phaseCopy: {
    flex: 1,
  },
  phaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  phaseTitle: {
    color: '#F4FFE8',
    fontSize: 16,
    fontWeight: '900',
  },
  currentTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.14)',
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  phaseSubtitle: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 12,
  },
  phaseMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  editPanel: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 240, 46, 0.12)',
  },
  dayBar: {
    gap: 8,
    paddingVertical: 1,
  },
  targetPanel: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(13, 21, 14, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    gap: 12,
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  targetTitle: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  targetText: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 12,
  },
  targetCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    borderColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  targetCircleText: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  macroBarWrap: {
    gap: 7,
  },
  macroBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  macroLabel: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '800',
  },
  macroValue: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 12,
    fontWeight: '700',
  },
  macroTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(220, 244, 200, 0.08)',
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 999,
  },
  addMealPanel: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addMealInput: {
    flex: 1,
  },
  addMealButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addMealButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  mealList: {
    gap: 12,
  },
  mealCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(12, 19, 13, 0.82)',
    overflow: 'hidden',
  },
  mealHeader: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCopy: {
    flex: 1,
  },
  mealTitle: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  mealText: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 12,
  },
  mealBody: {
    gap: 12,
    padding: 13,
    paddingTop: 0,
  },
  foodLine: {
    borderRadius: 17,
    padding: 11,
    backgroundColor: 'rgba(3, 8, 3, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
    gap: 10,
  },
  foodLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodNameInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(16, 23, 16, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '800',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.18)',
  },
  foodFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallInputWrap: {
    flexGrow: 1,
    flexBasis: 72,
    minWidth: 72,
    gap: 5,
  },
  smallInputLabel: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  smallInput: {
    minHeight: 39,
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(16, 23, 16, 0.86)',
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '800',
  },
  foodComposer: {
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(156, 240, 46, 0.04)',
  },
  mealActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  foodMetaText: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 10,
    fontFamily: 'Sora_500Medium',
  },
  librarySuggestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  librarySuggestionCard: {
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    gap: 4,
  },
  librarySuggestionTitle: {
    color: '#F2FFE8',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  librarySuggestionText: {
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 10,
    fontFamily: 'Sora_500Medium',
  },
  libraryEditor: {
    gap: 12,
  },
  apiCard: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(9, 18, 11, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  apiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  apiSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  apiSearchInput: {
    flex: 1,
  },
  apiSearchButton: {
    minWidth: 144,
  },
  apiResultsList: {
    gap: 10,
  },
  apiResultCard: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  apiErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_500Medium',
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    alignSelf: 'flex-start',
  },
  sourceBadgeMuted: {
    backgroundColor: 'rgba(220, 244, 200, 0.14)',
  },
  sourceBadgeText: {
    color: '#061007',
    fontSize: 11,
    fontWeight: '900',
  },
  libraryList: {
    gap: 10,
  },
  libraryItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  libraryItemCopy: {
    flex: 1,
    gap: 4,
  },
  libraryItemTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontFamily: 'Sora_700Bold',
  },
  libraryItemMeta: {
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
  },
  libraryItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  libraryHistoryList: {
    gap: 10,
    marginTop: 12,
  },
  libraryHistoryCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.08)',
    gap: 4,
  },
  libraryHistoryMeta: {
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_500Medium',
  },
  secondaryAction: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledAction: {
    opacity: 0.5,
  },
  secondaryActionText: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  dangerAction: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.22)',
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerActionText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyMeals: {
    minHeight: 160,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(156, 240, 46, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#F4FFE8',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 6,
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  weekSummary: {
    gap: 9,
  },
  weekSummaryRow: {
    borderRadius: 17,
    padding: 12,
    backgroundColor: 'rgba(13, 21, 14, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekSummaryDay: {
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  weekSummaryText: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.5)',
    fontSize: 12,
  },
  weekSummaryKcal: {
    color: '#9CF02E',
    fontSize: 13,
    fontWeight: '900',
  },
  noteCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  noteTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  noteText: {
    marginTop: 7,
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 13,
    lineHeight: 19,
  },
  loadingBox: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(5, 10, 5, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBox: {
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(5, 10, 5, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.55,
  },
});


