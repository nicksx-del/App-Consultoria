import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type DimensionValue,
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
  calculateVolumeByMuscle,
  cardioIntensityLabels,
  cloneWorkoutDays,
  createDefaultWeeklySchedule,
  createBlankWorkoutDay,
  createExerciseFromForm,
  createWorkoutSet,
  exerciseAlternatives,
  getVolumeStatus,
  muscleLabels,
  muscleOptions,
  muscleVolumeTargets,
  replaceExerciseWithAlternative,
  trainingTemplates,
  weekdayLabels,
  weekdayOrder,
} from '../lib/training';
import type {
  CardioIntensity,
  MuscleGroup,
  StudentTrainingPlan,
  TrainingTemplate,
  WeekdayKey,
  WeekdayMode,
  WeeklySchedule,
  WorkoutDay,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSetType,
} from '../types/training';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type TrainingBuilderProps = {
  plan: StudentTrainingPlan | null;
  studentName: string;
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  canEdit: boolean;
  onSave: (plan: StudentTrainingPlan) => Promise<void> | void;
};

type SectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  icon: IconName;
  visible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
};

type AddExerciseState = {
  name: string;
  sets: string;
  reps: string;
  primaryMuscle: MuscleGroup;
};

type BuilderTab = 'workout' | 'cardio' | 'templates' | 'history';
type AccordionKey = 'workout' | 'templates' | 'progress' | 'history' | 'cardio' | 'weekly';

const builderTabs: Array<{ id: BuilderTab; label: string; icon: IconName }> = [
  { id: 'workout', label: 'Treino', icon: 'dumbbell' },
  { id: 'cardio', label: 'Cardio', icon: 'run-fast' },
  { id: 'templates', label: 'Modelos', icon: 'clipboard-list-outline' },
  { id: 'history', label: 'Histórico', icon: 'chart-timeline-variant' },
];

const difficultyLabels: Record<WorkoutExercise['difficulty'], string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

const rirOptions = ['', '0', '1', '2', '3', '4+'];
const repRangeOptions = ['5-9', '6-8', '8-10', '8-12', '10-12', '12-15'];
const setTypeOptions: Array<{ id: WorkoutSetType; label: string; helper: string; icon: IconName }> = [
  { id: 'working', label: 'Valida', helper: 'Serie principal', icon: 'check' },
  { id: 'warmup', label: 'Aquecimento', helper: 'Preparar carga', icon: 'fire' },
  { id: 'preparatory', label: 'Preparatoria', helper: 'Rampa tecnica', icon: 'flag-checkered' },
  { id: 'biset', label: 'Bi-set', helper: 'Combinada', icon: 'link-variant' },
  { id: 'dropset', label: 'Drop-set', helper: 'Reduz carga', icon: 'arrow-down-bold-circle-outline' },
  { id: 'failure', label: 'Falha', helper: 'Falha tecnica', icon: 'alert-octagon-outline' },
];
const addExerciseInitialState: AddExerciseState = {
  name: '',
  sets: '3',
  reps: '8-12',
  primaryMuscle: 'chest',
};

function createUiId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatVolume(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function polishTemplateText(value: string) {
  return value.replace('Classico', 'Clássico').replace('Forca', 'Força');
}

function Section({ eyebrow, title, description, icon, visible = true, expanded = true, onToggle, children }: SectionProps) {
  if (!visible) {
    return null;
  }

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
      {expanded ? children : null}
    </View>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChangeText,
  editable = true,
  keyboardType = 'default',
  multiline = false,
  compact = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.fieldWrap, compact && styles.fieldWrapCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(230, 244, 218, 0.34)"
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.textArea,
          compact && styles.inputCompact,
          compact && multiline && styles.textAreaCompact,
          !editable && styles.inputDisabled,
        ]}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        disabled && styles.disabledControl,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ghostButton,
        danger && styles.ghostButtonDanger,
        disabled && styles.disabledControl,
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={14} color={danger ? '#FFB4A8' : '#9CF02E'} />
      <Text style={[styles.ghostButtonText, danger && styles.ghostButtonDangerText]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledControl,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color="#061007" /> : <Feather name={icon} size={15} color="#061007" />}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function findWorkoutDay(plan: StudentTrainingPlan | null, dayId: string | null) {
  return plan?.workoutDays.find((dayItem) => dayItem.id === dayId) ?? plan?.workoutDays[0] ?? null;
}

function findExercise(plan: StudentTrainingPlan | null, dayId: string, exerciseId: string) {
  return plan?.workoutDays
    .find((dayItem) => dayItem.id === dayId)
    ?.exercises.find((exerciseItem) => exerciseItem.id === exerciseId) ?? null;
}

function cloneExercise(exerciseItem: WorkoutExercise) {
  return {
    ...exerciseItem,
    id: createUiId('exercise'),
    name: `${exerciseItem.name} copia`,
    sets: exerciseItem.sets.map((setItem) => ({
      ...setItem,
      id: createUiId('set'),
    })),
  };
}

function createScheduleFromTemplate(templateItem: TrainingTemplate, dayIdMap: Map<string, string>) {
  return Object.fromEntries(
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
}

export function TrainingBuilder({
  plan,
  studentName,
  loading,
  saving,
  errorMessage,
  canEdit,
  onSave,
}: TrainingBuilderProps) {
  const [draft, setDraft] = useState<StudentTrainingPlan | null>(plan);
  const [activeDayId, setActiveDayId] = useState<string | null>(plan?.workoutDays[0]?.id ?? null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [newExercise, setNewExercise] = useState<AddExerciseState>(addExerciseInitialState);
  const [progressExerciseId, setProgressExerciseId] = useState<string | null>(null);
  const [substitutionTarget, setSubstitutionTarget] = useState<{ dayId: string; exerciseId: string } | null>(null);
  const [activeBuilderTab, setActiveBuilderTab] = useState<BuilderTab>('workout');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [pendingRepRange, setPendingRepRange] = useState(addExerciseInitialState.reps);
  const [openSections, setOpenSections] = useState<Record<AccordionKey, boolean>>({
    workout: true,
    templates: true,
    progress: true,
    history: false,
    cardio: true,
    weekly: true,
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDraft(plan);
    setActiveDayId(plan?.workoutDays[0]?.id ?? null);
    setEditingExerciseId(null);
    setSubstitutionTarget(null);
    setExpandedExerciseId(null);
  }, [plan]);

  const activeDay = findWorkoutDay(draft, activeDayId);
  const selectedProgressExercise =
    activeDay?.exercises.find((exerciseItem) => exerciseItem.id === progressExerciseId) ??
    activeDay?.exercises[0] ??
    null;
  const volume = calculateVolumeByMuscle(draft?.workoutDays ?? []);
  const substitutionExercise = substitutionTarget
    ? findExercise(draft, substitutionTarget.dayId, substitutionTarget.exerciseId)
    : null;
  const canInteract = canEdit && !saving;
  const activeDayRepRange = activeDay?.exercises[0]?.sets[0]?.reps ?? pendingRepRange;

  const toggleSection = (section: AccordionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const updateDraft = (updater: (current: StudentTrainingPlan) => StudentTrainingPlan) => {
    setDraft((current) => {
      if (!current || !canEdit) {
        return current;
      }

      return updater(current);
    });
  };

  const updateWorkoutDay = (dayId: string, updater: (dayItem: WorkoutDay) => WorkoutDay) => {
    updateDraft((current) => ({
      ...current,
      workoutDays: current.workoutDays.map((dayItem) => (dayItem.id === dayId ? updater(dayItem) : dayItem)),
    }));
  };

  const applyRepRangeToDay = (dayId: string, repRange: string) => {
    if (!canInteract) {
      return;
    }

    setPendingRepRange(repRange);
    updateWorkoutDay(dayId, (dayItem) => ({
      ...dayItem,
      exercises: dayItem.exercises.map((exerciseItem) => ({
        ...exerciseItem,
        sets: exerciseItem.sets.map((setItem) => ({
          ...setItem,
          reps: repRange,
        })),
      })),
    }));
    setNewExercise((current) => ({ ...current, reps: repRange }));
  };

  const updateExercise = (
    dayId: string,
    exerciseId: string,
    updater: (exerciseItem: WorkoutExercise) => WorkoutExercise,
  ) => {
    updateWorkoutDay(dayId, (dayItem) => ({
      ...dayItem,
      exercises: dayItem.exercises.map((exerciseItem) =>
        exerciseItem.id === exerciseId ? updater(exerciseItem) : exerciseItem,
      ),
    }));
  };

  const updateSet = (
    dayId: string,
    exerciseId: string,
    setId: string,
    updater: (setItem: WorkoutSet) => WorkoutSet,
  ) => {
    updateExercise(dayId, exerciseId, (exerciseItem) => ({
      ...exerciseItem,
      sets: exerciseItem.sets.map((setItem) => (setItem.id === setId ? updater(setItem) : setItem)),
    }));
  };

  const handleApplyTemplate = (templateItem: TrainingTemplate) => {
    if (!canInteract) {
      return;
    }

    updateDraft((current) => {
      const { workoutDays, dayIdMap } = cloneWorkoutDays(templateItem.workoutDays);
      setActiveDayId(workoutDays[0]?.id ?? null);
      setFeedback(`Template "${templateItem.name}" aplicado. Revise e salve o treino.`);

      return {
        ...current,
        workoutDays,
        weeklySchedule: createScheduleFromTemplate(templateItem, dayIdMap),
      };
    });
  };

  const handleCreateWorkoutFromScratch = () => {
    if (!canInteract) {
      return;
    }

    const nextDay = createBlankWorkoutDay();

    updateDraft((current) => ({
      ...current,
      workoutDays: [nextDay],
      weeklySchedule: createDefaultWeeklySchedule([nextDay]),
    }));
    setActiveBuilderTab('workout');
    setActiveDayId(nextDay.id);
    setExpandedExerciseId(null);
    setEditingExerciseId(null);
    setSubstitutionTarget(null);
    setNewExercise((current) => ({ ...current, reps: pendingRepRange }));
    setAddExerciseOpen(true);
    setFeedback('Treino do zero criado no rascunho. Adicione os exercícios e salve quando finalizar.');
  };

  const handleAddWorkoutDay = () => {
    if (!canInteract) {
      return;
    }

    const nextDay = createBlankWorkoutDay();
    updateDraft((current) => ({
      ...current,
      workoutDays: [...current.workoutDays, nextDay],
    }));
    setActiveDayId(nextDay.id);
    setFeedback('Novo dia de treino criado.');
  };

  const handleDeleteWorkoutDay = (dayId: string) => {
    if (!canInteract || (draft?.workoutDays.length ?? 0) <= 1) {
      return;
    }

    updateDraft((current) => {
      const nextDays = current.workoutDays.filter((dayItem) => dayItem.id !== dayId);
      const nextSchedule = Object.fromEntries(
        weekdayOrder.map((weekday) => {
          const schedule = current.weeklySchedule[weekday];
          return [
            weekday,
            schedule.workoutDayId === dayId ? { workoutDayId: null, mode: 'rest' as WeekdayMode } : schedule,
          ];
        }),
      ) as WeeklySchedule;

      setActiveDayId(nextDays[0]?.id ?? null);

      return {
        ...current,
        workoutDays: nextDays,
        weeklySchedule: nextSchedule,
      };
    });
  };

  const handleSaveBase = () => {
    if (!canInteract || !activeDay) {
      return;
    }

    const { workoutDays } = cloneWorkoutDays([activeDay]);
    const nextBase = workoutDays[0];

    updateDraft((current) => ({
      ...current,
      baseWorkoutDays: [
        ...current.baseWorkoutDays.filter((dayItem) => dayItem.name.toLowerCase() !== activeDay.name.toLowerCase()),
        nextBase,
      ],
    }));
    setFeedback(`Base "${activeDay.name}" salva no rascunho. Clique em Salvar plano para persistir.`);
  };

  const handleLoadBase = () => {
    if (!canInteract || !activeDay || !draft?.baseWorkoutDays.length) {
      return;
    }

    const baseDay =
      draft.baseWorkoutDays.find((dayItem) => dayItem.name.toLowerCase() === activeDay.name.toLowerCase()) ??
      draft.baseWorkoutDays[0];
    const { workoutDays } = cloneWorkoutDays([baseDay]);
    const loadedDay = { ...workoutDays[0], id: activeDay.id, name: activeDay.name };

    updateWorkoutDay(activeDay.id, () => loadedDay);
    setFeedback(`Base "${baseDay.name}" carregada para este dia.`);
  };

  const handleAddExercise = () => {
    if (!canInteract || !activeDay) {
      return;
    }

    if (!newExercise.name.trim()) {
      setFeedback('Informe o nome do exercício antes de adicionar.');
      return;
    }

    const setCount = Number(newExercise.sets.replace(',', '.'));
    const nextExercise = createExerciseFromForm(
      newExercise.name,
      Number.isFinite(setCount) ? setCount : 3,
      newExercise.reps.trim() || activeDayRepRange,
      newExercise.primaryMuscle,
    );

    updateWorkoutDay(activeDay.id, (dayItem) => ({
      ...dayItem,
      exercises: [...dayItem.exercises, nextExercise],
    }));
    setNewExercise(addExerciseInitialState);
    setPendingRepRange(nextExercise.sets[0]?.reps ?? activeDayRepRange);
    setAddExerciseOpen(false);
    setEditingExerciseId(nextExercise.id);
    setExpandedExerciseId(nextExercise.id);
    setFeedback('Exercício adicionado ao treino.');
  };

  const handleDeleteExercise = (dayId: string, exerciseId: string) => {
    if (!canInteract) {
      return;
    }

    updateWorkoutDay(dayId, (dayItem) => ({
      ...dayItem,
      exercises: dayItem.exercises.filter((exerciseItem) => exerciseItem.id !== exerciseId),
    }));

    if (editingExerciseId === exerciseId) {
      setEditingExerciseId(null);
    }
  };

  const handleCopyExercise = (dayId: string, exerciseItem: WorkoutExercise) => {
    if (!canInteract) {
      return;
    }

    updateWorkoutDay(dayId, (dayItem) => ({
      ...dayItem,
      exercises: [...dayItem.exercises, cloneExercise(exerciseItem)],
    }));
    setFeedback('Exercício copiado para o mesmo treino.');
  };

  const handleMoveExercise = (dayId: string, exerciseId: string, direction: 'up' | 'down') => {
    if (!canInteract) {
      return;
    }

    updateWorkoutDay(dayId, (dayItem) => {
      const currentIndex = dayItem.exercises.findIndex((exerciseItem) => exerciseItem.id === exerciseId);
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= dayItem.exercises.length) {
        return dayItem;
      }

      const nextExercises = [...dayItem.exercises];
      const [moved] = nextExercises.splice(currentIndex, 1);
      nextExercises.splice(nextIndex, 0, moved);

      return {
        ...dayItem,
        exercises: nextExercises,
      };
    });
  };

  const handleSubstituteExercise = (alternative: Omit<WorkoutExercise, 'id' | 'sets'>) => {
    if (!canInteract || !substitutionTarget || !substitutionExercise) {
      return;
    }

    updateExercise(substitutionTarget.dayId, substitutionTarget.exerciseId, (exerciseItem) =>
      replaceExerciseWithAlternative(exerciseItem, alternative),
    );
    setSubstitutionTarget(null);
    setFeedback('Substituição aplicada mantendo séries, reps e RIR.');
  };

  const handleWeekdayWorkout = (weekday: WeekdayKey, workoutDayId: string | null, mode: WeekdayMode = 'rest') => {
    if (!canInteract) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      weeklySchedule: {
        ...current.weeklySchedule,
        [weekday]: {
          workoutDayId,
          mode,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!draft || !canEdit) {
      return;
    }

    await onSave(draft);
    setFeedback('Plano salvo com sucesso.');
  };

  if (loading) {
    return (
      <View style={styles.loadingPanel}>
        <ActivityIndicator size="large" color="#9CF02E" />
        <Text style={styles.loadingText}>Abrindo construtor de treino...</Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.emptyPanel}>
        <MaterialCommunityIcons name="dumbbell" size={30} color="#061007" />
        <Text style={styles.emptyTitle}>Plano de treino ainda não iniciado</Text>
        <Text style={styles.emptyText}>Abra o perfil de um aluno para montar a primeira ficha.</Text>
      </View>
    );
  }

  return (
    <View style={styles.trainingStack}>
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(7, 12, 7, 0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="weight-lifter" size={27} color="#061007" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Plano de treino</Text>
            <Text style={styles.heroTitle}>Plano de {studentName}</Text>
            <Text style={styles.heroText}>Dias, volume, cardio, cargas, RIR e substituições em um único fluxo.</Text>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{draft.workoutDays.length}</Text>
            <Text style={styles.heroStatLabel}>dias</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>
              {draft.workoutDays.reduce((total, dayItem) => total + dayItem.exercises.length, 0)}
            </Text>
            <Text style={styles.heroStatLabel}>exercícios</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{draft.cardioConfig.weeklyMinutes || '0'}</Text>
            <Text style={styles.heroStatLabel}>min/semana</Text>
          </View>
        </View>

        <PrimaryButton
          icon="save"
          label={saving ? 'Salvando...' : 'Salvar plano'}
          onPress={handleSave}
          loading={saving}
          disabled={!canEdit || saving}
        />
      </LinearGradient>

      {!canEdit ? (
        <View style={styles.readOnlyNotice}>
          <Feather name="lock" size={15} color="#9CF02E" />
          <Text style={styles.readOnlyText}>Você está visualizando o plano. Somente o treinador pode editar.</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorNotice}>
          <Feather name="alert-circle" size={16} color="#FFB4A8" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {feedback ? (
        <Pressable onPress={() => setFeedback(null)} style={styles.feedbackNotice}>
          <Feather name="check-circle" size={15} color="#9CF02E" />
          <Text style={styles.feedbackText}>{feedback}</Text>
          <Feather name="x" size={13} color="rgba(220, 244, 200, 0.62)" />
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.builderTabs}>
        {builderTabs.map((tabItem) => {
          const active = activeBuilderTab === tabItem.id;

          return (
            <Pressable
              key={tabItem.id}
              onPress={() => setActiveBuilderTab(tabItem.id)}
              style={({ pressed }) => [
                styles.builderTab,
                active && styles.builderTabActive,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name={tabItem.icon} size={17} color={active ? '#061007' : '#9CF02E'} />
              <Text style={[styles.builderTabText, active && styles.builderTabTextActive]}>{tabItem.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeBuilderTab === 'templates' ? (
      <Section
        eyebrow="Templates de treino"
        title="Comece com uma base"
        icon="clipboard-list-outline"
        expanded={openSections.templates}
        onToggle={() => toggleSection('templates')}
        description="Como no painel de referência: aplicar um template substitui a ficha atual no rascunho."
      >
        <Pressable
          onPress={handleCreateWorkoutFromScratch}
          disabled={!canInteract}
          style={({ pressed }) => [
            styles.customWorkoutCard,
            !canInteract && styles.disabledControl,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.customWorkoutIcon}>
            <Feather name="edit-3" size={18} color="#061007" />
          </View>
          <View style={styles.customWorkoutCopy}>
            <Text style={styles.customWorkoutTitle}>Criar treino do zero</Text>
              <Text style={styles.customWorkoutText}>
              Comece com um dia vazio, adicione exercícios e monte sua própria metodologia.
            </Text>
          </View>
          <Feather name="arrow-right" size={17} color="#9CF02E" />
        </Pressable>

        <View style={styles.templateGrid}>
          {trainingTemplates.map((templateItem) => (
            <Pressable
              key={templateItem.id}
              onPress={() => handleApplyTemplate(templateItem)}
              disabled={!canInteract}
              style={({ pressed }) => [
                styles.templateCard,
                !canInteract && styles.disabledControl,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.templateTop}>
                <View style={styles.templateMark}>
                  <MaterialCommunityIcons name="dumbbell" size={20} color="#061007" />
                </View>
                <View style={styles.templatePill}>
                  <Text style={styles.templatePillText}>{templateItem.days}</Text>
                </View>
              </View>
              <Text style={styles.templateTitle}>{templateItem.name}</Text>
              <Text style={styles.templateText}>{polishTemplateText(templateItem.description)}</Text>
              <View style={styles.templateAction}>
                <Feather name="download-cloud" size={13} color="#9CF02E" />
                <Text style={styles.templateActionText}>Aplicar</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Section>
      ) : null}

      {false ? (
      <Section
        eyebrow="Análise de volume"
        title="Volume por grupo"
        icon="chart-bar"
        description="Conta séries válidas com carga acima de 80%. Músculos secundários contam metade."
      >
        <View style={styles.volumeLegend}>
          {['Abaixo do mínimo', 'Mínimo efetivo', 'Volume ideal', 'Alto volume'].map((label) => (
            <View key={label} style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.volumeList}>
          {muscleOptions.map((option) => {
            const target = muscleVolumeTargets[option.value];
            const value = volume[option.value];
            const status = getVolumeStatus(value, target);
            const width = `${Math.min(100, Math.round((value / Math.max(target.max, 1)) * 100))}%` as DimensionValue;

            return (
              <View key={option.value} style={styles.volumeRow}>
                <View style={styles.volumeTop}>
                  <Text style={styles.volumeName}>{option.label}</Text>
                  <Text style={[styles.volumeStatus, { color: status.color }]}>
                    {formatVolume(value)} / {target.min}-{target.max} - {status.label}
                  </Text>
                </View>
                <View style={styles.volumeTrack}>
                  <View style={[styles.volumeBar, { width, backgroundColor: status.color }]} />
                </View>
              </View>
            );
          })}
        </View>
      </Section>
      ) : null}

      <Section
        eyebrow="Evolução por exercício"
        title="Evolução por exercício"
        icon="chart-timeline-variant"
        visible={activeBuilderTab === 'history'}
        expanded={openSections.progress}
        onToggle={() => toggleSection('progress')}
        description="Quando o aluno registrar sessões, esta área mostrará cargas, reps e evolução por exercício."
      >
        {activeDay ? (
          <View style={styles.progressBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
              {activeDay.exercises.map((exerciseItem) => (
                <Chip
                  key={exerciseItem.id}
                  label={exerciseItem.name}
                  active={(selectedProgressExercise?.id ?? null) === exerciseItem.id}
                  onPress={() => setProgressExerciseId(exerciseItem.id)}
                />
              ))}
            </ScrollView>
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>{selectedProgressExercise?.name ?? 'Sem exercício selecionado'}</Text>
              <Text style={styles.historyText}>
                0 sessões nos últimos 30 dias. Assim que o aluno executar o treino, o histórico aparecerá aqui.
              </Text>
            </View>
          </View>
        ) : null}
      </Section>

      <Section
        eyebrow="Histórico por treino"
        title="Sessões por dia"
        icon="history"
        visible={activeBuilderTab === 'history'}
        expanded={openSections.history}
        onToggle={() => toggleSection('history')}
        description="Resumo rápido de execução por dia de treino."
      >
        <View style={styles.historyList}>
          {draft.workoutDays.map((dayItem) => (
            <View key={dayItem.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyRowTitle}>{dayItem.name}</Text>
                <Text style={styles.historyRowText}>0 sessões - 30 dias</Text>
              </View>
              <Feather name="chevron-right" size={17} color="rgba(220, 244, 200, 0.42)" />
            </View>
          ))}
        </View>
      </Section>

      <Section
        eyebrow="Configuração de cardio"
        title="Meta semanal"
        icon="run-fast"
        visible={activeBuilderTab === 'cardio'}
        expanded={openSections.cardio}
        onToggle={() => toggleSection('cardio')}
        description="Defina a meta, intensidade e uma orientação simples para o aluno."
      >
        <View style={styles.twoColumns}>
          <TextField
            label="Minutos por semana"
            value={draft.cardioConfig.weeklyMinutes}
            placeholder="150"
            keyboardType="numeric"
            editable={canInteract}
            onChangeText={(value) =>
              updateDraft((current) => ({
                ...current,
                cardioConfig: { ...current.cardioConfig, weeklyMinutes: value },
              }))
            }
          />
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Intensidade</Text>
            <View style={styles.chipWrap}>
              {(Object.keys(cardioIntensityLabels) as CardioIntensity[]).map((intensity) => (
                <Chip
                  key={intensity}
                  label={cardioIntensityLabels[intensity]}
                  active={draft.cardioConfig.intensity === intensity}
                  disabled={!canInteract}
                  onPress={() =>
                    updateDraft((current) => ({
                      ...current,
                      cardioConfig: { ...current.cardioConfig, intensity },
                    }))
                  }
                />
              ))}
            </View>
          </View>
        </View>

        <TextField
          label="Observação do coach"
          value={draft.cardioConfig.notes}
          placeholder="Ex.: 30 min apos treino de inferiores, mantendo conversa possivel."
          multiline
          editable={canInteract}
          onChangeText={(value) =>
            updateDraft((current) => ({
              ...current,
              cardioConfig: { ...current.cardioConfig, notes: value },
            }))
          }
        />

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview para o aluno</Text>
          <Text style={styles.previewText}>
            {draft.cardioConfig.weeklyMinutes || '0'} min/semana - {cardioIntensityLabels[draft.cardioConfig.intensity]}
          </Text>
          <Text style={styles.previewMuted}>
            {draft.cardioConfig.notes || 'Sem observação adicional por enquanto.'}
          </Text>
        </View>
      </Section>

      <Section
        eyebrow="Programação semanal"
        title="Agenda semanal"
        icon="calendar-week-outline"
        visible={activeBuilderTab === 'cardio'}
        expanded={openSections.weekly}
        onToggle={() => toggleSection('weekly')}
        description="A parte de baixo do Fialho muda abas; aqui a semana já conversa com os dias de treino."
      >
        <View style={styles.weekList}>
          {weekdayOrder.map((weekday) => {
            const schedule = draft.weeklySchedule[weekday];

            return (
              <View key={weekday} style={styles.weekRow}>
                <Text style={styles.weekdayName}>{weekdayLabels[weekday]}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekChoices}>
                  <Chip
                    label="Descanso"
                    active={!schedule.workoutDayId && schedule.mode === 'rest'}
                    disabled={!canInteract}
                    onPress={() => handleWeekdayWorkout(weekday, null, 'rest')}
                  />
                  <Chip
                    label="Só cardio"
                    active={!schedule.workoutDayId && schedule.mode === 'cardio'}
                    disabled={!canInteract}
                    onPress={() => handleWeekdayWorkout(weekday, null, 'cardio')}
                  />
                  {draft.workoutDays.map((dayItem) => (
                    <Chip
                      key={dayItem.id}
                      label={dayItem.name}
                      active={schedule.workoutDayId === dayItem.id}
                      disabled={!canInteract}
                      onPress={() => handleWeekdayWorkout(weekday, dayItem.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </View>
      </Section>

      <Section
        eyebrow="Ficha de musculação"
        title="Estrutura dos dias"
        icon="dumbbell"
        visible={activeBuilderTab === 'workout'}
        expanded={openSections.workout}
        onToggle={() => toggleSection('workout')}
        description="Editor inspirado no painel do aluno: abas de treino, salvar base, carregar base e edição avançada."
      >
        <View style={styles.dayTabsHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
            {draft.workoutDays.map((dayItem) => (
              <Pressable
                key={dayItem.id}
                onPress={() => {
                  setActiveDayId(dayItem.id);
                  setEditingExerciseId(null);
                  setExpandedExerciseId(null);
                  setSubstitutionTarget(null);
                }}
                style={({ pressed }) => [
                  styles.dayTab,
                  activeDay?.id === dayItem.id && styles.dayTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayTabText, activeDay?.id === dayItem.id && styles.dayTabTextActive]}>
                  {dayItem.name}
                </Text>
                <Text style={styles.dayTabSub}>{dayItem.exercises.length} exercícios</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={handleAddWorkoutDay}
              disabled={!canInteract}
              style={({ pressed }) => [
                styles.addDayButton,
                !canInteract && styles.disabledControl,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="plus" size={15} color="#061007" />
            </Pressable>
          </ScrollView>
        </View>

        {activeDay ? (
          <View style={styles.dayEditor}>
            <View style={styles.dayEditorTop}>
              <View style={styles.dayTitleFields}>
                <TextField
                  label="Nome do treino"
                  value={activeDay.name}
                  placeholder="Push"
                  editable={canInteract}
                  onChangeText={(value) =>
                    updateWorkoutDay(activeDay.id, (dayItem) => ({
                      ...dayItem,
                      name: value,
                    }))
                  }
                />
                <TextField
                  label="Subtitulo"
                  value={activeDay.subtitle}
                  placeholder="Peito - Ombro - Triceps"
                  editable={canInteract}
                  onChangeText={(value) =>
                    updateWorkoutDay(activeDay.id, (dayItem) => ({
                      ...dayItem,
                      subtitle: value,
                    }))
                  }
                />
              </View>

              <View style={styles.dayActions}>
                <GhostButton icon="archive" label="Salvar base" onPress={handleSaveBase} disabled={!canInteract} />
                <GhostButton
                  icon="upload-cloud"
                  label="Carregar base"
                  onPress={handleLoadBase}
                  disabled={!canInteract || !draft.baseWorkoutDays.length}
                />
                <GhostButton
                  icon="trash-2"
                  label="Excluir dia"
                  onPress={() => handleDeleteWorkoutDay(activeDay.id)}
                  disabled={!canInteract || draft.workoutDays.length <= 1}
                  danger
                />
              </View>

              <View style={styles.repRangePanel}>
                <View style={styles.repRangePanelHeader}>
                  <Text style={styles.fieldLabel}>Faixa padrão de reps</Text>
                  <Text style={styles.repRangeHelper}>{activeDayRepRange} por exercício</Text>
                </View>
                <View style={styles.chipWrap}>
                  {repRangeOptions.map((repRange) => (
                    <Chip
                      key={repRange}
                      label={repRange}
                      active={activeDayRepRange === repRange}
                      disabled={!canInteract}
                      onPress={() => applyRepRangeToDay(activeDay.id, repRange)}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.exerciseList}>
              {activeDay.exercises.map((exerciseItem, exerciseIndex) => {
                const editing = editingExerciseId === exerciseItem.id;
                const expanded = expandedExerciseId === exerciseItem.id || editing;

                return (
                  <View key={exerciseItem.id} style={styles.exerciseCard}>
                    <Pressable
                      onPress={() => setExpandedExerciseId(expanded ? null : exerciseItem.id)}
                      style={({ pressed }) => [styles.exerciseHeader, pressed && styles.pressed]}
                    >
                      <View style={styles.exerciseDrag}>
                        <MaterialCommunityIcons name="drag" size={20} color="rgba(220, 244, 200, 0.45)" />
                      </View>
                      <View style={styles.exerciseCopy}>
                        <Text style={styles.exerciseName}>{exerciseItem.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {exerciseItem.sets.length} séries · {exerciseItem.sets[0]?.reps ?? activeDayRepRange} ·{' '}
                          {muscleLabels[exerciseItem.primaryMuscle]} · {difficultyLabels[exerciseItem.difficulty]}
                        </Text>
                      </View>
                      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CF02E" />
                    </Pressable>

                    {expanded ? (
                    <>
                    <View style={styles.setChipRow}>
                      {exerciseItem.sets.map((setItem, setIndex) => (
                        <View key={setItem.id} style={styles.setChip}>
                          <Text style={styles.setChipText}>S{setIndex + 1}</Text>
                          <Text style={styles.setChipMuted}>{setItem.reps}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.exerciseActions}>
                      <GhostButton
                        icon={editing ? 'check' : 'edit-3'}
                        label={editing ? 'Fechar' : 'Editar'}
                        onPress={() => setEditingExerciseId(editing ? null : exerciseItem.id)}
                        disabled={!canInteract}
                      />
                      <GhostButton
                        icon="shuffle"
                        label="Substituicao"
                        onPress={() => setSubstitutionTarget({ dayId: activeDay.id, exerciseId: exerciseItem.id })}
                        disabled={!canInteract}
                      />
                      <GhostButton
                        icon="copy"
                        label="Copiar"
                        onPress={() => handleCopyExercise(activeDay.id, exerciseItem)}
                        disabled={!canInteract}
                      />
                      <GhostButton
                        icon="arrow-up"
                        label="Subir"
                        onPress={() => handleMoveExercise(activeDay.id, exerciseItem.id, 'up')}
                        disabled={!canInteract || exerciseIndex === 0}
                      />
                      <GhostButton
                        icon="arrow-down"
                        label="Descer"
                        onPress={() => handleMoveExercise(activeDay.id, exerciseItem.id, 'down')}
                        disabled={!canInteract || exerciseIndex === activeDay.exercises.length - 1}
                      />
                      <GhostButton
                        icon="trash-2"
                        label="Excluir"
                        onPress={() => handleDeleteExercise(activeDay.id, exerciseItem.id)}
                        disabled={!canInteract}
                        danger
                      />
                    </View>

                    {editing ? (
                      <View style={styles.exerciseEditor}>
                        <TextField
                          label="Nome do exercício"
                          value={exerciseItem.name}
                          placeholder="Supino reto"
                          editable={canInteract}
                          onChangeText={(value) =>
                            updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                              ...currentExercise,
                              name: value,
                            }))
                          }
                        />

                        <View style={styles.fieldWrap}>
                          <Text style={styles.fieldLabel}>Músculo principal</Text>
                          <View style={styles.chipWrap}>
                            {muscleOptions.map((option) => (
                              <Chip
                                key={option.value}
                                label={option.label}
                                active={exerciseItem.primaryMuscle === option.value}
                                disabled={!canInteract}
                                onPress={() =>
                                  updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                                    ...currentExercise,
                                    primaryMuscle: option.value,
                                    secondaryMuscles: currentExercise.secondaryMuscles.filter(
                                      (muscle) => muscle !== option.value,
                                    ),
                                  }))
                                }
                              />
                            ))}
                          </View>
                        </View>

                        <View style={styles.fieldWrap}>
                          <Text style={styles.fieldLabel}>Músculos secundários</Text>
                          <View style={styles.chipWrap}>
                            {muscleOptions.map((option) => {
                              const active = exerciseItem.secondaryMuscles.includes(option.value);
                              const disabled = !canInteract || option.value === exerciseItem.primaryMuscle;

                              return (
                                <Chip
                                  key={option.value}
                                  label={option.label}
                                  active={active}
                                  disabled={disabled}
                                  onPress={() =>
                                    updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                                      ...currentExercise,
                                      secondaryMuscles: active
                                        ? currentExercise.secondaryMuscles.filter((muscle) => muscle !== option.value)
                                        : [...currentExercise.secondaryMuscles, option.value],
                                    }))
                                  }
                                />
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.fieldWrap}>
                          <Text style={styles.fieldLabel}>Dificuldade</Text>
                          <View style={styles.chipWrap}>
                            {(Object.keys(difficultyLabels) as WorkoutExercise['difficulty'][]).map((difficulty) => (
                              <Chip
                                key={difficulty}
                                label={difficultyLabels[difficulty]}
                                active={exerciseItem.difficulty === difficulty}
                                disabled={!canInteract}
                                onPress={() =>
                                  updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                                    ...currentExercise,
                                    difficulty,
                                  }))
                                }
                              />
                            ))}
                          </View>
                        </View>

                        <View style={styles.seriesList}>
                          {exerciseItem.sets.map((setItem, setIndex) => (
                            <View key={setItem.id} style={styles.seriesCard}>
                              <View style={styles.seriesHeader}>
                                <Text style={styles.seriesTitle}>Série {setIndex + 1}</Text>
                                <GhostButton
                                  icon="copy"
                                  label="Copiar"
                                  onPress={() =>
                                    updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                                      ...currentExercise,
                                      sets: [
                                        ...currentExercise.sets,
                                        {
                                          ...setItem,
                                          id: createUiId('set'),
                                        },
                                      ],
                                    }))
                                  }
                                  disabled={!canInteract}
                                />
                              </View>

                              <View style={styles.fieldWrap}>
                                <Text style={styles.fieldLabel}>Tipo da serie</Text>
                                <View style={styles.setTypeSelectorGrid}>
                                  {setTypeOptions.map((option) => {
                                    const active = (setItem.setType ?? 'working') === option.id;

                                    return (
                                      <Pressable
                                        key={option.id}
                                        onPress={() =>
                                          updateSet(activeDay.id, exerciseItem.id, setItem.id, (currentSet) => ({
                                            ...currentSet,
                                            setType: option.id,
                                          }))
                                        }
                                        disabled={!canInteract}
                                        style={({ pressed }) => [
                                          styles.setTypeOption,
                                          active && styles.setTypeOptionActive,
                                          !canInteract && styles.disabledControl,
                                          pressed && styles.pressed,
                                        ]}
                                      >
                                        <MaterialCommunityIcons name={option.icon} size={14} color={active ? '#061007' : '#9CF02E'} />
                                        <View style={styles.setTypeOptionCopy}>
                                          <Text style={[styles.setTypeOptionLabel, active && styles.setTypeOptionLabelActive]}>{option.label}</Text>
                                          <Text style={[styles.setTypeOptionHelper, active && styles.setTypeOptionHelperActive]}>{option.helper}</Text>
                                        </View>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              </View>

                              <View style={styles.twoColumns}>
                                <TextField
                                  label="Reps prescritas"
                                  value={setItem.reps}
                                  placeholder="8-10"
                                  editable={canInteract}
                                  compact
                                  onChangeText={(value) =>
                                    updateSet(activeDay.id, exerciseItem.id, setItem.id, (currentSet) => ({
                                      ...currentSet,
                                      reps: value,
                                    }))
                                  }
                                />
                                <TextField
                                  label="% carga total"
                                  value={setItem.loadPercent}
                                  placeholder="100"
                                  keyboardType="numeric"
                                  editable={canInteract}
                                  compact
                                  onChangeText={(value) =>
                                    updateSet(activeDay.id, exerciseItem.id, setItem.id, (currentSet) => ({
                                      ...currentSet,
                                      loadPercent: value,
                                    }))
                                  }
                                />
                              </View>

                              <TextField
                                label="Instrução para o aluno"
                                value={setItem.instruction}
                                placeholder="Ex.: pausa de 1s no alongamento, controlar descida."
                                multiline
                                editable={canInteract}
                                compact
                                onChangeText={(value) =>
                                  updateSet(activeDay.id, exerciseItem.id, setItem.id, (currentSet) => ({
                                    ...currentSet,
                                    instruction: value,
                                  }))
                                }
                              />

                              <View style={styles.seriesFooter}>
                                <View style={[styles.fieldWrap, styles.seriesFooterField]}>
                                  <Text style={styles.fieldLabel}>RIR prescrito</Text>
                                  <View style={styles.chipWrap}>
                                    {rirOptions.map((rir) => (
                                      <Chip
                                        key={rir || 'empty'}
                                        label={rir || '-'}
                                        active={setItem.rir === rir}
                                        disabled={!canInteract}
                                        onPress={() =>
                                          updateSet(activeDay.id, exerciseItem.id, setItem.id, (currentSet) => ({
                                            ...currentSet,
                                            rir,
                                          }))
                                        }
                                      />
                                    ))}
                                  </View>
                                </View>
                                <View style={styles.seriesFooterAction}>
                                  <GhostButton
                                    icon="trash-2"
                                    label="Remover série"
                                    onPress={() =>
                                      updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                                        ...currentExercise,
                                        sets:
                                          currentExercise.sets.length > 1
                                            ? currentExercise.sets.filter((item) => item.id !== setItem.id)
                                            : currentExercise.sets,
                                      }))
                                    }
                                    disabled={!canInteract || exerciseItem.sets.length <= 1}
                                    danger
                                  />
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>

                        <GhostButton
                          icon="plus"
                          label="Adicionar série"
                          onPress={() =>
                            updateExercise(activeDay.id, exerciseItem.id, (currentExercise) => ({
                              ...currentExercise,
                              sets: [
                                ...currentExercise.sets,
                                createWorkoutSet(currentExercise.sets[currentExercise.sets.length - 1]?.reps ?? '10-12'),
                              ],
                            }))
                          }
                          disabled={!canInteract}
                        />
                      </View>
                    ) : null}
                    </>
                    ) : (
                      <Pressable
                        onPress={() => setExpandedExerciseId(exerciseItem.id)}
                        style={({ pressed }) => [styles.compactExerciseFooter, pressed && styles.pressed]}
                      >
                        <Text style={styles.compactExerciseText}>Toque para abrir ações, séries e substituições</Text>
                        <View style={styles.compactExerciseBadge}>
                          <Text style={styles.compactExerciseBadgeText}>{exerciseItem.sets.length} séries</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            {substitutionExercise && substitutionTarget ? (
              <View style={styles.substitutionPanel}>
                <View style={styles.substitutionTop}>
                  <View>
                    <Text style={styles.kicker}>Substituicao inteligente</Text>
                    <Text style={styles.substitutionTitle}>{substitutionExercise.name}</Text>
                    <Text style={styles.substitutionText}>
                      Escolha uma alternativa. O app preserva séries, reps, cargas e RIR do exercício original.
                    </Text>
                  </View>
                  <Pressable onPress={() => setSubstitutionTarget(null)} style={styles.closeButton}>
                    <Feather name="x" size={16} color="#DCF4C8" />
                  </Pressable>
                </View>

                <View style={styles.warningBox}>
                  <Feather name="alert-triangle" size={15} color="#FBBF24" />
                  <Text style={styles.warningText}>
                    Quando a anamnese estiver completa, esta sugestão poderá considerar dores, equipamentos e preferências.
                  </Text>
                </View>

                <View style={styles.alternativeList}>
                  {(exerciseAlternatives[substitutionExercise.primaryMuscle] ?? []).map((alternative, index) => (
                    <Pressable
                      key={alternative.name}
                      onPress={() => handleSubstituteExercise(alternative)}
                      style={({ pressed }) => [styles.alternativeCard, pressed && styles.pressed]}
                    >
                      <View style={styles.alternativeScore}>
                        <Text style={styles.alternativeScoreText}>{96 - index * 4}%</Text>
                      </View>
                      <View style={styles.alternativeCopy}>
                        <Text style={styles.alternativeTitle}>{alternative.name}</Text>
                        <Text style={styles.alternativeText}>
                          {muscleLabels[alternative.primaryMuscle]} - {difficultyLabels[alternative.difficulty]}
                        </Text>
                      </View>
                      <Feather name="check" size={16} color="#9CF02E" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {addExerciseOpen ? (
              <View style={styles.addExerciseBox}>
                <Text style={styles.addExerciseTitle}>Adicionar exercício</Text>
                <View style={styles.twoColumns}>
                  <TextField
                    label="Nome"
                    value={newExercise.name}
                    placeholder="Ex.: Supino inclinado"
                    editable={canInteract}
                    onChangeText={(value) => setNewExercise((current) => ({ ...current, name: value }))}
                  />
                  <TextField
                    label="Series"
                    value={newExercise.sets}
                    placeholder="3"
                    keyboardType="numeric"
                    editable={canInteract}
                    onChangeText={(value) => setNewExercise((current) => ({ ...current, sets: value }))}
                  />
                  <TextField
                    label="Reps / Intensidade"
                    value={newExercise.reps}
                    placeholder="10-12"
                    editable={canInteract}
                    onChangeText={(value) => setNewExercise((current) => ({ ...current, reps: value }))}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Músculo principal</Text>
                  <View style={styles.chipWrap}>
                    {muscleOptions.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        active={newExercise.primaryMuscle === option.value}
                        disabled={!canInteract}
                        onPress={() => setNewExercise((current) => ({ ...current, primaryMuscle: option.value }))}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.formActions}>
                  <GhostButton
                    icon="x"
                    label="Cancelar"
                    onPress={() => setAddExerciseOpen(false)}
                    disabled={!canInteract}
                  />
                  <PrimaryButton icon="plus" label="Adicionar" onPress={handleAddExercise} disabled={!canInteract} />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setNewExercise((current) => ({ ...current, reps: activeDayRepRange }));
                  setAddExerciseOpen(true);
                }}
                disabled={!canInteract}
                style={({ pressed }) => [
                  styles.addExerciseButton,
                  !canInteract && styles.disabledControl,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="plus" size={16} color="#061007" />
                <Text style={styles.addExerciseButtonText}>Adicionar exercício</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  trainingStack: {
    gap: 14,
  },
  hero: {
    gap: 16,
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    boxShadow: '0 22px 60px rgba(0, 0, 0, 0.44)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 66,
    height: 66,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  heroCopy: {
    flex: 1,
    gap: 5,
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F3F7EF',
    fontSize: 22,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.45,
  },
  heroText: {
    color: 'rgba(222, 236, 214, 0.7)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  heroStat: {
    flexGrow: 1,
    flexBasis: 90,
    gap: 3,
    padding: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroStatValue: {
    color: '#F3F7EF',
    fontSize: 17,
    fontFamily: 'Sora_800ExtraBold',
  },
  heroStatLabel: {
    color: 'rgba(222, 236, 214, 0.56)',
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  sectionCard: {
    gap: 12,
    padding: 12,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: '#F3F7EF',
    fontSize: 17,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.25,
  },
  sectionDescription: {
    color: 'rgba(222, 236, 214, 0.62)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  sectionChevron: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  builderTabs: {
    gap: 8,
    paddingRight: 8,
  },
  builderTab: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  builderTabActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
    boxShadow: '0 12px 26px rgba(156, 240, 46, 0.22)',
  },
  builderTabText: {
    color: '#DFFFBA',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  builderTabTextActive: {
    color: '#061007',
  },
  customWorkoutCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  customWorkoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  customWorkoutCopy: {
    flex: 1,
    gap: 4,
  },
  customWorkoutTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_800ExtraBold',
  },
  customWorkoutText: {
    color: 'rgba(222, 236, 214, 0.66)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    flexGrow: 1,
    flexBasis: 170,
    minHeight: 142,
    gap: 9,
    padding: 12,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.13)',
  },
  templateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  templateMark: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  templatePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.09)',
  },
  templatePillText: {
    color: '#9CF02E',
    fontSize: 9,
    fontFamily: 'Sora_800ExtraBold',
    textTransform: 'uppercase',
  },
  templateTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_800ExtraBold',
  },
  templateText: {
    flex: 1,
    color: 'rgba(222, 236, 214, 0.62)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Sora_400Regular',
  },
  templateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templateActionText: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  volumeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#9CF02E',
  },
  legendText: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 9,
    fontFamily: 'Sora_700Bold',
  },
  volumeList: {
    gap: 11,
  },
  volumeRow: {
    gap: 7,
  },
  volumeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  volumeName: {
    color: '#F3F7EF',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  volumeStatus: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
  },
  volumeTrack: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  volumeBar: {
    height: 9,
    borderRadius: 999,
  },
  progressBox: {
    gap: 10,
  },
  horizontalChips: {
    gap: 8,
    paddingRight: 6,
  },
  historyCard: {
    gap: 6,
    padding: 13,
    borderRadius: 19,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  historyTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  historyText: {
    color: 'rgba(222, 236, 214, 0.65)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  historyList: {
    gap: 9,
  },
  historyRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  historyRowTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  historyRowText: {
    color: 'rgba(222, 236, 214, 0.56)',
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  repRangePanel: {
    gap: 8,
    padding: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  repRangePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  repRangeHelper: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  fieldWrap: {
    flexGrow: 1,
    flexBasis: 160,
    gap: 6,
  },
  fieldWrapCompact: {
    gap: 4,
  },
  fieldLabel: {
    color: '#EAF8E4',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  input: {
    minHeight: 48,
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_500Medium',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  inputCompact: {
    minHeight: 42,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    fontSize: 12,
  },
  inputDisabled: {
    opacity: 0.65,
  },
  textArea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  textAreaCompact: {
    minHeight: 70,
  },
  twoColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  chipText: {
    color: '#DCF4C8',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  chipTextActive: {
    color: '#061007',
  },
  setTypeSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setTypeOption: {
    flexGrow: 1,
    flexBasis: 126,
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  setTypeOptionActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  setTypeOptionCopy: {
    flex: 1,
    gap: 1,
  },
  setTypeOptionLabel: {
    color: '#F3F7EF',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  setTypeOptionLabelActive: {
    color: '#061007',
  },
  setTypeOptionHelper: {
    color: 'rgba(222, 236, 214, 0.52)',
    fontSize: 8,
    fontFamily: 'Sora_600SemiBold',
  },
  setTypeOptionHelperActive: {
    color: 'rgba(6, 16, 7, 0.72)',
  },
  previewCard: {
    gap: 5,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.13)',
  },
  previewTitle: {
    color: '#F3F7EF',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  previewText: {
    color: '#9CF02E',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  previewMuted: {
    color: 'rgba(222, 236, 214, 0.62)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  weekList: {
    gap: 10,
  },
  weekRow: {
    gap: 8,
    padding: 11,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  weekdayName: {
    color: '#F3F7EF',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  weekChoices: {
    gap: 8,
    paddingRight: 4,
  },
  dayTabsHeader: {
    gap: 10,
  },
  dayTabs: {
    gap: 8,
    paddingRight: 8,
  },
  dayTab: {
    minWidth: 128,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayTabActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderColor: 'rgba(156, 240, 46, 0.36)',
  },
  dayTabText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  dayTabTextActive: {
    color: '#F3F7EF',
  },
  dayTabSub: {
    color: 'rgba(222, 236, 214, 0.54)',
    fontSize: 9,
    fontFamily: 'Sora_600SemiBold',
  },
  addDayButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#9CF02E',
  },
  dayEditor: {
    gap: 12,
  },
  dayEditorTop: {
    gap: 10,
  },
  dayTitleFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseList: {
    gap: 10,
  },
  exerciseCard: {
    gap: 10,
    padding: 10,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseDrag: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  exerciseCopy: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_800ExtraBold',
  },
  exerciseMeta: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Sora_600SemiBold',
  },
  setChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  setChipText: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  setChipMuted: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
  },
  exerciseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactExerciseFooter: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(156, 240, 46, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  compactExerciseText: {
    flex: 1,
    color: 'rgba(222, 236, 214, 0.64)',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Sora_700Bold',
  },
  compactExerciseBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
  },
  compactExerciseBadgeText: {
    color: '#9CF02E',
    fontSize: 9,
    fontFamily: 'Sora_800ExtraBold',
  },
  exerciseEditor: {
    gap: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.13)',
  },
  seriesList: {
    gap: 8,
  },
  seriesCard: {
    gap: 8,
    padding: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  seriesTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  seriesFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  seriesFooterField: {
    flexGrow: 1,
    flexBasis: 220,
  },
  seriesFooterAction: {
    alignSelf: 'flex-start',
  },
  substitutionPanel: {
    gap: 12,
    padding: 13,
    borderRadius: 23,
    backgroundColor: 'rgba(10, 18, 10, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
  },
  substitutionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  substitutionTitle: {
    color: '#F3F7EF',
    fontSize: 16,
    fontFamily: 'Sora_800ExtraBold',
  },
  substitutionText: {
    color: 'rgba(222, 236, 214, 0.62)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 11,
    borderRadius: 17,
    backgroundColor: 'rgba(251, 191, 36, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.16)',
  },
  warningText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  alternativeList: {
    gap: 8,
  },
  alternativeCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.13)',
  },
  alternativeScore: {
    minWidth: 48,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#9CF02E',
  },
  alternativeScoreText: {
    color: '#061007',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  alternativeCopy: {
    flex: 1,
    gap: 3,
  },
  alternativeTitle: {
    color: '#F3F7EF',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  alternativeText: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  addExerciseBox: {
    gap: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  addExerciseTitle: {
    color: '#F3F7EF',
    fontSize: 15,
    fontFamily: 'Sora_800ExtraBold',
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  addExerciseButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
  },
  addExerciseButtonText: {
    color: '#061007',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    boxShadow: '0 16px 34px rgba(156, 240, 46, 0.24)',
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  ghostButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  ghostButtonDanger: {
    borderColor: 'rgba(255, 180, 168, 0.18)',
  },
  ghostButtonText: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
  },
  ghostButtonDangerText: {
    color: '#FFB4A8',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  readOnlyText: {
    flex: 1,
    color: 'rgba(222, 236, 214, 0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_600SemiBold',
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 108, 92, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 108, 92, 0.18)',
  },
  errorText: {
    flex: 1,
    color: '#FFB4A8',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_600SemiBold',
  },
  feedbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.15)',
  },
  feedbackText: {
    flex: 1,
    color: '#DFFFBA',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_700Bold',
  },
  emptyPanel: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  emptyTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
  },
  emptyText: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  loadingPanel: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  loadingText: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabledControl: {
    opacity: 0.56,
  },
});
