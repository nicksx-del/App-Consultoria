import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { cardioIntensityLabels, muscleLabels } from '../lib/training';
import { calculateWorkoutSessionProgress } from '../lib/studentExecution';
import type { Student } from '../types/student';
import type { CardioIntensity, StudentTrainingPlan, WorkoutDay, WorkoutExercise, WorkoutSet, WorkoutSetType } from '../types/training';
import type {
  SaveCardioLogPayload,
  StudentCardioLog,
  StudentWorkoutSession,
  WorkoutExerciseExecutionLog,
  WorkoutSetExecutionLog,
} from '../types/studentExecution';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type SetField = 'weight' | 'reps' | 'actualRir' | 'executionQuality' | 'notes';
type RunnerMode = 'training' | 'cardio' | 'exercises';
type ExerciseFilter = 'all' | 'chest' | 'back' | 'arms' | 'shoulders' | 'legs' | 'core';

type RestTimerState = {
  exerciseId: string;
  setId: string;
  exerciseName: string;
  setLabel: string;
  startedAtMs: number;
  elapsedSeconds: number;
};

type StudentWorkoutRunnerProps = {
  student: Student;
  plan: StudentTrainingPlan | null;
  sessions: StudentWorkoutSession[];
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  cardioLogs: StudentCardioLog[];
  cardioLogsLoading: boolean;
  cardioLogSaving: boolean;
  cardioLogError?: string | null;
  onStartSession: (workoutDay: WorkoutDay) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onSaveSession: (session: StudentWorkoutSession) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onFinishSession: (session: StudentWorkoutSession) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onSaveCardioLog: (payload: SaveCardioLogPayload) => Promise<StudentCardioLog | void> | StudentCardioLog | void;
  onRefreshCardioLogs: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

type ExerciseHistoryPoint = {
  sessionId: string;
  date: string;
  workoutDayName: string;
  bestWeight: number;
  bestReps: number;
  bestOneRepMax: number;
  bestSetVolume: number;
  completedSets: number;
};

type ExerciseObject = {
  key: string;
  name: string;
  primaryMuscle: string;
  workoutDays: string[];
  plannedSets: number;
  sessionsCount: number;
  bestWeight: number;
  bestOneRepMax: number;
  bestSetVolume: number;
  bestReps: number;
  history: ExerciseHistoryPoint[];
};

type ExerciseRecordSummary = {
  key: string;
  exerciseName: string;
  completedSets: number;
  bestWeight: number;
  bestOneRepMax: number;
  bestSetVolume: number;
  bestReps: number;
};

type FocusSetItem = {
  key: string;
  exercise: WorkoutExerciseExecutionLog;
  set: WorkoutSetExecutionLog;
  exerciseIndex: number;
  setIndex: number;
  globalIndex: number;
};

type TrophyEvent = {
  kind: 'first' | 'weight' | 'oneRepMax' | 'setVolume';
  label: string;
  value: string;
  icon: IconName;
};

type TrophyToast = {
  id: number;
  exerciseName: string;
  trophies: TrophyEvent[];
};

type WorkoutTrophyResult = {
  id: string;
  exerciseName: string;
  trophy: TrophyEvent;
};

type ExerciseTransitionToast = {
  id: number;
  exerciseName: string;
  exerciseIndex: number;
  totalExercises: number;
};

type WorkoutCompletionSummary = {
  workoutDayName: string;
  finishedAt: string;
  durationSeconds: number | null;
  completedSets: number;
  totalSets: number;
  completedExercises: number;
  totalExercises: number;
  totalVolume: number;
  totalReps: number;
  bestSetVolume: number;
  bestSetLabel: string;
  trophies: WorkoutTrophyResult[];
};

const exerciseFilterOptions: Array<{ id: ExerciseFilter; label: string; icon: IconName }> = [
  { id: 'all', label: 'Todos', icon: 'database-search-outline' },
  { id: 'chest', label: 'Peito', icon: 'human-male-board' },
  { id: 'back', label: 'Costas', icon: 'human-handsdown' },
  { id: 'arms', label: 'Bracos', icon: 'arm-flex-outline' },
  { id: 'shoulders', label: 'Ombros', icon: 'human-handsup' },
  { id: 'legs', label: 'Pernas', icon: 'run' },
  { id: 'core', label: 'Abdomen', icon: 'target' },
];

const cardioIntensityOptions: Array<{ id: CardioIntensity; label: string; helper: string; range: string; icon: IconName }> = [
  { id: 'light', label: 'Leve', helper: 'Recuperacao e base', range: '50-60%', icon: 'leaf' },
  { id: 'moderate', label: 'Moderado', helper: 'Zona 2 e condicionamento', range: '60-75%', icon: 'run' },
  { id: 'vigorous', label: 'Forte', helper: 'Estimulo intenso', range: '75-88%', icon: 'fire' },
];

const rirOptions: Array<{ id: string; label: string; helper: string }> = [
  { id: '0', label: '0', helper: 'Falha' },
  { id: '1', label: '1', helper: 'Quase' },
  { id: '2', label: '2', helper: 'Controle' },
  { id: '3', label: '3', helper: 'Seguro' },
  { id: '4+', label: '4+', helper: 'Sobrou' },
];

const executionQualityOptions: Array<{ id: string; label: string; helper: string; icon: IconName }> = [
  { id: 'needs_adjustment', label: 'Ajustar', helper: 'Perdeu controle', icon: 'alert-circle-outline' },
  { id: 'solid', label: 'Boa', helper: 'Execucao limpa', icon: 'check-circle-outline' },
  { id: 'strong', label: 'Forte', helper: 'Estavel e firme', icon: 'arm-flex-outline' },
  { id: 'perfect', label: 'Perfeita', helper: 'Tecnica alta', icon: 'star-four-points-outline' },
];

const workoutSetTypeMeta: Record<WorkoutSetType, { label: string; icon: IconName; helper: string }> = {
  working: { label: 'Valida', icon: 'check', helper: 'Série principal' },
  warmup: { label: 'Aquecimento', icon: 'fire', helper: 'Preparar articulacoes e carga' },
  preparatory: { label: 'Preparatoria', icon: 'flag-checkered', helper: 'Rampa antes das séries fortes' },
  biset: { label: 'Bi-set', icon: 'link-variant', helper: 'Combinada com o proximo exercicio' },
  dropset: { label: 'Drop-set', icon: 'arrow-down-bold-circle-outline', helper: 'Reduza carga e continue' },
  failure: { label: 'Falha', icon: 'alert-octagon-outline', helper: 'Levar ate a falha tecnica' },
};

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return '--';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatTimer(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  return [hours, minutes, rest].map((value) => String(value).padStart(2, '0')).join(':');
}

function normalizeRirOption(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');

  if (!normalized) {
    return '';
  }

  if (normalized.includes('4')) {
    return '4+';
  }

  const firstDigit = normalized.match(/[0-3]/)?.[0];
  return firstDigit ?? '';
}

function defaultRirFromTarget(value: string) {
  return normalizeRirOption(value) || '2';
}

function executionQualityMeta(value: string) {
  return executionQualityOptions.find((option) => option.id === value) ?? executionQualityOptions[1];
}

function formatCardioMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekStartIsoDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return localIsoDate(date);
}

function parseDecimalInput(value: string) {
  const parsed = Number(value.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function isoDateLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  return sessionDate(value);
}

function normalizeExerciseKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseTrainingNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) {
    return 0;
  }

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function formatWeight(value: number) {
  return value ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : '--';
}

function formatVolume(value: number) {
  return value ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg` : '--';
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function getExerciseFilter(primaryMuscle: string): ExerciseFilter {
  if (primaryMuscle === 'chest') {
    return 'chest';
  }

  if (primaryMuscle === 'back') {
    return 'back';
  }

  if (primaryMuscle === 'shoulders') {
    return 'shoulders';
  }

  if (primaryMuscle === 'biceps' || primaryMuscle === 'triceps') {
    return 'arms';
  }

  if (primaryMuscle === 'quads' || primaryMuscle === 'hamstrings' || primaryMuscle === 'glutes' || primaryMuscle === 'calves') {
    return 'legs';
  }

  if (primaryMuscle === 'abs') {
    return 'core';
  }

  return 'all';
}

function normalizeWorkoutSetType(value: string | undefined): WorkoutSetType | null {
  return value && value in workoutSetTypeMeta ? (value as WorkoutSetType) : null;
}

function setKind(set: Pick<WorkoutSetExecutionLog, 'targetLoadPercent' | 'targetRir' | 'targetSetType'> | WorkoutSet) {
  const percent = 'targetLoadPercent' in set ? set.targetLoadPercent : set.loadPercent;
  const rir = 'targetRir' in set ? set.targetRir : set.rir;
  const explicitType =
    'targetSetType' in set ? normalizeWorkoutSetType(set.targetSetType) : normalizeWorkoutSetType(set.setType);
  const numberPercent = Number(String(percent).replace(',', '.'));
  const warmup = Number.isFinite(numberPercent) && numberPercent < 75;
  const meta = explicitType ? workoutSetTypeMeta[explicitType] : workoutSetTypeMeta[warmup ? 'warmup' : 'working'];

  return {
    label: meta.label,
    icon: meta.icon,
    helper: meta.helper,
    percent: percent ? `${percent}%` : 'Livre',
    rir: rir ? `RIR ${rir}` : 'RIR livre',
  };
}

function planSetTargetText(set: WorkoutSet) {
  const meta = setKind(set);
  const chunks = [meta.percent, set.reps ? `${set.reps}` : null, meta.rir].filter(Boolean);
  return chunks.join(' / ');
}

function executionSetTargetText(set: WorkoutSetExecutionLog) {
  const meta = setKind(set);
  const chunks = [meta.percent, set.targetReps ? `${set.targetReps}` : null, meta.rir].filter(Boolean);
  return chunks.join(' / ');
}

function focusSetKey(exerciseId: string, setId: string) {
  return `${exerciseId}:${setId}`;
}

function buildFocusItems(session: StudentWorkoutSession | null): FocusSetItem[] {
  if (!session) {
    return [];
  }

  let globalIndex = 0;
  return session.exerciseLogs.flatMap((exercise, exerciseIndex) =>
    exercise.sets.map((set, setIndex) => ({
      key: focusSetKey(exercise.exerciseId, set.setId),
      exercise,
      set,
      exerciseIndex,
      setIndex,
      globalIndex: globalIndex++,
    })),
  );
}

function findNextPendingItem(items: FocusSetItem[], currentKey: string) {
  if (!items.length) {
    return null;
  }

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.key === currentKey),
  );
  const ordered = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)];
  return ordered.find((item) => !item.set.completed) ?? items[currentIndex] ?? items[0];
}

function moveFocusItem(items: FocusSetItem[], currentKey: string, direction: 'previous' | 'next') {
  if (!items.length) {
    return null;
  }

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.key === currentKey),
  );
  const nextIndex =
    direction === 'next'
      ? Math.min(items.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

  return items[nextIndex] ?? items[0];
}

function firstFocusKeyForExercise(exercise: WorkoutExerciseExecutionLog) {
  const nextSet = exercise.sets.find((set) => !set.completed) ?? exercise.sets[0];
  return nextSet ? focusSetKey(exercise.exerciseId, nextSet.setId) : null;
}

function emptyRecordSummary(exerciseName: string): ExerciseRecordSummary {
  return {
    key: normalizeExerciseKey(exerciseName),
    exerciseName,
    completedSets: 0,
    bestWeight: 0,
    bestOneRepMax: 0,
    bestSetVolume: 0,
    bestReps: 0,
  };
}

function addSetToRecords(
  records: Map<string, ExerciseRecordSummary>,
  exerciseName: string,
  set: WorkoutSetExecutionLog,
  includeLoggedValues = false,
) {
  const weight = parseTrainingNumber(set.weight);
  const reps = parseTrainingNumber(set.reps);

  if ((!set.completed && !includeLoggedValues) || (!weight && !reps)) {
    return;
  }

  const key = normalizeExerciseKey(exerciseName);
  const current = records.get(key) ?? emptyRecordSummary(exerciseName);
  const oneRepMax = estimateOneRepMax(weight, reps);
  const setVolume = weight * reps;

  records.set(key, {
    ...current,
    completedSets: current.completedSets + 1,
    bestWeight: Math.max(current.bestWeight, weight),
    bestOneRepMax: Math.max(current.bestOneRepMax, oneRepMax),
    bestSetVolume: Math.max(current.bestSetVolume, setVolume),
    bestReps: Math.max(current.bestReps, reps),
  });
}

function buildExerciseRecordMap(sessions: StudentWorkoutSession[], currentSession: StudentWorkoutSession | null) {
  const records = new Map<string, ExerciseRecordSummary>();
  const completedSessions = sessions.filter(
    (session) => session.status === 'completed' && session.id !== currentSession?.id,
  );
  const sourceSessions = currentSession ? [...completedSessions, currentSession] : completedSessions;

  sourceSessions.forEach((session) => {
    session.exerciseLogs.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        addSetToRecords(records, exercise.exerciseName, set, session.status === 'completed');
      });
    });
  });

  return records;
}

function buildHistoricalExerciseRecordMap(sessions: StudentWorkoutSession[], currentSessionId: string) {
  const records = new Map<string, ExerciseRecordSummary>();

  sessions
    .filter((session) => session.status === 'completed' && session.id !== currentSessionId)
    .forEach((session) => {
      session.exerciseLogs.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          addSetToRecords(records, exercise.exerciseName, set, true);
        });
      });
    });

  return records;
}

function detectTrophies(record: ExerciseRecordSummary | undefined, set: WorkoutSetExecutionLog): TrophyEvent[] {
  const weight = parseTrainingNumber(set.weight);
  const reps = parseTrainingNumber(set.reps);
  const oneRepMax = estimateOneRepMax(weight, reps);
  const setVolume = weight * reps;
  const hasMetric = weight > 0 || reps > 0;

  if (!hasMetric) {
    return [];
  }

  const baseline = record ?? emptyRecordSummary('');
  const trophies: TrophyEvent[] = [];

  if (!baseline.completedSets) {
    trophies.push({
      kind: 'first',
      label: 'Primeiro registro',
      value: 'Histórico iniciado',
      icon: 'trophy-outline',
    });
  }

  if (weight > 0 && weight > baseline.bestWeight) {
    trophies.push({
      kind: 'weight',
      label: 'Maior carga',
      value: formatWeight(weight),
      icon: 'weight',
    });
  }

  if (oneRepMax > 0 && oneRepMax > baseline.bestOneRepMax) {
    trophies.push({
      kind: 'oneRepMax',
      label: 'Maior 1RM',
      value: formatWeight(oneRepMax),
      icon: 'chart-line',
    });
  }

  if (setVolume > 0 && setVolume > baseline.bestSetVolume) {
    trophies.push({
      kind: 'setVolume',
      label: 'Maior volume de série',
      value: formatVolume(setVolume),
      icon: 'chart-bar',
    });
  }

  return trophies;
}

function collectSessionTrophies(session: StudentWorkoutSession, sessions: StudentWorkoutSession[]): WorkoutTrophyResult[] {
  const records = buildHistoricalExerciseRecordMap(sessions, session.id);
  const trophies: WorkoutTrophyResult[] = [];

  session.exerciseLogs.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      if (!set.completed) {
        return;
      }

      const exerciseKey = normalizeExerciseKey(exercise.exerciseName);
      const nextTrophies = detectTrophies(records.get(exerciseKey), set);

      nextTrophies.forEach((trophy) => {
        trophies.push({
          id: `${exercise.exerciseId}-${set.setId}-${trophy.kind}`,
          exerciseName: exercise.exerciseName,
          trophy,
        });
      });

      addSetToRecords(records, exercise.exerciseName, set, true);
    });
  });

  return trophies;
}

function buildWorkoutCompletionSummary(session: StudentWorkoutSession, sessions: StudentWorkoutSession[]): WorkoutCompletionSummary {
  let totalVolume = 0;
  let totalReps = 0;
  let bestSetVolume = 0;
  let bestSetLabel = '--';
  const completedExercises = new Set<string>();
  const totalSets = session.exerciseLogs.reduce((total, exercise) => total + exercise.sets.length, 0);

  session.exerciseLogs.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const weight = parseTrainingNumber(set.weight);
      const reps = parseTrainingNumber(set.reps);
      const setVolume = weight * reps;

      if (!set.completed && !weight && !reps) {
        return;
      }

      if (set.completed) {
        completedExercises.add(exercise.exerciseId);
      }

      totalVolume += setVolume;
      totalReps += reps;

      if (setVolume > bestSetVolume) {
        bestSetVolume = setVolume;
        bestSetLabel = `${exercise.exerciseName} / S${set.setIndex} / ${formatWeight(weight)} x ${reps || '--'}`;
      }
    });
  });

  return {
    workoutDayName: session.workoutDayName,
    finishedAt: session.completedAt ?? new Date().toISOString(),
    durationSeconds: session.durationSeconds,
    completedSets: session.exerciseLogs.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0,
    ),
    totalSets,
    completedExercises: completedExercises.size,
    totalExercises: session.exerciseLogs.length,
    totalVolume,
    totalReps,
    bestSetVolume,
    bestSetLabel,
    trophies: collectSessionTrophies(session, sessions),
  };
}

function TrophyToastCard({ toast, onDismiss }: { toast: TrophyToast; onDismiss: () => void }) {
  const extraCount = Math.max(0, toast.trophies.length - 2);

  return (
    <Pressable onPress={onDismiss} style={({ pressed }) => [styles.trophyToast, pressed && styles.pressed]}>
      <View style={styles.trophyToastIcon}>
        <MaterialCommunityIcons name="trophy-outline" size={22} color="#061007" />
      </View>
      <View style={styles.trophyToastCopy}>
        <Text style={styles.kicker}>Novo trofeu</Text>
        <Text style={styles.trophyToastTitle}>{toast.exerciseName}</Text>
        <View style={styles.trophyToastList}>
          {toast.trophies.slice(0, 2).map((trophy) => (
            <View key={trophy.kind} style={styles.trophyToastPill}>
              <MaterialCommunityIcons name={trophy.icon} size={12} color="#9CF02E" />
              <Text style={styles.trophyToastText}>
                {trophy.label}: {trophy.value}
              </Text>
            </View>
          ))}
          {extraCount ? <Text style={styles.trophyToastMore}>+{extraCount} PR</Text> : null}
        </View>
      </View>
      <Feather name="x" size={15} color="#BCEAA9" />
    </Pressable>
  );
}

function ExerciseTransitionToastCard({
  toast,
  onDismiss,
}: {
  toast: ExerciseTransitionToast;
  onDismiss: () => void;
}) {
  return (
    <Pressable onPress={onDismiss} style={({ pressed }) => [styles.exerciseTransitionToast, pressed && styles.pressed]}>
      <View style={styles.exerciseTransitionIcon}>
        <MaterialCommunityIcons name="arrow-right-bold-circle-outline" size={24} color="#061007" />
      </View>
      <View style={styles.exerciseTransitionCopy}>
        <Text style={styles.kicker}>Proximo exercicio</Text>
        <Text style={styles.exerciseTransitionTitle}>Agora vamos para</Text>
        <Text style={styles.exerciseTransitionName}>{toast.exerciseName}</Text>
      </View>
      <View style={styles.exerciseTransitionCounter}>
        <Text style={styles.exerciseTransitionCounterText}>
          {toast.exerciseIndex}/{toast.totalExercises}
        </Text>
      </View>
    </Pressable>
  );
}

function RecordMiniTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordMiniTile}>
      <Text style={styles.recordMiniValue}>{value}</Text>
      <Text style={styles.recordMiniLabel}>{label}</Text>
    </View>
  );
}

function CompletionMetric({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <View style={styles.completionMetric}>
      <MaterialCommunityIcons name={icon} size={16} color="#9CF02E" />
      <Text style={styles.completionMetricValue}>{value}</Text>
      <Text style={styles.completionMetricLabel}>{label}</Text>
    </View>
  );
}

function WorkoutCompletionCard({
  summary,
  cardRef,
  sharing,
  shareError,
  onShare,
  onClose,
}: {
  summary: WorkoutCompletionSummary;
  cardRef: RefObject<View | null>;
  sharing: boolean;
  shareError: string | null;
  onShare: () => void;
  onClose: () => void;
}) {
  const topTrophies = summary.trophies.slice(0, 4);

  return (
    <View style={styles.completionPanel}>
      <View ref={cardRef} collapsable={false} style={styles.completionCaptureFrame}>
        <LinearGradient
          colors={['rgba(156, 240, 46, 0.24)', 'rgba(5, 12, 6, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.completionShareCard}
        >
          <View style={styles.completionHeader}>
            <View style={styles.completionMark}>
              <MaterialCommunityIcons name="trophy-outline" size={27} color="#061007" />
            </View>
            <View style={styles.completionHeaderCopy}>
              <Text style={styles.kicker}>Treino finalizado</Text>
              <Text style={styles.completionTitle}>{summary.workoutDayName}</Text>
              <Text style={styles.completionSubtitle}>{sessionDate(summary.finishedAt)} / Aplicativo-Consultoria</Text>
            </View>
          </View>

          <View style={styles.completionHeroStat}>
            <Text style={styles.completionHeroLabel}>Carga total movimentada</Text>
            <Text style={styles.completionHeroValue}>{formatVolume(summary.totalVolume)}</Text>
            <Text style={styles.completionHeroHelper}>soma de carga x repetições nas séries registradas</Text>
          </View>

          <View style={styles.completionMetricsGrid}>
            <CompletionMetric icon="format-list-checks" label="Séries" value={`${summary.completedSets}/${summary.totalSets}`} />
            <CompletionMetric icon="weight-lifter" label="Exercícios" value={`${summary.completedExercises}/${summary.totalExercises}`} />
            <CompletionMetric icon="repeat" label="Reps totais" value={String(summary.totalReps)} />
            <CompletionMetric icon="timer-outline" label="Duração" value={formatDuration(summary.durationSeconds)} />
          </View>

          <View style={styles.completionBestSet}>
            <MaterialCommunityIcons name="star-four-points-outline" size={18} color="#9CF02E" />
            <View style={styles.completionBestSetCopy}>
            <Text style={styles.completionBestSetLabel}>Melhor série por volume</Text>
              <Text style={styles.completionBestSetText}>{summary.bestSetLabel}</Text>
            </View>
          </View>

          <View style={styles.completionRecords}>
            <Text style={styles.completionSectionTitle}>Recordes do treino</Text>
            {topTrophies.length ? (
              <View style={styles.completionRecordList}>
                {topTrophies.map((item) => (
                  <View key={item.id} style={styles.completionRecordItem}>
                    <MaterialCommunityIcons name={item.trophy.icon} size={14} color="#9CF02E" />
                    <Text style={styles.completionRecordText}>
                      {item.trophy.label} / {item.exerciseName} / {item.trophy.value}
                    </Text>
                  </View>
                ))}
                {summary.trophies.length > topTrophies.length ? (
                  <Text style={styles.completionRecordMore}>+{summary.trophies.length - topTrophies.length} recorde(s)</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.completionNoRecords}>Sem recordes novos. Consistencia tambem conta.</Text>
            )}
          </View>
        </LinearGradient>
      </View>

      <View style={styles.completionActions}>
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={({ pressed }) => [styles.completionShareButton, sharing && styles.disabled, pressed && !sharing && styles.pressed]}
        >
          {sharing ? <ActivityIndicator size="small" color="#061007" /> : <MaterialCommunityIcons name="camera-outline" size={18} color="#061007" />}
          <Text style={styles.completionShareText}>{sharing ? 'Gerando imagem...' : 'Gerar imagem para postar'}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.completionCloseButton, pressed && styles.pressed]}>
          <Text style={styles.completionCloseText}>Fechar resumo</Text>
        </Pressable>
      </View>

      {shareError ? <Text style={styles.completionShareError}>{shareError}</Text> : null}
    </View>
  );
}

function WorkoutFocusCard({
  item,
  totalItems,
  record,
  onUpdateSet,
  onRegisterSet,
  onMove,
}: {
  item: FocusSetItem;
  totalItems: number;
  record?: ExerciseRecordSummary;
  onUpdateSet: (exerciseId: string, setId: string, field: SetField, value: string) => void;
  onRegisterSet: (exerciseId: string, setId: string) => void;
  onMove: (direction: 'previous' | 'next') => void;
}) {
  const meta = setKind(item.set);
  const quality = executionQualityMeta(item.set.executionQuality);
  const selectedRir = normalizeRirOption(item.set.actualRir);
  const weight = parseTrainingNumber(item.set.weight);
  const reps = parseTrainingNumber(item.set.reps);
  const oneRepMax = estimateOneRepMax(weight, reps);
  const setVolume = weight * reps;
  const progressPercent = totalItems ? Math.round(((item.globalIndex + 1) / totalItems) * 100) : 0;

  return (
    <LinearGradient
      colors={['rgba(156, 240, 46, 0.16)', 'rgba(7, 14, 8, 0.96)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.focusCard}
    >
      <View style={styles.focusTopBar}>
        <View style={styles.focusIcon}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#061007" />
        </View>
        <View style={styles.focusTitleBlock}>
          <Text style={styles.kicker}>Modo foco</Text>
          <Text style={styles.focusExerciseName}>{item.exercise.exerciseName}</Text>
          <Text style={styles.focusSubtitle}>
            S{item.set.setIndex} / {muscleLabels[item.exercise.primaryMuscle as keyof typeof muscleLabels] ?? 'Grupo'} / {item.globalIndex + 1} de {totalItems}
          </Text>
        </View>
        <View style={styles.focusProgressBadge}>
          <Text style={styles.focusProgressText}>{progressPercent}%</Text>
        </View>
      </View>

      <View style={styles.focusProgressTrack}>
        <View style={[styles.focusProgressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.focusTargetCard}>
        <View style={styles.setTypePill}>
          <MaterialCommunityIcons name={meta.icon as IconName} size={11} color="#061007" />
          <Text style={styles.setTypeText}>{meta.label}</Text>
        </View>
        <Text style={styles.focusTargetText}>{executionSetTargetText(item.set)}</Text>
        {item.set.instruction ? <Text style={styles.focusInstruction}>{item.set.instruction}</Text> : null}
      </View>

      <View style={styles.recordStrip}>
        <RecordMiniTile label="Maior carga" value={formatWeight(record?.bestWeight ?? 0)} />
        <RecordMiniTile label="Maior 1RM" value={formatWeight(record?.bestOneRepMax ?? 0)} />
        <RecordMiniTile label="Volume de série" value={formatVolume(record?.bestSetVolume ?? 0)} />
      </View>

      <View style={styles.focusInputs}>
        <View style={styles.focusInputWrap}>
          <Text style={styles.compactLabel}>Carga usada</Text>
          <TextInput
            value={item.set.weight}
            placeholder="kg"
            placeholderTextColor="rgba(220, 244, 200, 0.34)"
            keyboardType="decimal-pad"
            selectTextOnFocus
            onChangeText={(value) => onUpdateSet(item.exercise.exerciseId, item.set.setId, 'weight', value)}
            style={styles.focusInput}
          />
        </View>
        <View style={styles.focusInputWrap}>
          <Text style={styles.compactLabel}>Reps feitas</Text>
          <TextInput
            value={item.set.reps}
            placeholder="0"
            placeholderTextColor="rgba(220, 244, 200, 0.34)"
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={(value) => onUpdateSet(item.exercise.exerciseId, item.set.setId, 'reps', value)}
            style={styles.focusInput}
          />
        </View>
      </View>

      <View style={styles.liveEstimateRow}>
        <View style={styles.liveEstimateItem}>
          <MaterialCommunityIcons name="chart-line" size={15} color="#9CF02E" />
          <Text style={styles.liveEstimateText}>1RM {formatWeight(oneRepMax)}</Text>
        </View>
        <View style={styles.liveEstimateItem}>
          <MaterialCommunityIcons name="chart-bar" size={15} color="#9CF02E" />
          <Text style={styles.liveEstimateText}>Volume {formatVolume(setVolume)}</Text>
        </View>
      </View>

      <View style={styles.focusNotesSection}>
        <View style={styles.metricTitleRow}>
          <MaterialCommunityIcons name="note-edit-outline" size={14} color="#9CF02E" />
          <Text style={styles.metricTitle}>Observação da série</Text>
          <Text style={styles.metricHint}>use para lembrar ajustes depois</Text>
        </View>
        <TextInput
          value={item.set.notes}
          placeholder="Ex.: cotovelo incomodou, carga leve, melhorar amplitude..."
          placeholderTextColor="rgba(220, 244, 200, 0.34)"
          onChangeText={(value) => onUpdateSet(item.exercise.exerciseId, item.set.setId, 'notes', value)}
          multiline
          style={styles.focusNotesInput}
        />
      </View>

      <View style={styles.focusMetricSection}>
        <View style={styles.metricTitleRow}>
          <MaterialCommunityIcons name="gauge" size={14} color="#9CF02E" />
          <Text style={styles.metricTitle}>RIR real</Text>
          <Text style={styles.metricHint}>0 falha / 4+ sobrou</Text>
        </View>
        <View style={styles.focusRirGrid}>
          {rirOptions.map((option) => {
            const active = selectedRir === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => onUpdateSet(item.exercise.exerciseId, item.set.setId, 'actualRir', option.id)}
                style={({ pressed }) => [styles.focusRirChip, active && styles.rirChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.rirChipLabel, active && styles.rirChipLabelActive]}>{option.label}</Text>
                <Text style={[styles.rirChipHelper, active && styles.rirChipHelperActive]}>{option.helper}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.focusMetricSection}>
        <View style={styles.metricTitleRow}>
          <MaterialCommunityIcons name="motion-outline" size={14} color="#9CF02E" />
          <Text style={styles.metricTitle}>Qualidade da execucao</Text>
        </View>
        <View style={styles.qualityGrid}>
          {executionQualityOptions.map((option) => {
            const active = quality.id === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => onUpdateSet(item.exercise.exerciseId, item.set.setId, 'executionQuality', option.id)}
                style={({ pressed }) => [styles.qualityChip, active && styles.qualityChipActive, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name={option.icon} size={15} color={active ? '#061007' : '#9CF02E'} />
                <View style={styles.qualityCopy}>
                  <Text style={[styles.qualityLabel, active && styles.qualityLabelActive]}>{option.label}</Text>
                  <Text style={[styles.qualityHelper, active && styles.qualityHelperActive]}>{option.helper}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.focusActions}>
        <Pressable onPress={() => onMove('previous')} style={({ pressed }) => [styles.focusNavButton, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={16} color="#9CF02E" />
          <Text style={styles.focusNavText}>Anterior</Text>
        </Pressable>
        <Pressable
          onPress={() => onRegisterSet(item.exercise.exerciseId, item.set.setId)}
          style={({ pressed }) => [styles.focusRegisterButton, item.set.completed && styles.focusRegisterButtonDone, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name={item.set.completed ? 'check-decagram' : 'timer-play-outline'} size={18} color="#061007" />
          <Text style={styles.focusRegisterText}>{item.set.completed ? 'Desmarcar série' : 'Registrar série'}</Text>
        </Pressable>
        <Pressable onPress={() => onMove('next')} style={({ pressed }) => [styles.focusNavButton, pressed && styles.pressed]}>
        <Text style={styles.focusNavText}>Próxima</Text>
          <Feather name="chevron-right" size={16} color="#9CF02E" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function updateExerciseCompletion(exercise: WorkoutExerciseExecutionLog) {
  if (!exercise.sets.length) {
    return exercise;
  }

  return {
    ...exercise,
    completed: exercise.sets.every((set) => set.completed),
  };
}

function updateSessionExercise(
  session: StudentWorkoutSession,
  exerciseId: string,
  updater: (exercise: WorkoutExerciseExecutionLog) => WorkoutExerciseExecutionLog,
) {
  return {
    ...session,
    exerciseLogs: session.exerciseLogs.map((exercise) =>
      exercise.exerciseId === exerciseId ? updateExerciseCompletion(updater(exercise)) : exercise,
    ),
  };
}

function buildExerciseObjects(plan: StudentTrainingPlan | null, sessions: StudentWorkoutSession[]) {
  const exerciseMap = new Map<string, ExerciseObject>();

  const ensureExercise = (name: string, primaryMuscle: string, workoutDayName: string) => {
    const key = normalizeExerciseKey(name);
    const current = exerciseMap.get(key);

    if (current) {
      if (workoutDayName && !current.workoutDays.includes(workoutDayName)) {
        current.workoutDays.push(workoutDayName);
      }

      return current;
    }

    const nextExercise: ExerciseObject = {
      key,
      name,
      primaryMuscle,
      workoutDays: workoutDayName ? [workoutDayName] : [],
      plannedSets: 0,
      sessionsCount: 0,
      bestWeight: 0,
      bestOneRepMax: 0,
      bestSetVolume: 0,
      bestReps: 0,
      history: [],
    };

    exerciseMap.set(key, nextExercise);
    return nextExercise;
  };

  plan?.workoutDays.forEach((day) => {
    day.exercises.forEach((exercise) => {
      const item = ensureExercise(exercise.name, exercise.primaryMuscle, day.name);
      item.plannedSets += exercise.sets.length;
    });
  });

  sessions
    .filter((session) => session.status === 'completed')
    .forEach((session) => {
      session.exerciseLogs.forEach((exercise) => {
        const item = ensureExercise(exercise.exerciseName, exercise.primaryMuscle, session.workoutDayName);
        const loggedSets = exercise.sets
          .map((set) => {
            const weight = parseTrainingNumber(set.weight);
            const reps = parseTrainingNumber(set.reps);

            return {
              weight,
              reps,
              oneRepMax: estimateOneRepMax(weight, reps),
              setVolume: weight * reps,
              completed: set.completed || weight > 0 || reps > 0,
            };
          })
          .filter((set) => set.completed);

        if (!loggedSets.length) {
          return;
        }

        const bestWeightSet = loggedSets.reduce((best, set) => (set.weight > best.weight ? set : best), loggedSets[0]);
        const bestOneRepMaxSet = loggedSets.reduce(
          (best, set) => (set.oneRepMax > best.oneRepMax ? set : best),
          loggedSets[0],
        );

        item.bestWeight = Math.max(item.bestWeight, bestWeightSet.weight);
        item.bestOneRepMax = Math.max(item.bestOneRepMax, bestOneRepMaxSet.oneRepMax);
        item.bestSetVolume = Math.max(item.bestSetVolume, ...loggedSets.map((set) => set.setVolume));
        item.bestReps = Math.max(item.bestReps, ...loggedSets.map((set) => set.reps));
        item.sessionsCount += 1;
        item.history.push({
          sessionId: session.id,
          date: session.completedAt ?? session.startedAt,
          workoutDayName: session.workoutDayName,
          bestWeight: bestWeightSet.weight,
          bestReps: bestWeightSet.reps,
          bestOneRepMax: bestOneRepMaxSet.oneRepMax,
          bestSetVolume: Math.max(...loggedSets.map((set) => set.setVolume)),
          completedSets: loggedSets.length,
        });
      });
    });

  return Array.from(exerciseMap.values())
    .map((exercise) => ({
      ...exercise,
      history: exercise.history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }))
    .sort((a, b) => {
      if (b.sessionsCount !== a.sessionsCount) {
        return b.sessionsCount - a.sessionsCount;
      }

      return a.name.localeCompare(b.name);
    });
}

function PlanSetRow({ set, index }: { set: WorkoutSet; index: number }) {
  const meta = setKind(set);

  return (
    <View style={styles.previewSetRow}>
      <View style={styles.setNumberPill}>
        <Text style={styles.setNumberText}>S{index + 1}</Text>
      </View>
      <View style={styles.previewSetBody}>
        <View style={styles.previewSetTop}>
          <View style={styles.setTypePill}>
            <MaterialCommunityIcons name={meta.icon as IconName} size={11} color="#061007" />
            <Text style={styles.setTypeText}>
              {meta.label} · {meta.percent}
            </Text>
          </View>
          <Text style={styles.previewRir}>{meta.rir}</Text>
        </View>
        <Text style={styles.previewSetTarget}>{set.reps || 'Reps livres'}</Text>
        {set.instruction ? <Text style={styles.setInstruction}>{set.instruction}</Text> : null}
      </View>
    </View>
  );
}

function exerciseTargetSummary(sets: WorkoutSet[]) {
  const targets = Array.from(new Set(sets.map((set) => set.reps.trim()).filter(Boolean))).slice(0, 2);
  return targets.length ? targets.join(' / ') : 'Reps livres';
}

function PlanExerciseCard({ exercise, onOpenStats }: { exercise: WorkoutExercise; onOpenStats: (name: string) => void }) {
  return (
    <View style={styles.exerciseCard}>
      <Pressable onPress={() => onOpenStats(exercise.name)} style={({ pressed }) => [styles.exerciseHeaderStatic, pressed && styles.pressed]}>
        <View style={styles.exerciseBadge}>
          <MaterialCommunityIcons name="weight-lifter" size={17} color="#061007" />
        </View>
        <View style={styles.exerciseCopy}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {muscleLabels[exercise.primaryMuscle] ?? 'Grupo'} / {exercise.sets.length} séries
          </Text>
        </View>
        <View style={styles.exerciseOpenPill}>
          <MaterialCommunityIcons name="chart-line" size={13} color="#9CF02E" />
          <Text style={styles.exerciseOpenPillText}>Ver</Text>
        </View>
      </Pressable>

      <View style={styles.exerciseCompactMetaRow}>
        <View style={styles.exerciseCompactPill}>
          <MaterialCommunityIcons name="format-list-numbered" size={13} color="#9CF02E" />
          <Text style={styles.exerciseCompactPillText}>{exercise.sets.length} séries</Text>
        </View>
        <View style={styles.exerciseCompactPill}>
          <MaterialCommunityIcons name="repeat" size={13} color="#9CF02E" />
          <Text style={styles.exerciseCompactPillText}>{exerciseTargetSummary(exercise.sets)}</Text>
        </View>
      </View>
    </View>
  );
}

type CardioPanelScreen = 'overview' | 'manual' | 'timer';

type CardioDraft = {
  modality: string;
  intensity: CardioIntensity;
  minutes: string;
  distanceKm: string;
  calories: string;
  notes: string;
};

function CardioTextField({
  label,
  value,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.cardioField}>
      <Text style={styles.cardioFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(220, 244, 200, 0.34)"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onChangeText={onChangeText}
        style={[styles.cardioInput, multiline && styles.cardioTextarea]}
      />
    </View>
  );
}

function CardioIntensityPicker({
  value,
  onChange,
}: {
  value: CardioIntensity;
  onChange: (value: CardioIntensity) => void;
}) {
  return (
    <View style={styles.intensityPicker}>
      {cardioIntensityOptions.map((option) => {
        const active = value === option.id;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [styles.intensityChip, active && styles.intensityChipActive, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={option.icon} size={14} color={active ? '#061007' : '#9CF02E'} />
            <View style={styles.intensityChipCopy}>
              <Text style={[styles.intensityChipTitle, active && styles.intensityChipTitleActive]}>{option.label}</Text>
              <Text style={[styles.intensityChipText, active && styles.intensityChipTextActive]}>{option.range}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CardioPanel({
  plan,
  logs,
  loading,
  saving,
  errorMessage,
  onSaveCardioLog,
  onRefresh,
}: {
  plan: StudentTrainingPlan;
  logs: StudentCardioLog[];
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  onSaveCardioLog: (payload: SaveCardioLogPayload) => Promise<StudentCardioLog | void> | StudentCardioLog | void;
  onRefresh: () => Promise<void> | void;
}) {
  const [screen, setScreen] = useState<CardioPanelScreen>('overview');
  const [localError, setLocalError] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<CardioDraft>({
    modality: 'Cardio',
    intensity: plan.cardioConfig.intensity,
    minutes: '',
    distanceKm: '',
    calories: '',
    notes: '',
  });
  const [timerDraft, setTimerDraft] = useState<Omit<CardioDraft, 'minutes'>>({
    modality: 'Cardio',
    intensity: plan.cardioConfig.intensity,
    distanceKm: '',
    calories: '',
    notes: '',
  });
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const weeklyMinutes = Number(plan.cardioConfig.weeklyMinutes.replace(',', '.')) || 0;
  const weekStart = weekStartIsoDate();
  const weeklyLogs = logs.filter((log) => log.logDate >= weekStart);
  const completedMinutes = weeklyLogs.reduce((total, log) => total + Math.round(log.durationSeconds / 60), 0);
  const percent = weeklyMinutes ? Math.min(100, Math.round((completedMinutes / weeklyMinutes) * 100)) : 0;
  const sortedLogs = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentLogs = sortedLogs.slice(0, 4);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay() + index);
    const dateKey = localIsoDate(date);
    const minutes = logs
      .filter((log) => log.logDate === dateKey)
      .reduce((total, log) => total + Math.round(log.durationSeconds / 60), 0);

    return {
      key: dateKey,
      label: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][index],
      minutes,
    };
  });
  const combinedError = localError || errorMessage;

  useEffect(() => {
    if (!timerRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      setTimerSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    setManualDraft((current) => ({ ...current, intensity: plan.cardioConfig.intensity }));
    setTimerDraft((current) => ({ ...current, intensity: plan.cardioConfig.intensity }));
  }, [plan.cardioConfig.intensity]);

  const updateManualDraft = (field: keyof CardioDraft, value: string | CardioIntensity) => {
    setLocalError(null);
    setManualDraft((current) => ({ ...current, [field]: value }));
  };

  const updateTimerDraft = (field: keyof Omit<CardioDraft, 'minutes'>, value: string | CardioIntensity) => {
    setLocalError(null);
    setTimerDraft((current) => ({ ...current, [field]: value }));
  };

  const buildNumericPayload = (draft: Pick<CardioDraft, 'distanceKm' | 'calories'>) => {
    const distanceKm = parseDecimalInput(draft.distanceKm);
    const calories = parseDecimalInput(draft.calories);

    return {
      distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : null,
      calories: calories > 0 ? Math.round(calories) : null,
    };
  };

  const handleSaveManual = async () => {
    const minutes = parseDecimalInput(manualDraft.minutes);

    if (minutes <= 0) {
      setLocalError('Informe a duração do cardio antes de salvar.');
      return;
    }

    setLocalError(null);

    try {
      const now = new Date().toISOString();
      const numericPayload = buildNumericPayload(manualDraft);
      await onSaveCardioLog({
        planId: plan.id ?? null,
        logDate: localIsoDate(),
        source: 'manual',
        modality: manualDraft.modality,
        intensity: manualDraft.intensity,
        durationSeconds: Math.max(1, Math.round(minutes * 60)),
        startedAt: null,
        completedAt: now,
        notes: manualDraft.notes,
        ...numericPayload,
      });

      setManualDraft({
        modality: manualDraft.modality || 'Cardio',
        intensity: plan.cardioConfig.intensity,
        minutes: '',
        distanceKm: '',
        calories: '',
        notes: '',
      });
      setScreen('overview');
    } catch {
      setLocalError('Não foi possível salvar o cardio agora.');
    }
  };

  const toggleTimer = () => {
    setLocalError(null);

    if (!timerRunning && !timerStartedAt) {
      setTimerStartedAt(new Date().toISOString());
    }

    setTimerRunning((current) => !current);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerStartedAt(null);
    setLocalError(null);
  };

  const handleFinishTimer = async () => {
    if (timerSeconds <= 0) {
      setLocalError('Inicie o cronometro antes de finalizar.');
      return;
    }

    setTimerRunning(false);
    setLocalError(null);

    try {
      const numericPayload = buildNumericPayload(timerDraft);
      await onSaveCardioLog({
        planId: plan.id ?? null,
        logDate: localIsoDate(),
        source: 'timer',
        modality: timerDraft.modality,
        intensity: timerDraft.intensity,
        durationSeconds: timerSeconds,
        startedAt: timerStartedAt,
        completedAt: new Date().toISOString(),
        notes: timerDraft.notes,
        ...numericPayload,
      });

      setTimerSeconds(0);
      setTimerStartedAt(null);
      setTimerDraft({
        modality: timerDraft.modality || 'Cardio',
        intensity: plan.cardioConfig.intensity,
        distanceKm: '',
        calories: '',
        notes: '',
      });
      setScreen('overview');
    } catch {
      setLocalError('Não foi possível salvar o cardio do cronômetro.');
    }
  };

  if (screen === 'manual') {
    return (
      <View style={styles.cardioPanel}>
        <View style={styles.cardioSubHeader}>
          <Pressable onPress={() => setScreen('overview')} style={({ pressed }) => [styles.cardioBackButton, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={15} color="#BCEAA9" />
            <Text style={styles.cardioBackText}>Cardio</Text>
          </Pressable>
          <Text style={styles.progressPillText}>Registro manual</Text>
        </View>

        <View style={styles.cardioFormCard}>
          <View style={styles.cardioFormHero}>
            <View style={styles.cardioIcon}>
              <MaterialCommunityIcons name="clipboard-edit-outline" size={20} color="#061007" />
            </View>
            <View style={styles.cardioCopy}>
              <Text style={styles.kicker}>Registrar cardio</Text>
              <Text style={styles.sectionTitle}>Duração, intensidade e detalhes</Text>
              <Text style={styles.readyText}>Use quando voce ja fez o cardio fora do app ou esqueceu de abrir o cronometro.</Text>
            </View>
          </View>

          <CardioTextField
            label="Modalidade"
            value={manualDraft.modality}
            placeholder="Esteira, bike, caminhada..."
            onChangeText={(value) => updateManualDraft('modality', value)}
          />

          <View style={styles.cardioField}>
            <Text style={styles.cardioFieldLabel}>Intensidade</Text>
            <CardioIntensityPicker value={manualDraft.intensity} onChange={(value) => updateManualDraft('intensity', value)} />
          </View>

          <View style={styles.cardioFieldGrid}>
            <CardioTextField
              label="Duração"
              value={manualDraft.minutes}
              placeholder="min"
              keyboardType="decimal-pad"
              onChangeText={(value) => updateManualDraft('minutes', value)}
            />
            <CardioTextField
              label="Distancia"
              value={manualDraft.distanceKm}
              placeholder="km opcional"
              keyboardType="decimal-pad"
              onChangeText={(value) => updateManualDraft('distanceKm', value)}
            />
            <CardioTextField
              label="Calorias"
              value={manualDraft.calories}
              placeholder="kcal opcional"
              keyboardType="number-pad"
              onChangeText={(value) => updateManualDraft('calories', value)}
            />
          </View>

          <CardioTextField
            label="Observacoes"
            value={manualDraft.notes}
            placeholder="Ex.: fiz em jejum, inclinacao 8, ritmo confortavel..."
            multiline
            onChangeText={(value) => updateManualDraft('notes', value)}
          />

          {combinedError ? <Text style={styles.cardioErrorText}>{combinedError}</Text> : null}

          <Pressable
            onPress={() => void handleSaveManual()}
            disabled={saving}
            style={({ pressed }) => [styles.cardioPrimaryAction, saving && styles.disabled, pressed && !saving && styles.pressed]}
          >
            {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="check" size={16} color="#061007" />}
            <Text style={styles.primaryButtonText}>Salvar cardio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (screen === 'timer') {
    return (
      <View style={styles.cardioPanel}>
        <View style={styles.cardioSubHeader}>
          <Pressable onPress={() => setScreen('overview')} style={({ pressed }) => [styles.cardioBackButton, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={15} color="#BCEAA9" />
            <Text style={styles.cardioBackText}>Cardio</Text>
          </Pressable>
          <Text style={styles.progressPillText}>Cronometro</Text>
        </View>

        <LinearGradient
          colors={['rgba(156, 240, 46, 0.18)', 'rgba(6, 12, 7, 0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.timerCard}
        >
          <Text style={styles.kicker}>Tempo em andamento</Text>
          <Text style={styles.timerValue}>{formatTimer(timerSeconds)}</Text>
          <Text style={styles.timerHint}>
            {timerRunning ? 'Cronometro rodando. Pause se precisar.' : timerSeconds ? 'Pausado. Retome ou finalize para salvar.' : 'Toque em iniciar para comecar o registro.'}
          </Text>

          <View style={styles.timerActions}>
            <Pressable onPress={toggleTimer} style={({ pressed }) => [styles.timerMainButton, pressed && styles.pressed]}>
              <Feather name={timerRunning ? 'pause' : 'play'} size={18} color="#061007" />
              <Text style={styles.primaryButtonText}>{timerRunning ? 'Pausar' : timerSeconds ? 'Retomar' : 'Iniciar'}</Text>
            </Pressable>
            <Pressable onPress={resetTimer} style={({ pressed }) => [styles.timerGhostButton, pressed && styles.pressed]}>
              <Feather name="rotate-ccw" size={15} color="#9CF02E" />
              <Text style={styles.secondaryButtonText}>Zerar</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.cardioFormCard}>
          <CardioTextField
            label="Modalidade"
            value={timerDraft.modality}
            placeholder="Esteira, bike, caminhada..."
            onChangeText={(value) => updateTimerDraft('modality', value)}
          />

          <View style={styles.cardioField}>
            <Text style={styles.cardioFieldLabel}>Intensidade</Text>
            <CardioIntensityPicker value={timerDraft.intensity} onChange={(value) => updateTimerDraft('intensity', value)} />
          </View>

          <View style={styles.cardioFieldGrid}>
            <CardioTextField
              label="Distancia"
              value={timerDraft.distanceKm}
              placeholder="km opcional"
              keyboardType="decimal-pad"
              onChangeText={(value) => updateTimerDraft('distanceKm', value)}
            />
            <CardioTextField
              label="Calorias"
              value={timerDraft.calories}
              placeholder="kcal opcional"
              keyboardType="number-pad"
              onChangeText={(value) => updateTimerDraft('calories', value)}
            />
          </View>

          <CardioTextField
            label="Observacoes"
            value={timerDraft.notes}
            placeholder="Ex.: zona 2, respiracao tranquila, inclinacao alta..."
            multiline
            onChangeText={(value) => updateTimerDraft('notes', value)}
          />

          {combinedError ? <Text style={styles.cardioErrorText}>{combinedError}</Text> : null}

          <Pressable
            onPress={() => void handleFinishTimer()}
            disabled={saving}
            style={({ pressed }) => [styles.cardioPrimaryAction, saving && styles.disabled, pressed && !saving && styles.pressed]}
          >
            {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="save" size={16} color="#061007" />}
            <Text style={styles.primaryButtonText}>Finalizar e salvar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cardioPanel}>
      <View style={styles.cardioRecommendation}>
        <View style={styles.cardioIcon}>
          <MaterialCommunityIcons name="run-fast" size={20} color="#061007" />
        </View>
        <View style={styles.cardioCopy}>
          <Text style={styles.kicker}>Recomendacao do coach</Text>
          <Text style={styles.sectionTitle}>{weeklyMinutes || 0} min/semana</Text>
          <Text style={styles.cardioText}>{cardioIntensityLabels[plan.cardioConfig.intensity]}</Text>
          {plan.cardioConfig.notes ? <Text style={styles.cardioNotes}>{plan.cardioConfig.notes}</Text> : null}
        </View>
      </View>

      <View style={styles.cardioProgressCard}>
        <View style={styles.executionHeader}>
          <Text style={styles.panelTitle}>Progresso semanal</Text>
          <Text style={styles.progressPillText}>
            {completedMinutes}/{weeklyMinutes || 0} min
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.weekDots}>
          {weekDays.map((day) => (
            <View key={day.key} style={[styles.weekDot, day.minutes > 0 && styles.weekDotActive]}>
              <Text style={[styles.weekDotText, day.minutes > 0 && styles.weekDotTextActive]}>{day.label}</Text>
              {day.minutes > 0 ? <Text style={styles.weekDotMinutes}>{day.minutes}</Text> : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.cardioReadyCard}>
        <View style={styles.cardioReadyHeader}>
          <View style={styles.startIcon}>
            <Feather name="activity" size={18} color="#061007" />
          </View>
          <View style={styles.readyCopy}>
            <Text style={styles.kicker}>Pronto para o cardio?</Text>
            <Text style={styles.sectionTitle}>Registre intensidade e duração</Text>
            <Text style={styles.readyText}>Use o cronometro durante o cardio ou salve manualmente o que ja foi feito.</Text>
          </View>
        </View>
        <View style={styles.cardioActionGrid}>
          <Pressable onPress={() => setScreen('timer')} style={({ pressed }) => [styles.cardioActionPrimary, pressed && styles.pressed]}>
            <Feather name="play" size={16} color="#061007" />
            <Text style={styles.primaryButtonText}>Cronometrar cardio</Text>
          </Pressable>
          <Pressable onPress={() => setScreen('manual')} style={({ pressed }) => [styles.cardioActionSecondary, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="run" size={16} color="#9CF02E" />
            <Text style={styles.secondaryButtonText}>Registrar manual</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.cardioHistoryCard}>
        <View style={styles.executionHeader}>
          <View>
            <Text style={styles.kicker}>Histórico recente</Text>
            <Text style={styles.panelTitle}>{recentLogs.length} registro(s)</Text>
          </View>
          <Pressable onPress={() => void onRefresh()} disabled={loading} style={({ pressed }) => [styles.cardioRefreshButton, pressed && !loading && styles.pressed]}>
            {loading ? <ActivityIndicator size="small" color="#9CF02E" /> : <Feather name="refresh-cw" size={14} color="#9CF02E" />}
          </Pressable>
        </View>

        {combinedError ? <Text style={styles.cardioErrorText}>{combinedError}</Text> : null}

        {recentLogs.length ? (
          <View style={styles.cardioLogList}>
            {recentLogs.map((log) => (
              <View key={log.id} style={styles.cardioLogRow}>
                <View style={styles.cardioLogIcon}>
                  <MaterialCommunityIcons name={log.source === 'timer' ? 'timer-outline' : 'clipboard-check-outline'} size={17} color="#9CF02E" />
                </View>
                <View style={styles.cardioLogCopy}>
                  <Text style={styles.cardioLogTitle}>{log.modality}</Text>
                  <Text style={styles.cardioLogText}>
                    {isoDateLabel(log.logDate)} / {cardioIntensityLabels[log.intensity]} / {log.source === 'timer' ? 'Cronometro' : 'Manual'}
                  </Text>
                </View>
                <Text style={styles.cardioLogMinutes}>{formatCardioMinutes(log.durationSeconds)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardioEmptyLog}>
            <MaterialCommunityIcons name="run-fast" size={24} color="#9CF02E" />
            <View style={styles.cardioEmptyCopy}>
              <Text style={styles.cardioEmptyTitle}>Nenhum cardio registrado ainda</Text>
              <Text style={styles.readyText}>Seu progresso semanal aparece assim que voce salva o primeiro registro.</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.zonesCard}>
        <View style={styles.executionHeader}>
          <Text style={styles.panelTitle}>Zonas de intensidade</Text>
          <Text style={styles.historyText}>FC max estimada</Text>
        </View>
        <View style={styles.zoneList}>
          {cardioIntensityOptions.map((zone) => (
            <View key={zone.label} style={styles.zoneRow}>
              <View style={styles.zoneCopy}>
                <Text style={styles.zoneTitle}>{zone.label}</Text>
                <Text style={styles.zoneHelper}>{zone.helper}</Text>
              </View>
              <Text style={styles.zoneRange}>{zone.range}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ExerciseMetricChip({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.exerciseMetricChip}>
      <MaterialCommunityIcons name={icon} size={15} color="#9CF02E" />
      <View style={styles.exerciseMetricChipCopy}>
      <Text style={styles.exerciseMetricValue}>{value}</Text>
      <Text style={styles.exerciseMetricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ExerciseProgressGraph({ history }: { history: ExerciseHistoryPoint[] }) {
  const points = history.slice(-8);
  const maxValue = Math.max(...points.map((point) => point.bestOneRepMax || point.bestWeight), 0);

  if (!points.length) {
    return (
      <View style={styles.emptyGraph}>
        <MaterialCommunityIcons name="chart-line-variant" size={26} color="#9CF02E" />
        <Text style={styles.emptyGraphTitle}>Sem histórico ainda</Text>
        <Text style={styles.emptyGraphText}>Finalize treinos registrando carga e reps para gerar a evolução.</Text>
      </View>
    );
  }

  return (
    <View style={styles.graphCard}>
      <View style={styles.graphBars}>
        {points.map((point) => {
          const value = point.bestOneRepMax || point.bestWeight;
          const height = maxValue ? Math.max(12, Math.round((value / maxValue) * 96)) : 12;

          return (
            <View key={`${point.sessionId}-${point.date}`} style={styles.graphPoint}>
              <View style={styles.graphColumnShell}>
                <LinearGradient
                  colors={['#9CF02E', '#46D36C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.graphColumn, { height }]}
                />
              </View>
              <Text style={styles.graphValue}>{formatWeight(value)}</Text>
              <Text style={styles.graphDate}>{formatShortDate(point.date)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ExerciseDetailCard({ exercise, onClose }: { exercise: ExerciseObject; onClose: () => void }) {
  const latest = exercise.history[exercise.history.length - 1] ?? null;
  const previous = exercise.history[exercise.history.length - 2] ?? null;
  const latestValue = latest ? latest.bestOneRepMax || latest.bestWeight : 0;
  const previousValue = previous ? previous.bestOneRepMax || previous.bestWeight : 0;
  const trendValue = latestValue && previousValue ? latestValue - previousValue : 0;
  const trendLabel = trendValue > 0 ? `+${formatWeight(trendValue)}` : trendValue < 0 ? formatWeight(trendValue) : 'Estavel';

  return (
    <View style={styles.exerciseDetailCard}>
      <View style={styles.exerciseDetailHeader}>
        <View style={styles.exerciseDetailCopy}>
          <Text style={styles.kicker}>Exercício</Text>
          <Text style={styles.exerciseDetailTitle}>{exercise.name}</Text>
          <Text style={styles.exerciseDetailSubtitle}>
            {muscleLabels[exercise.primaryMuscle as keyof typeof muscleLabels] ?? 'Grupo'} / {exercise.workoutDays.join(', ') || 'Sem treino vinculado'}
          </Text>
        </View>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.closeDetailButton, pressed && styles.pressed]}>
          <Feather name="x" size={16} color="#BCEAA9" />
        </Pressable>
      </View>

      <LinearGradient
        colors={['rgba(156, 240, 46, 0.22)', 'rgba(8, 18, 9, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.exerciseRecordHero}
      >
        <View style={styles.exerciseRecordIcon}>
          <MaterialCommunityIcons name="trophy-outline" size={23} color="#061007" />
        </View>
        <View style={styles.exerciseRecordCopy}>
          <Text style={styles.exerciseRecordLabel}>Recorde de carga</Text>
          <Text style={styles.exerciseRecordValue}>{formatWeight(exercise.bestWeight)}</Text>
          <Text style={styles.exerciseRecordText}>
            1RM estimado {formatWeight(exercise.bestOneRepMax)} / {exercise.sessionsCount} sessões
          </Text>
        </View>
        <View style={styles.exerciseTrendPill}>
          <Text style={styles.exerciseTrendLabel}>Último</Text>
          <Text style={styles.exerciseTrendValue}>{latest ? trendLabel : '--'}</Text>
        </View>
      </LinearGradient>

      <View style={styles.exerciseMetricsGrid}>
        <ExerciseMetricChip icon="calculator-variant-outline" label="1RM" value={formatWeight(exercise.bestOneRepMax)} />
        <ExerciseMetricChip icon="chart-box-outline" label="Volume" value={formatVolume(exercise.bestSetVolume)} />
        <ExerciseMetricChip icon="calendar-check-outline" label="Sessões" value={String(exercise.sessionsCount)} />
      </View>

      <View style={styles.graphHeader}>
        <View>
          <Text style={styles.panelTitle}>Evolução</Text>
          <Text style={styles.historyText}>Melhor 1RM estimado por treino.</Text>
        </View>
        {latest ? <Text style={styles.latestBadge}>Último {formatShortDate(latest.date)}</Text> : null}
      </View>

      <ExerciseProgressGraph history={exercise.history} />

      {latest ? (
        <View style={styles.latestSessionCard}>
          <View style={styles.latestSessionIcon}>
            <MaterialCommunityIcons name="history" size={17} color="#061007" />
          </View>
          <View style={styles.historyCopy}>
            <Text style={styles.historyTitle}>Última sessão: {latest.workoutDayName}</Text>
            <Text style={styles.historyText}>
              {formatWeight(latest.bestWeight)} / {latest.bestReps || '--'} reps / {latest.completedSets} séries concluídas
            </Text>
          </View>
          <Text style={styles.latestSessionDate}>{formatShortDate(latest.date)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ExerciseLibraryIntro({
  exercisesCount,
  onOpen,
}: {
  exercisesCount: number;
  onOpen: () => void;
}) {
  return (
    <LinearGradient
      colors={['rgba(156, 240, 46, 0.18)', 'rgba(7, 14, 8, 0.92)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.exerciseIntroCard}
    >
      <View style={styles.exerciseIntroIcon}>
        <MaterialCommunityIcons name="database-search-outline" size={26} color="#061007" />
      </View>
      <View style={styles.exerciseIntroCopy}>
        <Text style={styles.kicker}>Biblioteca do aluno</Text>
        <Text style={styles.exerciseIntroTitle}>Biblioteca de exercícios</Text>
        <Text style={styles.exerciseIntroText}>
          Abra a lista completa para pesquisar exercícios, filtrar por grupo muscular e ver evolução individual.
        </Text>
        <View style={styles.exerciseIntroStats}>
          <View style={styles.exerciseIntroStat}>
            <Text style={styles.exerciseIntroStatValue}>{exercisesCount}</Text>
            <Text style={styles.exerciseIntroStatLabel}>exercícios</Text>
          </View>
          <View style={styles.exerciseIntroStat}>
            <Text style={styles.exerciseIntroStatValue}>1RM</Text>
            <Text style={styles.exerciseIntroStatLabel}>estimado</Text>
          </View>
        </View>
      </View>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.openLibraryButton, pressed && styles.pressed]}>
        <Feather name="search" size={16} color="#061007" />
        <Text style={styles.openLibraryButtonText}>Abrir biblioteca</Text>
      </Pressable>
    </LinearGradient>
  );
}

function ExerciseExplorer({
  exercises,
  search,
  filter,
  selectedKey,
  onBack,
  onSearchChange,
  onFilterChange,
  onSelectExercise,
  onClearSelection,
}: {
  exercises: ExerciseObject[];
  search: string;
  filter: ExerciseFilter;
  selectedKey: string | null;
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ExerciseFilter) => void;
  onSelectExercise: (key: string) => void;
  onClearSelection: () => void;
}) {
  const normalizedSearch = normalizeExerciseKey(search);
  const filteredExercises = exercises.filter((exercise) =>
    (filter === 'all' || getExerciseFilter(exercise.primaryMuscle) === filter)
    && (normalizedSearch ? exercise.key.includes(normalizedSearch) || normalizeExerciseKey(exercise.name).includes(normalizedSearch) : true),
  );
  const selectedExercise = selectedKey ? exercises.find((exercise) => exercise.key === selectedKey) ?? null : null;

  return (
    <View style={styles.exerciseExplorer}>
      <View style={styles.exerciseLibraryHeader}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.libraryBackButton, pressed && styles.pressed]}>
          <Feather name="arrow-left" size={16} color="#BCEAA9" />
          <Text style={styles.libraryBackText}>Voltar</Text>
        </Pressable>
        <View style={styles.libraryHeaderCopy}>
          <Text style={styles.kicker}>Biblioteca</Text>
        <Text style={styles.libraryTitle}>Todos os exercícios</Text>
        </View>
      </View>

      <View style={styles.exerciseSearchCard}>
        <View style={styles.searchIcon}>
          <Feather name="search" size={17} color="#9CF02E" />
        </View>
        <TextInput
          value={search}
          placeholder="Pesquisar exercício..."
          placeholderTextColor="rgba(220, 244, 200, 0.34)"
          onChangeText={onSearchChange}
          style={styles.exerciseSearchInput}
        />
        {search ? (
          <Pressable onPress={() => onSearchChange('')} style={({ pressed }) => [styles.clearSearchButton, pressed && styles.pressed]}>
            <Feather name="x" size={14} color="#BCEAA9" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseFilterList}>
        {exerciseFilterOptions.map((option) => {
          const active = filter === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => onFilterChange(option.id)}
              style={({ pressed }) => [styles.exerciseFilterChip, active && styles.exerciseFilterChipActive, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name={option.icon} size={15} color={active ? '#061007' : '#9CF02E'} />
              <Text style={[styles.exerciseFilterText, active && styles.exerciseFilterTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.libraryCountRow}>
        <Text style={styles.historyText}>
          {filteredExercises.length} exercício(s) encontrado(s)
        </Text>
        {filter !== 'all' || search ? (
          <Pressable
            onPress={() => {
              onSearchChange('');
              onFilterChange('all');
              onClearSelection();
            }}
            style={({ pressed }) => [styles.clearFiltersButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearFiltersText}>Limpar filtros</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.exerciseObjectList}>
        {filteredExercises.map((exercise) => {
          const active = selectedExercise?.key === exercise.key;

          return (
            <Pressable
              key={exercise.key}
              onPress={() => onSelectExercise(exercise.key)}
              style={({ pressed }) => [styles.exerciseObjectCard, active && styles.exerciseObjectCardActive, pressed && styles.pressed]}
            >
              <View style={[styles.exerciseObjectIcon, active && styles.exerciseObjectIconActive]}>
                <MaterialCommunityIcons name="dumbbell" size={16} color={active ? '#061007' : '#9CF02E'} />
              </View>
              <Text style={[styles.exerciseObjectName, active && styles.exerciseObjectNameActive]} numberOfLines={2}>
                {exercise.name}
              </Text>
              <Text style={[styles.exerciseObjectMeta, active && styles.exerciseObjectMetaActive]}>
                {exercise.sessionsCount} sessões / {formatWeight(exercise.bestWeight)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedExercise ? (
        <ExerciseDetailCard exercise={selectedExercise} onClose={onClearSelection} />
      ) : filteredExercises.length ? (
        <View style={styles.selectExerciseHint}>
          <MaterialCommunityIcons name="gesture-tap" size={24} color="#9CF02E" />
          <Text style={styles.selectExerciseTitle}>Toque em um exercício</Text>
          <Text style={styles.selectExerciseText}>
            A telinha com gráfico, maior carga e maior 1RM aparece aqui depois da seleção.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="database-search-outline" size={34} color="#9CF02E" />
          <Text style={styles.emptyTitle}>Nenhum exercício encontrado</Text>
          <Text style={styles.emptyText}>A lista aparece a partir da ficha do treinador e dos treinos finalizados.</Text>
        </View>
      )}
    </View>
  );
}

export function StudentWorkoutRunner({
  student,
  plan,
  sessions,
  loading,
  saving,
  errorMessage,
  cardioLogs,
  cardioLogsLoading,
  cardioLogSaving,
  cardioLogError,
  onStartSession,
  onSaveSession,
  onFinishSession,
  onSaveCardioLog,
  onRefreshCardioLogs,
  onRefresh,
}: StudentWorkoutRunnerProps) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const [localSession, setLocalSession] = useState<StudentWorkoutSession | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<RunnerMode>('training');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(null);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [showWorkoutMap, setShowWorkoutMap] = useState(false);
  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [trophyToast, setTrophyToast] = useState<TrophyToast | null>(null);
  const [exerciseTransitionToast, setExerciseTransitionToast] = useState<ExerciseTransitionToast | null>(null);
  const [completionSummary, setCompletionSummary] = useState<WorkoutCompletionSummary | null>(null);
  const [completedSessionForSummary, setCompletedSessionForSummary] = useState<StudentWorkoutSession | null>(null);
  const [summarySharing, setSummarySharing] = useState(false);
  const [summaryShareError, setSummaryShareError] = useState<string | null>(null);
  const completionCardRef = useRef<View | null>(null);

  const workoutDays = plan?.workoutDays ?? [];
  const selectedDay = workoutDays.find((day) => day.id === selectedDayId) ?? workoutDays[0] ?? null;
  const activeSession =
    sessions.find((session) => session.status === 'in_progress' && session.workoutDayId === selectedDay?.id) ?? null;
  const currentSession = localSession ?? activeSession;
  const displaySession = completionSummary ? completedSessionForSummary ?? currentSession : currentSession;
  const daySessions = sessions.filter((session) => session.workoutDayId === selectedDay?.id);
  const latestCompletedSessions = daySessions.filter((session) => session.status === 'completed').slice(0, 4);
  const progress = calculateWorkoutSessionProgress(displaySession);
  const exerciseObjects = useMemo(() => buildExerciseObjects(plan, sessions), [plan, sessions]);
  const focusItems = useMemo(() => buildFocusItems(currentSession), [currentSession]);
  const defaultFocusItem = focusItems.find((item) => !item.set.completed) ?? focusItems[focusItems.length - 1] ?? null;
  const focusItem = focusItems.find((item) => item.key === focusKey) ?? defaultFocusItem;
  const currentFocusKey = focusItem?.key ?? '';
  const exerciseRecords = useMemo(() => buildExerciseRecordMap(sessions, currentSession), [sessions, currentSession]);

  useEffect(() => {
    if (!workoutDays.length) {
      setSelectedDayId(null);
      return;
    }

    if (!selectedDayId || !workoutDays.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(workoutDays[0].id);
    }
  }, [selectedDayId, workoutDays]);

  useEffect(() => {
    if (completionSummary) {
      return;
    }

    setLocalSession(null);
    setExpandedExercises(activeSession?.exerciseLogs[0]?.exerciseId ? [activeSession.exerciseLogs[0].exerciseId] : []);
  }, [activeSession?.id, completionSummary, selectedDay?.id]);

  useEffect(() => {
    if (completionSummary) {
      return;
    }

    setRestTimer(null);
    setFocusKey(null);
    setTrophyToast(null);
    setExerciseTransitionToast(null);
    setShowWorkoutMap(false);
    setShowWorkoutNotes(false);
    setCompletedSessionForSummary(null);
    setSummaryShareError(null);
  }, [completionSummary, currentSession?.id]);

  useEffect(() => {
    if (!trophyToast) {
      return undefined;
    }

    const timeout = setTimeout(() => setTrophyToast(null), 3800);
    return () => clearTimeout(timeout);
  }, [trophyToast?.id]);

  useEffect(() => {
    if (!exerciseTransitionToast) {
      return undefined;
    }

    const timeout = setTimeout(() => setExerciseTransitionToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [exerciseTransitionToast?.id]);

  useEffect(() => {
    if (!restTimer) {
      return undefined;
    }

    const interval = setInterval(() => {
      setRestTimer((current) =>
        current
          ? {
              ...current,
              elapsedSeconds: Math.floor((Date.now() - current.startedAtMs) / 1000),
            }
          : current,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer?.setId, restTimer?.startedAtMs]);

  const applySessionUpdate = (updater: (session: StudentWorkoutSession) => StudentWorkoutSession) => {
    setLocalError(null);
    setLocalSession((current) => {
      const base = current ?? activeSession;
      return base ? updater(base) : current;
    });
  };

  const showTrophies = (exerciseName: string, trophies: TrophyEvent[]) => {
    if (!trophies.length) {
      return;
    }

    setTrophyToast({
      id: Date.now(),
      exerciseName,
      trophies,
    });
  };

  const showExerciseTransition = (nextItem: FocusSetItem, previousItem?: FocusSetItem | null) => {
    if (!previousItem || previousItem.exercise.exerciseId === nextItem.exercise.exerciseId) {
      return;
    }

    setExerciseTransitionToast({
      id: Date.now(),
      exerciseName: nextItem.exercise.exerciseName,
      exerciseIndex: nextItem.exerciseIndex + 1,
      totalExercises: currentSession?.exerciseLogs.length ?? 0,
    });
  };

  const moveFocus = (direction: 'previous' | 'next') => {
    if (!focusItems.length || !currentFocusKey) {
      return;
    }

    const previousItem = focusItems.find((item) => item.key === currentFocusKey) ?? null;
    const nextItem = moveFocusItem(focusItems, currentFocusKey, direction);

    if (nextItem) {
      setFocusKey(nextItem.key);
      if (direction === 'next') {
        showExerciseTransition(nextItem, previousItem);
      }
      setExpandedExercises((current) =>
        current.includes(nextItem.exercise.exerciseId) ? current : [...current, nextItem.exercise.exerciseId],
      );
    }
  };

  const handleStart = async () => {
    if (!selectedDay) {
      return;
    }

    setLocalError(null);
    setCompletionSummary(null);
    setCompletedSessionForSummary(null);
    setSummaryShareError(null);
    setShowWorkoutMap(false);
    setShowWorkoutNotes(false);

    try {
      const created = await onStartSession(selectedDay);

      if (created) {
        setLocalSession(created);
        setExpandedExercises(created.exerciseLogs.map((exercise) => exercise.exerciseId));
        const firstExercise = created.exerciseLogs[0];
        const firstSet = firstExercise?.sets[0];

        if (firstExercise && firstSet) {
          setFocusKey(focusSetKey(firstExercise.exerciseId, firstSet.setId));
        }
      }
    } catch {
      setLocalError('Não foi possível iniciar o treino agora.');
    }
  };

  const handleSave = async () => {
    if (!currentSession) {
      return;
    }

    setLocalError(null);

    try {
      const saved = await onSaveSession(currentSession);

      if (saved) {
        setLocalSession(saved);
      }
    } catch {
      setLocalError('Não foi possível salvar o progresso.');
    }
  };

  const showCompletionSummaryForSession = (session: StudentWorkoutSession) => {
    setLocalSession(session);
    setCompletedSessionForSummary(session);
    setRestTimer(null);
    setTrophyToast(null);
    setExerciseTransitionToast(null);
    setSummaryShareError(null);
    setShowHistory(false);
    setShowWorkoutMap(false);
    setShowWorkoutNotes(false);
    setCompletionSummary(buildWorkoutCompletionSummary(session, sessions));
  };

  const handleFinish = async () => {
    if (!currentSession) {
      return;
    }

    setLocalError(null);

    if (progress.completedSets === 0) {
      setLocalError('Marque pelo menos uma série antes de finalizar o treino.');
      return;
    }

    try {
      const finished = await onFinishSession(currentSession);

      if (finished) {
        showCompletionSummaryForSession(finished);
      }
    } catch {
      setLocalError('Não foi possível finalizar o treino.');
    }
  };

  const updateSet = (exerciseId: string, setId: string, field: SetField, value: string) => {
    applySessionUpdate((session) =>
      updateSessionExercise(session, exerciseId, (exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => (set.setId === setId ? { ...set, [field]: value } : set)),
      })),
    );
  };

  const handleShareCompletionSummary = async () => {
    if (!completionCardRef.current) {
      setSummaryShareError('Resumo ainda não está pronto para gerar imagem.');
      return;
    }

    setSummaryShareError(null);
    setSummarySharing(true);

    try {
      const uri = await captureRef(completionCardRef.current, {
        format: 'png',
        quality: 1,
        result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `resumo-treino-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        setSummaryShareError('Compartilhamento indisponivel neste aparelho.');
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: 'Compartilhar resumo do treino',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      setSummaryShareError('Não foi possível gerar a imagem agora.');
    } finally {
      setSummarySharing(false);
    }
  };

  const toggleSet = (exerciseId: string, setId: string) => {
    const targetExercise = currentSession?.exerciseLogs.find((exercise) => exercise.exerciseId === exerciseId);
    const targetSet = targetExercise?.sets.find((set) => set.setId === setId);
    const willComplete = targetSet ? !targetSet.completed : false;
    const targetKey = focusSetKey(exerciseId, setId);

    if (willComplete && targetExercise && targetSet) {
      const trophies = detectTrophies(
        exerciseRecords.get(normalizeExerciseKey(targetExercise.exerciseName)),
        {
          ...targetSet,
          completed: true,
          actualRir: targetSet.actualRir || defaultRirFromTarget(targetSet.targetRir),
          executionQuality: targetSet.executionQuality || 'solid',
        },
      );
      const nextFocusItem = findNextPendingItem(focusItems, targetKey);
      const previousFocusItem = focusItems.find((item) => item.key === targetKey) ?? null;

      showTrophies(targetExercise.exerciseName, trophies);
      setRestTimer({
        exerciseId,
        setId,
        exerciseName: targetExercise.exerciseName,
        setLabel: `S${targetSet.setIndex}`,
        startedAtMs: Date.now(),
        elapsedSeconds: 0,
      });

      if (nextFocusItem) {
        setFocusKey(nextFocusItem.key);
        showExerciseTransition(nextFocusItem, previousFocusItem);
        setExpandedExercises((current) =>
          current.includes(nextFocusItem.exercise.exerciseId) ? current : [...current, nextFocusItem.exercise.exerciseId],
        );
      }
    } else if (restTimer?.exerciseId === exerciseId && restTimer?.setId === setId) {
      setRestTimer(null);
      setFocusKey(targetKey);
    }

    applySessionUpdate((session) =>
      updateSessionExercise(session, exerciseId, (exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (set.setId !== setId) {
            return set;
          }

          const completed = !set.completed;

          return {
            ...set,
            completed,
            actualRir: completed ? set.actualRir || defaultRirFromTarget(set.targetRir) : set.actualRir,
            executionQuality: completed ? set.executionQuality || 'solid' : set.executionQuality,
            completedAt: completed ? new Date().toISOString() : '',
          };
        }),
      })),
    );
  };

  const updateSessionNotes = (notes: string) => {
    applySessionUpdate((session) => ({ ...session, notes }));
  };

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises((current) =>
      current.includes(exerciseId) ? current.filter((id) => id !== exerciseId) : [...current, exerciseId],
    );
  };

  const openExerciseAnalysis = (exerciseName: string) => {
    setSelectedExerciseKey(normalizeExerciseKey(exerciseName));
    setExerciseSearch(exerciseName);
    setExerciseFilter('all');
    setShowExerciseLibrary(true);
    setMode('exercises');
  };

  return (
    <View style={styles.container}>
      {errorMessage || localError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={styles.errorText}>{localError || errorMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#9CF02E" />
          <Text style={styles.loadingText}>Abrindo treino...</Text>
        </View>
      ) : !plan || !workoutDays.length ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={34} color="#9CF02E" />
          <Text style={styles.emptyTitle}>Seu treino ainda não foi liberado</Text>
          <Text style={styles.emptyText}>Quando o treinador montar sua ficha, ela aparece aqui pronta para executar.</Text>
        </View>
      ) : (
        <>
          <View style={styles.modeTabs}>
            {(['training', 'cardio', 'exercises'] as RunnerMode[]).map((item) => {
              const active = mode === item;
              const label = item === 'training' ? 'Treino' : item === 'cardio' ? 'Cardio' : 'Exercícios';
              const icon: IconName = item === 'training' ? 'weight-lifter' : item === 'cardio' ? 'run-fast' : 'database-search-outline';

              return (
                <Pressable
                  key={item}
                  onPress={() => setMode(item)}
                  style={({ pressed }) => [styles.modeTab, active && styles.modeTabActive, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name={icon} size={15} color={active ? '#061007' : '#9CF02E'} />
                  <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'cardio' ? (
            <CardioPanel
              plan={plan}
              logs={cardioLogs}
              loading={cardioLogsLoading}
              saving={cardioLogSaving}
              errorMessage={cardioLogError}
              onSaveCardioLog={onSaveCardioLog}
              onRefresh={onRefreshCardioLogs}
            />
          ) : mode === 'exercises' ? (
            showExerciseLibrary ? (
              <ExerciseExplorer
                exercises={exerciseObjects}
                search={exerciseSearch}
                filter={exerciseFilter}
                selectedKey={selectedExerciseKey}
                onBack={() => {
                  setShowExerciseLibrary(false);
                  setSelectedExerciseKey(null);
                }}
                onSearchChange={setExerciseSearch}
                onFilterChange={(value) => {
                  setExerciseFilter(value);
                  setSelectedExerciseKey(null);
                }}
                onSelectExercise={setSelectedExerciseKey}
                onClearSelection={() => setSelectedExerciseKey(null)}
              />
            ) : (
              <ExerciseLibraryIntro
                exercisesCount={exerciseObjects.length}
                onOpen={() => {
                  setShowExerciseLibrary(true);
                  setExerciseSearch('');
                  setExerciseFilter('all');
                  setSelectedExerciseKey(null);
                }}
              />
            )
          ) : (
            <>
              {!displaySession ? (
                <>
                  <View style={styles.readyCard}>
                    <View style={styles.startIcon}>
                      <Feather name="play" size={18} color="#061007" />
                    </View>
                    <View style={styles.readyCopy}>
                      <Text style={styles.kicker}>Treino de hoje</Text>
                      <Text style={styles.sectionTitle}>{selectedDay?.name}</Text>
                      <Text style={styles.readyText}>{selectedDay?.subtitle || 'Ficha pronta para executar.'}</Text>
                    </View>
                    <Pressable
                      onPress={() => void handleStart()}
                      disabled={saving}
                      style={({ pressed }) => [styles.startButton, pressed && !saving && styles.pressed, saving && styles.disabled]}
                    >
                      {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="play" size={15} color="#061007" />}
                      <Text style={styles.startButtonText}>Iniciar treino</Text>
                    </Pressable>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
                    {workoutDays.map((day) => {
                      const active = day.id === selectedDay?.id;

                      return (
                        <Pressable
                          key={day.id}
                          onPress={() => setSelectedDayId(day.id)}
                          style={({ pressed }) => [styles.dayChip, active && styles.dayChipActive, pressed && styles.pressed]}
                        >
                          <Text style={[styles.dayChipTitle, active && styles.dayChipTitleActive]}>{day.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.historyPanel}>
                    <Pressable
                      onPress={() => setShowHistory((current) => !current)}
                      style={({ pressed }) => [styles.historyHeader, pressed && styles.pressed]}
                    >
                      <View>
            <Text style={styles.kicker}>Histórico</Text>
                        <Text style={styles.historyTitleLine}>{latestCompletedSessions.length} treino(s) salvo(s)</Text>
                      </View>
                      <Feather name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color="#9CF02E" />
                    </Pressable>

                    {showHistory ? (
                      latestCompletedSessions.length ? (
                        <View style={styles.historyList}>
                          {latestCompletedSessions.map((session) => {
                            const sessionProgress = calculateWorkoutSessionProgress(session);

                            return (
                              <View key={session.id} style={styles.historyItem}>
                                <MaterialCommunityIcons name="eye-outline" size={18} color="#9CF02E" />
                                <View style={styles.historyCopy}>
                                  <Text style={styles.historyTitle}>{sessionDate(session.completedAt ?? session.startedAt)}</Text>
                                  <Text style={styles.historyText}>
                                    {formatDuration(session.durationSeconds)} / {sessionProgress.completedSets} séries
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => showCompletionSummaryForSession(session)}
                                  style={({ pressed }) => [styles.historySummaryButton, pressed && styles.pressed]}
                                >
                                  <Text style={styles.historySummaryButtonText}>Resumo</Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.historyEmpty}>Nenhuma sessão finalizada ainda para este treino.</Text>
                      )
                    ) : null}
                  </View>
                </>
              ) : null}

              {displaySession ? (
                <View style={styles.executionPanel}>
                  <View style={styles.executionHeader}>
                    <View>
                      <Text style={styles.kicker}>{completionSummary ? 'Treino finalizado' : 'Sessão em andamento'}</Text>
                      <Text style={styles.sectionTitle}>{displaySession.workoutDayName}</Text>
                    </View>
                    <View style={styles.progressPill}>
                      <Text style={styles.progressPillText}>
                        {progress.completedSets}/{progress.totalSets} séries
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
                  </View>

                  {completionSummary ? (
                    <WorkoutCompletionCard
                      summary={completionSummary}
                      cardRef={completionCardRef}
                      sharing={summarySharing}
                      shareError={summaryShareError}
                      onShare={() => void handleShareCompletionSummary()}
                      onClose={() => {
                        setCompletionSummary(null);
                        setCompletedSessionForSummary(null);
                        setLocalSession(null);
                      }}
                    />
                  ) : (
                    <>
                  {trophyToast ? <TrophyToastCard toast={trophyToast} onDismiss={() => setTrophyToast(null)} /> : null}

                  {exerciseTransitionToast ? (
                    <ExerciseTransitionToastCard
                      toast={exerciseTransitionToast}
                      onDismiss={() => setExerciseTransitionToast(null)}
                    />
                  ) : null}

                  {restTimer ? (
                    <View style={styles.restTimerCard}>
                      <View style={styles.restTimerIcon}>
                        <MaterialCommunityIcons name="timer-sand" size={22} color="#061007" />
                      </View>
                      <View style={styles.restTimerCopy}>
                        <Text style={styles.kicker}>Descanso ativo</Text>
                        <Text style={styles.restTimerTitle}>
                          {restTimer.exerciseName} / {restTimer.setLabel}
                        </Text>
                      </View>
                      <View style={styles.restTimerClock}>
                        <Text style={styles.restTimerValue}>{formatTimer(restTimer.elapsedSeconds)}</Text>
                        <Pressable onPress={() => setRestTimer(null)} style={({ pressed }) => [styles.restTimerStop, pressed && styles.pressed]}>
                          <Text style={styles.restTimerStopText}>Parar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {focusItem ? (
                    <WorkoutFocusCard
                      item={focusItem}
                      totalItems={focusItems.length}
                      record={exerciseRecords.get(normalizeExerciseKey(focusItem.exercise.exerciseName))}
                      onUpdateSet={updateSet}
                      onRegisterSet={toggleSet}
                      onMove={moveFocus}
                    />
                  ) : null}

                  <View style={styles.workoutToolGrid}>
                    <Pressable
                      onPress={() => setShowWorkoutMap((current) => !current)}
                      style={({ pressed }) => [styles.workoutToolButton, showWorkoutMap && styles.workoutToolButtonActive, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons name="map-marker-path" size={18} color={showWorkoutMap ? '#061007' : '#9CF02E'} />
                      <View style={styles.workoutToolCopy}>
                        <Text style={[styles.workoutToolTitle, showWorkoutMap && styles.workoutToolTitleActive]}>Mapa do treino</Text>
                        <Text style={[styles.workoutToolText, showWorkoutMap && styles.workoutToolTextActive]}>
                          {progress.completedSets}/{progress.totalSets} séries
                        </Text>
                      </View>
                      <Feather name={showWorkoutMap ? 'chevron-up' : 'chevron-down'} size={16} color={showWorkoutMap ? '#061007' : '#9CF02E'} />
                    </Pressable>

                    <Pressable
                      onPress={() => setShowWorkoutNotes((current) => !current)}
                      style={({ pressed }) => [styles.workoutToolButton, showWorkoutNotes && styles.workoutToolButtonActive, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons name="notebook-edit-outline" size={18} color={showWorkoutNotes ? '#061007' : '#9CF02E'} />
                      <View style={styles.workoutToolCopy}>
                        <Text style={[styles.workoutToolTitle, showWorkoutNotes && styles.workoutToolTitleActive]}>Anotações</Text>
                        <Text style={[styles.workoutToolText, showWorkoutNotes && styles.workoutToolTextActive]}>
                          {displaySession.notes ? 'Preenchidas' : 'Opcional'}
                        </Text>
                      </View>
                      <Feather name={showWorkoutNotes ? 'chevron-up' : 'chevron-down'} size={16} color={showWorkoutNotes ? '#061007' : '#9CF02E'} />
                    </Pressable>
                  </View>

                  {showWorkoutMap ? (
                    <View style={styles.focusSummaryCard}>
                      <View style={styles.focusSummaryHeader}>
                        <View>
                          <Text style={styles.kicker}>Mapa do treino</Text>
                          <Text style={styles.panelTitle}>Troque rapido de exercicio</Text>
                        </View>
                        <Text style={styles.focusSummaryCount}>{progress.completedSets}/{progress.totalSets}</Text>
                      </View>
                      <View style={styles.focusExerciseGrid}>
                        {displaySession.exerciseLogs.map((exercise) => {
                          const doneSets = exercise.sets.filter((set) => set.completed).length;
                          const exerciseKey = firstFocusKeyForExercise(exercise);
                          const active = focusItem?.exercise.exerciseId === exercise.exerciseId;
                          const exercisePercent = exercise.sets.length ? Math.round((doneSets / exercise.sets.length) * 100) : 0;

                          return (
                            <Pressable
                              key={exercise.exerciseId}
                              onPress={() => {
                                if (exerciseKey) {
                                  setFocusKey(exerciseKey);
                                }
                              }}
                              style={({ pressed }) => [styles.focusExerciseChip, active && styles.focusExerciseChipActive, pressed && styles.pressed]}
                            >
                              <View style={styles.focusExerciseChipTop}>
                                <Text style={[styles.focusExerciseChipTitle, active && styles.focusExerciseChipTitleActive]} numberOfLines={1}>
                                  {exercise.exerciseName}
                                </Text>
                                <Text style={[styles.focusExerciseChipCount, active && styles.focusExerciseChipCountActive]}>
                                  {doneSets}/{exercise.sets.length}
                                </Text>
                              </View>
                              <View style={styles.focusExerciseMiniTrack}>
                                <View style={[styles.focusExerciseMiniFill, { width: `${exercisePercent}%` }]} />
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {showWorkoutNotes ? (
                    <View style={styles.notesCard}>
                      <Text style={styles.panelTitle}>Observacoes do treino</Text>
                      <TextInput
                        value={displaySession.notes}
                        placeholder="Como foi? Dificuldade, sensacoes, equipamentos ocupados..."
                        placeholderTextColor="rgba(220, 244, 200, 0.34)"
                        onChangeText={updateSessionNotes}
                        multiline
                        style={styles.notesInput}
                      />
                    </View>
                  ) : null}

                  <View style={styles.sessionActions}>
                    <Pressable
                      onPress={() => void handleSave()}
                      disabled={saving}
                      style={({ pressed }) => [styles.secondaryButton, saving && styles.disabled, pressed && !saving && styles.pressed]}
                    >
                      {saving ? <ActivityIndicator color="#9CF02E" size="small" /> : <Feather name="save" size={15} color="#9CF02E" />}
                      <Text style={styles.secondaryButtonText}>Salvar progresso</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void handleFinish()}
                      disabled={saving}
                      style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && !saving && styles.pressed]}
                    >
                      <Feather name="check" size={16} color="#061007" />
                      <Text style={styles.primaryButtonText}>Finalizar treino</Text>
                    </Pressable>
                  </View>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.exerciseList}>
                  {selectedDay?.exercises.map((exercise) => (
                    <PlanExerciseCard key={exercise.id} exercise={exercise} onOpenStats={openExerciseAnalysis} />
                  ))}
                </View>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  modeTabs: {
    flexDirection: 'row',
    gap: 10,
  },
  modeTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(9, 16, 10, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modeTabActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  modeTabText: {
    color: '#BCEAA9',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTabTextActive: {
    color: '#061007',
  },
  historyPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.72)',
    overflow: 'hidden',
  },
  historyHeader: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyTitleLine: {
    marginTop: 2,
    color: '#F2FFE8',
    fontSize: 16,
    fontWeight: '900',
  },
  historyList: {
    padding: 14,
    paddingTop: 0,
    gap: 10,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  historyText: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 12,
    fontWeight: '700',
  },
  historySummaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historySummaryButtonText: {
    color: '#B7FF5A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  historyEmpty: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 13,
    lineHeight: 19,
    padding: 15,
    paddingTop: 0,
  },
  readyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(7, 14, 8, 0.86)',
    padding: 16,
    gap: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyCopy: {
    flex: 1,
    gap: 2,
  },
  readyText: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 12,
    lineHeight: 17,
  },
  startButton: {
    borderRadius: 17,
    backgroundColor: '#9CF02E',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  startButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  dayTabs: {
    gap: 10,
    paddingVertical: 2,
  },
  dayChip: {
    minWidth: 78,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(9, 18, 10, 0.82)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  dayChipTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  dayChipTitleActive: {
    color: '#061007',
  },
  executionPanel: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(6, 12, 7, 0.88)',
    padding: 16,
    gap: 14,
  },
  executionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: '#F2FFE8',
    fontSize: 19,
    fontWeight: '900',
  },
  panelTitle: {
    color: '#F2FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  progressPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressPillText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.09)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  trophyToast: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.34)',
    backgroundColor: 'rgba(9, 18, 10, 0.96)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  trophyToastIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyToastCopy: {
    flex: 1,
    gap: 5,
  },
  trophyToastTitle: {
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  trophyToastList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trophyToastPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trophyToastText: {
    color: '#DFFFD4',
    fontSize: 10,
    fontWeight: '900',
  },
  trophyToastMore: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    alignSelf: 'center',
  },
  exerciseTransitionToast: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.3)',
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseTransitionIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseTransitionCopy: {
    flex: 1,
    gap: 1,
  },
  exerciseTransitionTitle: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  exerciseTransitionName: {
    color: '#F2FFE8',
    fontSize: 17,
    fontWeight: '900',
  },
  exerciseTransitionCounter: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  exerciseTransitionCounterText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  restTimerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  restTimerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerCopy: {
    flex: 1,
    gap: 2,
  },
  restTimerTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  restTimerClock: {
    alignItems: 'flex-end',
    gap: 6,
  },
  restTimerValue: {
    color: '#F2FFE8',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  restTimerStop: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  restTimerStopText: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  focusCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  focusTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  focusIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitleBlock: {
    flex: 1,
    gap: 2,
  },
  focusExerciseName: {
    color: '#F2FFE8',
    fontSize: 22,
    fontWeight: '900',
  },
  focusSubtitle: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 12,
    fontWeight: '800',
  },
  focusProgressBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.26)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  focusProgressText: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  focusProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.1)',
    overflow: 'hidden',
  },
  focusProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  focusTargetCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(2, 8, 3, 0.55)',
    padding: 13,
    gap: 7,
  },
  focusTargetText: {
    color: '#F2FFE8',
    fontSize: 18,
    fontWeight: '900',
  },
  focusInstruction: {
    color: 'rgba(232, 246, 221, 0.6)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  recordStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordMiniTile: {
    flex: 1,
    minWidth: 98,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 10,
    gap: 3,
  },
  recordMiniValue: {
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  recordMiniLabel: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  focusInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  focusInputWrap: {
    flex: 1,
    gap: 6,
  },
  focusInput: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.26)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#F2FFE8',
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  liveEstimateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveEstimateItem: {
    flexGrow: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveEstimateText: {
    color: '#DFFFD4',
    fontSize: 12,
    fontWeight: '900',
  },
  focusNotesSection: {
    gap: 9,
  },
  focusNotesInput: {
    minHeight: 72,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  focusMetricSection: {
    gap: 9,
  },
  focusRirGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  focusRirChip: {
    flex: 1,
    minWidth: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    paddingVertical: 9,
    alignItems: 'center',
    gap: 2,
  },
  focusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    alignItems: 'stretch',
  },
  focusNavButton: {
    flexGrow: 1,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    backgroundColor: 'rgba(2, 8, 3, 0.52)',
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  focusNavText: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  focusRegisterButton: {
    flexGrow: 2,
    minWidth: 158,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  focusRegisterButtonDone: {
    backgroundColor: '#B8FF63',
  },
  focusRegisterText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  workoutToolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  workoutToolButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  workoutToolButtonActive: {
    borderColor: '#9CF02E',
    backgroundColor: '#9CF02E',
  },
  workoutToolCopy: {
    flex: 1,
    gap: 1,
  },
  workoutToolTitle: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  workoutToolTitleActive: {
    color: '#061007',
  },
  workoutToolText: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  workoutToolTextActive: {
    color: 'rgba(6, 16, 7, 0.66)',
  },
  focusSummaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    padding: 13,
    gap: 12,
  },
  focusSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  focusSummaryCount: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  focusExerciseGrid: {
    gap: 8,
  },
  focusExerciseChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 10,
    gap: 8,
  },
  focusExerciseChipActive: {
    borderColor: 'rgba(156, 240, 46, 0.38)',
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
  },
  focusExerciseChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  focusExerciseChipTitle: {
    flex: 1,
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  focusExerciseChipTitleActive: {
    color: '#DFFFD4',
  },
  focusExerciseChipCount: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 11,
    fontWeight: '900',
  },
  focusExerciseChipCountActive: {
    color: '#9CF02E',
  },
  focusExerciseMiniTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.1)',
    overflow: 'hidden',
  },
  focusExerciseMiniFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  completionPanel: {
    gap: 12,
  },
  completionCaptureFrame: {
    borderRadius: 28,
    backgroundColor: '#071007',
  },
  completionShareCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    padding: 18,
    gap: 15,
    overflow: 'hidden',
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completionMark: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  completionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  completionTitle: {
    color: '#F2FFE8',
    fontSize: 24,
    fontWeight: '900',
  },
  completionSubtitle: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 11,
    fontWeight: '800',
  },
  completionHeroStat: {
    borderRadius: 23,
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 15,
    gap: 3,
  },
  completionHeroLabel: {
    color: '#BCEAA9',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completionHeroValue: {
    color: '#F2FFE8',
    fontSize: 35,
    fontWeight: '900',
    letterSpacing: -1,
  },
  completionHeroHelper: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 11,
    fontWeight: '700',
  },
  completionMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  completionMetric: {
    flex: 1,
    minWidth: 112,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 11,
    gap: 5,
  },
  completionMetricValue: {
    color: '#F2FFE8',
    fontSize: 17,
    fontWeight: '900',
  },
  completionMetricLabel: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completionBestSet: {
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  completionBestSetCopy: {
    flex: 1,
    gap: 2,
  },
  completionBestSetLabel: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completionBestSetText: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  completionRecords: {
    gap: 9,
  },
  completionSectionTitle: {
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  completionRecordList: {
    gap: 7,
  },
  completionRecordItem: {
    borderRadius: 14,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  completionRecordText: {
    flex: 1,
    color: '#DFFFD4',
    fontSize: 11,
    fontWeight: '800',
  },
  completionRecordMore: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  completionNoRecords: {
    color: 'rgba(232, 246, 221, 0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  completionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  completionShareButton: {
    flex: 1,
    minWidth: 190,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completionShareText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  completionCloseButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCloseText: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  completionShareError: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  exerciseList: {
    gap: 12,
  },
  exerciseCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(14, 22, 15, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    overflow: 'hidden',
  },
  exerciseHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  exerciseHeaderStatic: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  exerciseBadge: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCopy: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    color: '#F2FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: 'rgba(232, 246, 221, 0.54)',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseOpenPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseOpenPillText: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
  },
  exerciseCompactMetaRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 240, 46, 0.08)',
    padding: 12,
    paddingTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseCompactPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseCompactPillText: {
    color: '#DDFBCB',
    fontSize: 11,
    fontWeight: '800',
  },
  previewSetList: {
    gap: 8,
    padding: 12,
    paddingTop: 0,
  },
  previewSetRow: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(2, 8, 3, 0.62)',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
  },
  setNumberPill: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  previewSetBody: {
    flex: 1,
    gap: 5,
  },
  previewSetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  setTypePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setTypeText: {
    color: '#061007',
    fontSize: 10,
    fontWeight: '900',
  },
  previewRir: {
    color: '#BCEAA9',
    fontSize: 11,
    fontWeight: '900',
  },
  previewSetTarget: {
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  lockedNotice: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedNoticeText: {
    flex: 1,
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 12,
    fontWeight: '700',
  },
  setList: {
    gap: 10,
    padding: 12,
    paddingTop: 0,
  },
  setRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232, 246, 221, 0.08)',
    backgroundColor: 'rgba(2, 8, 3, 0.62)',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  setRowDone: {
    borderColor: 'rgba(156, 240, 46, 0.34)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  setCheck: {
    paddingTop: 2,
  },
  setContent: {
    flex: 1,
    gap: 5,
  },
  setHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  setTarget: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '800',
  },
  setInstruction: {
    color: 'rgba(232, 246, 221, 0.54)',
    fontSize: 12,
    lineHeight: 17,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  compactInputWrap: {
    flex: 1,
    gap: 5,
  },
  compactLabel: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  compactInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  setTelemetryBlock: {
    marginTop: 7,
    gap: 10,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricTitle: {
    color: '#F2FFE8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricHint: {
    color: 'rgba(232, 246, 221, 0.48)',
    fontSize: 10,
    fontWeight: '800',
  },
  rirOptions: {
    gap: 7,
    paddingRight: 2,
  },
  rirChip: {
    minWidth: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  rirChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  rirChipLabel: {
    color: '#F2FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  rirChipLabelActive: {
    color: '#061007',
  },
  rirChipHelper: {
    color: 'rgba(232, 246, 221, 0.48)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rirChipHelperActive: {
    color: 'rgba(6, 16, 7, 0.72)',
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qualityChip: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 118,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  qualityCopy: {
    flex: 1,
    gap: 1,
  },
  qualityLabel: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  qualityLabelActive: {
    color: '#061007',
  },
  qualityHelper: {
    color: 'rgba(232, 246, 221, 0.46)',
    fontSize: 10,
    fontWeight: '800',
  },
  qualityHelperActive: {
    color: 'rgba(6, 16, 7, 0.68)',
  },
  setCompleteButton: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.3)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  setCompleteButtonDone: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  setCompleteButtonText: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  setCompleteButtonTextDone: {
    color: '#061007',
  },
  loggedText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  notesCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    padding: 13,
    gap: 10,
  },
  notesInput: {
    minHeight: 86,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 11,
    textAlignVertical: 'top',
  },
  sessionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minWidth: 160,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minWidth: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#9CF02E',
    fontSize: 13,
    fontWeight: '900',
  },
  cardioPanel: {
    gap: 14,
  },
  cardioRecommendation: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(7, 14, 8, 0.86)',
    padding: 16,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
  },
  cardioIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardioCopy: {
    flex: 1,
    gap: 3,
  },
  cardioText: {
    color: '#BCEAA9',
    fontSize: 13,
    fontWeight: '800',
  },
  cardioNotes: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  cardioProgressCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.72)',
    padding: 15,
    gap: 13,
  },
  weekDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 7,
  },
  weekDot: {
    flex: 1,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.22)',
    borderColor: 'rgba(156, 240, 46, 0.5)',
  },
  weekDotText: {
    color: '#BCEAA9',
    fontSize: 11,
    fontWeight: '900',
  },
  weekDotTextActive: {
    color: '#F2FFE8',
  },
  weekDotMinutes: {
    color: '#9CF02E',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 1,
  },
  cardioActions: {
    flex: 1,
    gap: 9,
  },
  cardioReadyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(7, 14, 8, 0.86)',
    padding: 16,
    gap: 14,
  },
  cardioReadyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardioActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardioActionPrimary: {
    flex: 1,
    minWidth: 142,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardioActionSecondary: {
    flex: 1,
    minWidth: 142,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardioHistoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.72)',
    padding: 15,
    gap: 13,
  },
  cardioRefreshButton: {
    width: 35,
    height: 35,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
  },
  cardioLogList: {
    gap: 9,
  },
  cardioLogRow: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardioLogIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardioLogCopy: {
    flex: 1,
    gap: 2,
  },
  cardioLogTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  cardioLogText: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 11,
    fontWeight: '700',
  },
  cardioLogMinutes: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  cardioEmptyLog: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(156, 240, 46, 0.055)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardioEmptyCopy: {
    flex: 1,
    gap: 2,
  },
  cardioEmptyTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  cardioSubHeader: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardioBackButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardioBackText: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '900',
  },
  cardioFormCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(6, 12, 7, 0.88)',
    padding: 16,
    gap: 14,
  },
  cardioFormHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardioFieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardioField: {
    flexGrow: 1,
    flexBasis: 132,
    gap: 7,
  },
  cardioFieldLabel: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardioInput: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  cardioTextarea: {
    minHeight: 92,
    lineHeight: 19,
  },
  intensityPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  intensityChip: {
    flexGrow: 1,
    flexBasis: 128,
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(9, 16, 10, 0.82)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intensityChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  intensityChipCopy: {
    flex: 1,
    gap: 1,
  },
  intensityChipTitle: {
    color: '#F2FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  intensityChipTitleActive: {
    color: '#061007',
  },
  intensityChipText: {
    color: 'rgba(232, 246, 221, 0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  intensityChipTextActive: {
    color: 'rgba(6, 16, 7, 0.7)',
  },
  cardioPrimaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  cardioErrorText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  timerCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  timerValue: {
    color: '#F2FFE8',
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  timerHint: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  timerActions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 5,
  },
  timerMainButton: {
    flex: 1,
    minWidth: 140,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timerGhostButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(6, 12, 7, 0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  zonesCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.72)',
    padding: 15,
    gap: 13,
  },
  zoneList: {
    gap: 9,
  },
  zoneRow: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  zoneCopy: {
    flex: 1,
    gap: 2,
  },
  zoneTitle: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  zoneHelper: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  zoneRange: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  exerciseExplorer: {
    gap: 14,
  },
  exerciseIntroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 18,
    gap: 16,
  },
  exerciseIntroIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  exerciseIntroCopy: {
    gap: 5,
  },
  exerciseIntroTitle: {
    color: '#F2FFE8',
    fontSize: 24,
    fontWeight: '900',
  },
  exerciseIntroText: {
    color: 'rgba(232, 246, 221, 0.62)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  exerciseIntroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  exerciseIntroStat: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
  },
  exerciseIntroStatValue: {
    color: '#F2FFE8',
    fontSize: 20,
    fontWeight: '900',
  },
  exerciseIntroStatLabel: {
    color: 'rgba(232, 246, 221, 0.54)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  openLibraryButton: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openLibraryButtonText: {
    color: '#061007',
    fontSize: 14,
    fontWeight: '900',
  },
  exerciseLibraryHeader: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  libraryBackButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  libraryBackText: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '900',
  },
  libraryHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  libraryTitle: {
    color: '#F2FFE8',
    fontSize: 20,
    fontWeight: '900',
  },
  exerciseSearchCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    paddingHorizontal: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: {
    width: 31,
    height: 31,
    borderRadius: 12,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseSearchInput: {
    flex: 1,
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 12,
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseFilterList: {
    gap: 8,
    paddingVertical: 2,
  },
  exerciseFilterChip: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(9, 16, 10, 0.82)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  exerciseFilterChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  exerciseFilterText: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '900',
  },
  exerciseFilterTextActive: {
    color: '#061007',
  },
  libraryCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearFiltersButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearFiltersText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  exerciseObjectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exerciseObjectCard: {
    flexGrow: 1,
    flexBasis: 155,
    maxWidth: 260,
    minHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(9, 16, 10, 0.82)',
    padding: 13,
    gap: 8,
  },
  exerciseObjectCardActive: {
    borderColor: '#9CF02E',
    backgroundColor: 'rgba(156, 240, 46, 0.14)',
  },
  exerciseObjectIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseObjectIconActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  exerciseObjectName: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  exerciseObjectNameActive: {
    color: '#F2FFE8',
  },
  exerciseObjectMeta: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseObjectMetaActive: {
    color: '#BCEAA9',
  },
  selectExerciseHint: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.72)',
    padding: 18,
    alignItems: 'center',
    gap: 7,
  },
  selectExerciseTitle: {
    color: '#F2FFE8',
    fontSize: 16,
    fontWeight: '900',
  },
  selectExerciseText: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '700',
  },
  exerciseDetailCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(5, 11, 6, 0.92)',
    padding: 16,
    gap: 15,
  },
  exerciseDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  exerciseDetailCopy: {
    flex: 1,
    gap: 2,
  },
  exerciseDetailTitle: {
    color: '#F2FFE8',
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 25,
  },
  exerciseDetailSubtitle: {
    color: 'rgba(232, 246, 221, 0.58)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  closeDetailButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRecordHero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  exerciseRecordIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRecordCopy: {
    flex: 1,
    gap: 2,
  },
  exerciseRecordLabel: {
    color: '#B7FF5A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  exerciseRecordValue: {
    color: '#F2FFE8',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  exerciseRecordText: {
    color: 'rgba(232, 246, 221, 0.6)',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  exerciseTrendPill: {
    minWidth: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(6, 13, 7, 0.74)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 1,
  },
  exerciseTrendLabel: {
    color: 'rgba(232, 246, 221, 0.54)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exerciseTrendValue: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  exerciseMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseMetricChip: {
    flex: 1,
    minWidth: 104,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  exerciseMetricChipCopy: {
    flex: 1,
    gap: 1,
  },
  exerciseMetricValue: {
    color: '#F2FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  exerciseMetricLabel: {
    color: 'rgba(232, 246, 221, 0.54)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  latestBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  graphCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.62)',
    padding: 14,
  },
  graphBars: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 10,
  },
  graphPoint: {
    flex: 1,
    minWidth: 48,
    alignItems: 'center',
    gap: 5,
  },
  graphColumnShell: {
    height: 104,
    width: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.07)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  graphColumn: {
    width: '100%',
    borderRadius: 999,
  },
  graphValue: {
    color: '#F2FFE8',
    fontSize: 10,
    fontWeight: '900',
  },
  graphDate: {
    color: 'rgba(232, 246, 221, 0.48)',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyGraph: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    padding: 18,
    alignItems: 'center',
    gap: 7,
  },
  emptyGraphTitle: {
    color: '#F2FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyGraphText: {
    color: 'rgba(232, 246, 221, 0.56)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  latestSessionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  latestSessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestSessionDate: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
