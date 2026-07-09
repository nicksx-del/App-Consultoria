import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  buildFoodSubstitution,
  calculateDayTotals,
  calculateMealTotals,
  getActivePhase,
  nutritionWeekdayLabels,
  nutritionWeekdayOrder,
  nutritionWeekdayShortLabels,
  suggestFoodSubstitutions,
} from '../lib/nutrition';
import {
  calculateConsumedTotals,
  calculateRemainingTotals,
  getWeekdayFromDate,
  mealStatusLabels,
} from '../lib/studentExecution';
import type {
  ConsumedMealFood,
  MacroTotals,
  NutritionLibraryItem,
  NutritionMeal,
  NutritionWeekday,
  StudentNutritionPlan,
} from '../types/nutrition';
import type { Student } from '../types/student';
import type { MealLogStatus, SaveMealLogPayload, StudentMealLog } from '../types/studentExecution';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StudentNutritionTrackerProps = {
  student: Student;
  plan: StudentNutritionPlan | null;
  foodLibrary: NutritionLibraryItem[];
  mealLogs: StudentMealLog[];
  logDate: string;
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  onChangeLogDate: (date: string) => void;
  onSaveMealLog: (payload: SaveMealLogPayload) => Promise<StudentMealLog | void> | StudentMealLog | void;
  onRefresh: () => Promise<void> | void;
};

const statusMeta: Record<MealLogStatus, { icon: IconName; color: string; background: string }> = {
  planned: {
    icon: 'clock-outline',
    color: '#BCEAA9',
    background: 'rgba(188, 234, 169, 0.1)',
  },
  eaten: {
    icon: 'check-circle-outline',
    color: '#9CF02E',
    background: 'rgba(156, 240, 46, 0.16)',
  },
  partial: {
    icon: 'circle-half-full',
    color: '#FDE68A',
    background: 'rgba(253, 230, 138, 0.12)',
  },
  skipped: {
    icon: 'close-circle-outline',
    color: '#FCA5A5',
    background: 'rgba(252, 165, 165, 0.12)',
  },
};

const emptyTotals: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

function formatDate(value: string) {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatMacro(value: number, suffix: string) {
  return `${Math.round(value).toLocaleString('pt-BR')}${suffix}`;
}

function toLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateForWeekdayInCurrentWeek(weekday: NutritionWeekday) {
  const today = new Date();
  const currentIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const targetIndex = nutritionWeekdayOrder.indexOf(weekday);
  const date = new Date(today);
  date.setDate(today.getDate() + targetIndex - currentIndex);
  return toLocalDateIso(date);
}

function resolveTargetTotals(plan: StudentNutritionPlan, weekday: NutritionWeekday): MacroTotals {
  const dayTotals = calculateDayTotals(plan, weekday);
  const hasDayTargets = dayTotals.calories || dayTotals.protein || dayTotals.carbs || dayTotals.fat;

  if (hasDayTargets) {
    return dayTotals;
  }

  const phase = getActivePhase(plan);

  if (!phase) {
    return { ...emptyTotals };
  }

  return {
    calories: phase.calories,
    protein: phase.protein,
    carbs: phase.carbs,
    fat: phase.fat,
  };
}

function MacroBar({
  label,
  value,
  target,
  suffix,
  icon,
}: {
  label: string;
  value: number;
  target: number;
  suffix: string;
  icon: IconName;
}) {
  const percent = target ? Math.min(100, Math.round((value / target) * 100)) : 0;

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroTop}>
        <View style={styles.macroLabelWrap}>
          <MaterialCommunityIcons name={icon} size={15} color="#9CF02E" />
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
        <Text style={styles.macroValue}>
          {formatMacro(value, suffix)} / {formatMacro(target, suffix)}
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function FoodLine({ name, value }: { name: string; value: string }) {
  return (
    <View style={styles.foodLine}>
      <Text style={styles.foodName}>{name}</Text>
      <Text style={styles.foodValue}>{value}</Text>
    </View>
  );
}

function MealStatusButton({
  status,
  active,
  onPress,
}: {
  status: MealLogStatus;
  active: boolean;
  onPress: () => void;
}) {
  const meta = statusMeta[status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statusButton,
        active && { backgroundColor: meta.background, borderColor: meta.color },
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={meta.icon} size={15} color={active ? meta.color : 'rgba(232, 246, 221, 0.54)'} />
      <Text style={[styles.statusButtonText, active && { color: meta.color }]}>{mealStatusLabels[status]}</Text>
    </Pressable>
  );
}

export function StudentNutritionTracker({
  student,
  plan,
  foodLibrary,
  mealLogs,
  logDate,
  loading,
  saving,
  errorMessage,
  onChangeLogDate,
  onSaveMealLog,
  onRefresh,
}: StudentNutritionTrackerProps) {
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<null | { mealId: string; foodId: string }>(null);
  const [replacementNotes, setReplacementNotes] = useState('');

  const selectedWeekday = getWeekdayFromDate(logDate);
  const selectedMeals = plan?.meals.filter((meal) => meal.weekday === selectedWeekday) ?? [];
  const logsByMeal = useMemo(() => new Map(mealLogs.map((log) => [log.mealId, log])), [mealLogs]);
  const targetTotals = plan ? resolveTargetTotals(plan, selectedWeekday) : emptyTotals;
  const consumedTotals = plan ? calculateConsumedTotals(plan, mealLogs, logDate, selectedWeekday) : emptyTotals;
  const remainingTotals = calculateRemainingTotals(targetTotals, consumedTotals);
  const completedMeals = mealLogs.filter((log) => log.status === 'eaten' || log.status === 'partial').length;
  const completedPercent = selectedMeals.length ? Math.round((completedMeals / selectedMeals.length) * 100) : 0;
  const calorieGap = targetTotals.calories - consumedTotals.calories;
  const phase = plan ? getActivePhase(plan) : null;

  useEffect(() => {
    setNotesDrafts(
      Object.fromEntries(mealLogs.map((log) => [log.mealId, log.notes ?? ''])),
    );
  }, [mealLogs]);

  useEffect(() => {
    setReplacementTarget(null);
    setReplacementNotes('');
  }, [logDate, student.id]);

  const handleWeekdayPress = (weekday: NutritionWeekday) => {
    onChangeLogDate(getDateForWeekdayInCurrentWeek(weekday));
  };

  const saveMeal = async (meal: NutritionMeal, status: MealLogStatus, notes?: string) => {
    if (!plan) {
      return;
    }

    setLocalError(null);
    const currentLog = logsByMeal.get(meal.id);

    try {
      await onSaveMealLog({
        planId: plan.id ?? null,
        meal,
        logDate,
        weekday: selectedWeekday,
        status,
        notes: notes ?? notesDrafts[meal.id] ?? '',
        consumedFoods: buildConsumedFoods(meal, currentLog),
        substitutions: currentLog?.substitutions ?? [],
      });
    } catch {
      setLocalError('Nao foi possivel atualizar essa refeicao.');
    }
  };

  const buildConsumedFoods = (meal: NutritionMeal, log?: StudentMealLog): ConsumedMealFood[] => {
    if (log?.consumedFoods?.length) {
      return log.consumedFoods;
    }

    return meal.foods.map((food) => ({
      ...food,
      originalFoodId: null,
      substitutionId: null,
      substituted: false,
    }));
  };

  const handleReplaceFood = async (
    meal: NutritionMeal,
    food: ConsumedMealFood,
    replacement: NutritionLibraryItem,
  ) => {
    const currentLog = logsByMeal.get(meal.id);
    const currentFoods = buildConsumedFoods(meal, currentLog);
    const currentSubstitutions = currentLog?.substitutions ?? [];
    const built = buildFoodSubstitution(food, replacement, replacementNotes);
    const nextFoods = currentFoods.map((item) =>
      (item.originalFoodId ?? item.id) === (food.originalFoodId ?? food.id) ? built.food : item,
    );
    const nextSubstitutions = [
      ...currentSubstitutions.filter((item) => item.originalFoodId !== (food.originalFoodId ?? food.id)),
      built.substitution,
    ];

    await onSaveMealLog({
      planId: plan?.id ?? null,
      meal,
      logDate,
      weekday: selectedWeekday,
      status: currentLog?.status ?? 'planned',
      notes: notesDrafts[meal.id] ?? '',
      consumedFoods: nextFoods,
      substitutions: nextSubstitutions,
    });

    setReplacementTarget(null);
    setReplacementNotes('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(5, 11, 6, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="food-apple-outline" size={25} color="#061007" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>Acompanhamento alimentar</Text>
          <Text style={styles.title}>{phase?.name ?? 'Plano alimentar'}</Text>
          <Text style={styles.subtitle}>
            Marque refei??es, acompanhe macros e veja o saldo do dia em tempo real para {student.full_name}.
          </Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{selectedMeals.length}</Text>
            <Text style={styles.heroStatLabel}>refei??es</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{completedPercent}%</Text>
            <Text style={styles.heroStatLabel}>conclu?do</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{calorieGap >= 0 ? '-' : '+'}{Math.abs(Math.round(calorieGap))}</Text>
            <Text style={styles.heroStatLabel}>kcal</Text>
          </View>
        </View>
        <Pressable onPress={() => void onRefresh()} disabled={loading} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator size="small" color="#9CF02E" /> : <Feather name="refresh-cw" size={15} color="#9CF02E" />}
        </Pressable>
      </LinearGradient>

      {errorMessage || localError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={styles.errorText}>{localError || errorMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#9CF02E" />
          <Text style={styles.loadingText}>Abrindo acompanhamento...</Text>
        </View>
      ) : !plan || !plan.meals.length ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="food-off-outline" size={34} color="#9CF02E" />
          <Text style={styles.emptyTitle}>Seu plano alimentar ainda não foi liberado</Text>
          <Text style={styles.emptyText}>Quando o treinador liberar o plano, as refeições aparecem aqui prontas para marcar.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekdayTabs}>
            {nutritionWeekdayOrder.map((weekday) => {
              const active = weekday === selectedWeekday;

              return (
                <Pressable
                  key={weekday}
                  onPress={() => handleWeekdayPress(weekday)}
                  style={({ pressed }) => [styles.weekdayChip, active && styles.weekdayChipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>
                    {nutritionWeekdayShortLabels[weekday]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.kicker}>{nutritionWeekdayLabels[selectedWeekday]}</Text>
                <Text style={styles.sectionTitle}>{formatDate(logDate)}</Text>
              </View>
              <View style={styles.mealCounter}>
                <Text style={styles.mealCounterText}>
                  {completedMeals}/{selectedMeals.length} refeições
                </Text>
              </View>
            </View>

            <View style={styles.macroPanel}>
              <MacroBar label="Calorias" value={consumedTotals.calories} target={targetTotals.calories} suffix=" kcal" icon="fire" />
              <MacroBar label="Proteína" value={consumedTotals.protein} target={targetTotals.protein} suffix="g" icon="arm-flex-outline" />
              <MacroBar label="Carboidratos" value={consumedTotals.carbs} target={targetTotals.carbs} suffix="g" icon="rice" />
              <MacroBar label="Gorduras" value={consumedTotals.fat} target={targetTotals.fat} suffix="g" icon="peanut-outline" />
            </View>

            <View style={styles.remainingGrid}>
              <View style={styles.remainingItem}>
                <Text style={styles.remainingValue}>{formatMacro(remainingTotals.calories, '')}</Text>
                <Text style={styles.remainingLabel}>kcal restantes</Text>
              </View>
              <View style={styles.remainingItem}>
                <Text style={styles.remainingValue}>{formatMacro(remainingTotals.protein, 'g')}</Text>
                <Text style={styles.remainingLabel}>proteína</Text>
              </View>
              <View style={styles.remainingItem}>
                <Text style={styles.remainingValue}>{formatMacro(remainingTotals.carbs, 'g')}</Text>
                <Text style={styles.remainingLabel}>carboidratos</Text>
              </View>
              <View style={styles.remainingItem}>
                <Text style={styles.remainingValue}>{formatMacro(remainingTotals.fat, 'g')}</Text>
                <Text style={styles.remainingLabel}>gorduras</Text>
              </View>
            </View>
          </View>

          <View style={styles.mealList}>
            {selectedMeals.length ? (
              selectedMeals.map((meal) => {
                const log = logsByMeal.get(meal.id);
                const status = log?.status ?? 'planned';
                const consumedFoods = buildConsumedFoods(meal, log);
                const mealTotals = consumedFoods.length
                  ? consumedFoods.reduce(
                      (total, food) => ({
                        calories: total.calories + (Number(food.calories) || 0),
                        protein: total.protein + (Number(food.protein) || 0),
                        carbs: total.carbs + (Number(food.carbs) || 0),
                        fat: total.fat + (Number(food.fat) || 0),
                      }),
                      { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    )
                  : calculateMealTotals(meal);

                return (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeader}>
                      <View style={styles.mealIcon}>
                        <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#061007" />
                      </View>
                      <View style={styles.mealCopy}>
                        <Text style={styles.mealTitle}>{meal.name}</Text>
                        <Text style={styles.mealMeta}>
                          {formatMacro(mealTotals.calories, ' kcal')} / P {formatMacro(mealTotals.protein, 'g')} / C {formatMacro(mealTotals.carbs, 'g')} / G {formatMacro(mealTotals.fat, 'g')}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: statusMeta[status].background, borderColor: statusMeta[status].color }]}>
                        <MaterialCommunityIcons name={statusMeta[status].icon} size={13} color={statusMeta[status].color} />
                        <Text style={[styles.statusPillText, { color: statusMeta[status].color }]}>{mealStatusLabels[status]}</Text>
                      </View>
                    </View>

                    <View style={styles.foodList}>
                      {consumedFoods.map((food) => {
                        const targetFood = meal.foods.find((item) => item.id === (food.originalFoodId ?? food.id)) ?? food;
                        const replacementOpen =
                          replacementTarget?.mealId === meal.id &&
                          replacementTarget?.foodId === (food.originalFoodId ?? food.id);
                        const suggestions =
                          !targetFood.substitutionLocked && foodLibrary.length
                            ? suggestFoodSubstitutions(targetFood, foodLibrary)
                            : [];

                        return (
                          <View key={food.id} style={styles.foodEntry}>
                            <FoodLine
                              name={food.name}
                              value={`${food.quantity}${food.unit ? ` ${food.unit}` : ''}`}
                            />
                            {food.substituted ? (
                              <Text style={styles.foodSwapText}>Substituido nesta refeicao</Text>
                            ) : null}
                            {!targetFood.substitutionLocked ? (
                              <Pressable
                                onPress={() =>
                                  setReplacementTarget(
                                    replacementOpen ? null : { mealId: meal.id, foodId: targetFood.id },
                                  )
                                }
                                style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
                              >
                                <Feather name="repeat" size={13} color="#9CF02E" />
                                <Text style={styles.swapButtonText}>Trocar alimento</Text>
                              </Pressable>
                            ) : (
                              <Text style={styles.foodSwapText}>Troca bloqueada pelo treinador</Text>
                            )}

                            {replacementOpen ? (
                              <View style={styles.swapPanel}>
                                {suggestions.map(({ item, preview }) => (
                                  <Pressable
                                    key={item.id}
                                    onPress={() => void handleReplaceFood(meal, food, item)}
                                    style={({ pressed }) => [styles.swapOption, pressed && styles.pressed]}
                                  >
                                    <Text style={styles.swapOptionTitle}>{item.name}</Text>
                                    <Text style={styles.swapOptionText}>
                                      {preview.substitution.replacementQuantity} {preview.substitution.replacementUnit}
                                    </Text>
                                  </Pressable>
                                ))}
                                <TextInput
                                  value={replacementNotes}
                                  placeholder="Observacao opcional sobre a troca"
                                  placeholderTextColor="rgba(220, 244, 200, 0.34)"
                                  onChangeText={setReplacementNotes}
                                  style={styles.noteInput}
                                />
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    {meal.notes ? <Text style={styles.mealNotes}>{meal.notes}</Text> : null}

                    <View style={styles.statusRow}>
                      {(['eaten', 'partial', 'skipped'] as MealLogStatus[]).map((item) => (
                        <MealStatusButton
                          key={item}
                          status={item}
                          active={status === item}
                          onPress={() => void saveMeal(meal, item)}
                        />
                      ))}
                    </View>

                    <View style={styles.noteBox}>
                      <TextInput
                        value={notesDrafts[meal.id] ?? ''}
                        placeholder="Observação rápida para o coach..."
                        placeholderTextColor="rgba(220, 244, 200, 0.34)"
                        onChangeText={(value) => setNotesDrafts((current) => ({ ...current, [meal.id]: value }))}
                        style={styles.noteInput}
                      />
                      <Pressable
                        onPress={() => void saveMeal(meal, status, notesDrafts[meal.id] ?? '')}
                        disabled={saving}
                        style={({ pressed }) => [styles.noteButton, pressed && !saving && styles.pressed, saving && styles.disabled]}
                      >
                        {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="save" size={14} color="#061007" />}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={30} color="#9CF02E" />
                <Text style={styles.emptyTitle}>Nenhuma refeição programada neste dia</Text>
                <Text style={styles.emptyText}>Escolha outro dia ou aguarde a liberação desta rotina.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  hero: {
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroStats: {
    gap: 8,
    minWidth: 108,
  },
  heroStat: {
    minWidth: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(8, 15, 8, 0.76)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  heroStatValue: {
    color: '#F4FFE8',
    fontSize: 17,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 2,
    color: 'rgba(220, 244, 200, 0.54)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F2FFE8',
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(232, 246, 221, 0.66)',
    fontSize: 13,
    lineHeight: 19,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 15, 8, 0.7)',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.32)',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: 'rgba(232, 246, 221, 0.72)',
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(8, 16, 9, 0.68)',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#F2FFE8',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  weekdayTabs: {
    gap: 8,
    paddingVertical: 2,
  },
  weekdayChip: {
    width: 48,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(9, 18, 10, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  weekdayText: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  weekdayTextActive: {
    color: '#061007',
  },
  summaryCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(7, 14, 8, 0.86)',
    padding: 16,
    gap: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  summaryPillText: {
    color: '#DCF4C8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#F2FFE8',
    fontSize: 19,
    fontWeight: '900',
  },
  mealCounter: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mealCounterText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  macroPanel: {
    gap: 12,
  },
  macroRow: {
    gap: 7,
  },
  macroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  macroLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroLabel: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  macroValue: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  macroTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.08)',
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    backgroundColor: '#9CF02E',
    borderRadius: 999,
  },
  remainingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  remainingItem: {
    flex: 1,
    minWidth: 110,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    padding: 12,
  },
  remainingValue: {
    color: '#F2FFE8',
    fontSize: 18,
    fontWeight: '900',
  },
  remainingLabel: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mealList: {
    gap: 14,
  },
  mealCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(9, 16, 10, 0.86)',
    padding: 15,
    gap: 13,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  mealIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCopy: {
    flex: 1,
    gap: 2,
  },
  mealTitle: {
    color: '#F2FFE8',
    fontSize: 16,
    fontWeight: '900',
  },
  mealMeta: {
    color: 'rgba(232, 246, 221, 0.55)',
    fontSize: 11,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  foodList: {
    gap: 7,
  },
  foodLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 246, 221, 0.06)',
    paddingBottom: 7,
  },
  foodName: {
    flex: 1,
    color: 'rgba(242, 255, 232, 0.88)',
    fontSize: 13,
    fontWeight: '800',
  },
  foodEntry: {
    gap: 8,
  },
  foodSwapText: {
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 11,
    fontWeight: '700',
  },
  swapButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  swapButtonText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  swapPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(7, 15, 8, 0.64)',
  },
  swapOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  swapOptionTitle: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '800',
  },
  swapOptionText: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 11,
    fontWeight: '700',
  },
  foodValue: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '900',
  },
  mealNotes: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 12,
    lineHeight: 18,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(156, 240, 46, 0.35)',
    paddingLeft: 10,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minWidth: 105,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232, 246, 221, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusButtonText: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 11,
    fontWeight: '900',
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  noteInput: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  noteButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
