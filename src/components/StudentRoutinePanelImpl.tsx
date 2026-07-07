import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import type { Profile } from '../types/auth';
import type { Student } from '../types/student';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type NoteKind = 'task' | 'idea' | 'reminder';
type RoutineFilter = 'all' | 'open' | 'done' | 'pinned' | 'reminders';
type RoutineWorkspace = 'ideas' | 'habits';

type RoutineNote = {
  id: string;
  text: string;
  kind: NoteKind;
  dueDate: string;
  pinned: boolean;
  done: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
};

type RoutineHabit = {
  id: string;
  title: string;
  note: string;
  time: string;
  weekdays: number[];
  reminderEnabled: boolean;
  pinned: boolean;
  snoozedUntil: string | null;
  completions: string[];
  notificationIds: string[];
  notificationPlanKey: string;
  createdAt: string;
  updatedAt: string;
};

type RoutineState = {
  notes: RoutineNote[];
  habits: RoutineHabit[];
  compactMode: boolean;
  updatedAt: string;
};

type StudentRoutinePanelProps = {
  student: Student;
  profile: Profile;
};

type WeekDayMeta = {
  index: number;
  short: string;
  label: string;
};

type TimelineDay = WeekDayMeta & {
  dateKey: string;
  dateLabel: string;
  isToday: boolean;
  isSelected: boolean;
  noteCount: number;
  habitCount: number;
};

type ActivityItem = {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  color: string;
};

const ROUTINE_STORAGE_PREFIX = '@consultoria:routine';
const ROUTINE_NOTIFICATION_CHANNEL = 'routine-reminders';

const NOTE_KIND_META: Record<NoteKind, { label: string; icon: IconName; color: string }> = {
  task: { label: 'Tarefa', icon: 'clipboard-text-outline', color: '#9CF02E' },
  idea: { label: 'Ideia', icon: 'lightbulb-outline', color: '#86EFAC' },
  reminder: { label: 'Lembrete', icon: 'bell-outline', color: '#FDE68A' },
};

const FILTER_META: Array<{ value: RoutineFilter; label: string; icon: IconName }> = [
  { value: 'all', label: 'Tudo', icon: 'view-grid-outline' },
  { value: 'open', label: 'Abertas', icon: 'circle-outline' },
  { value: 'done', label: 'Concluídas', icon: 'check-circle-outline' },
  { value: 'pinned', label: 'Fixadas', icon: 'pin-outline' },
  { value: 'reminders', label: 'Alertas', icon: 'bell-outline' },
];

const WORKSPACE_META: Record<
  RoutineWorkspace,
  {
    title: string;
    subtitle: string;
    icon: IconName;
    accent: string;
    actionLabel: string;
  }
> = {
  ideas: {
    title: 'Ideias',
    subtitle: 'Anotações rápidas, tarefas e lembretes do dia.',
    icon: 'lightbulb-outline',
    accent: '#9CF02E',
    actionLabel: 'Abrir ideias',
  },
  habits: {
    title: 'Hábitos',
    subtitle: 'Marque dias, horários e lembretes recorrentes.',
    icon: 'repeat',
    accent: '#86EFAC',
    actionLabel: 'Abrir hábitos',
  },
};

const WEEKDAYS: WeekDayMeta[] = [
  { index: 0, short: 'D', label: 'Dom' },
  { index: 1, short: 'S', label: 'Seg' },
  { index: 2, short: 'T', label: 'Ter' },
  { index: 3, short: 'Q', label: 'Qua' },
  { index: 4, short: 'Q', label: 'Qui' },
  { index: 5, short: 'S', label: 'Sex' },
  { index: 6, short: 'S', label: 'Sab' },
];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year || 0, (month || 1) - 1, day || 1);
}

function formatDateKey(key: string) {
  return dateFromKey(key).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatShortDate(key: string) {
  return dateFromKey(key).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function weekdayLabel(index: number) {
  return WEEKDAYS.find((item) => item.index === index)?.label ?? 'Dia';
}

function weekdayShort(index: number) {
  return WEEKDAYS.find((item) => item.index === index)?.short ?? 'D';
}

function parseTime(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number.parseInt(hourText ?? '', 10);
  const minute = Number.parseInt(minuteText ?? '', 10);

  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 8,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

function formatTime(value: string) {
  const { hour, minute } = parseTime(value);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultNote(dueDate: string): RoutineNote {
  const now = new Date().toISOString();

  return {
    id: createId('note'),
    text: '',
    kind: 'task',
    dueDate,
    pinned: false,
    done: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    doneAt: null,
  };
}

function createDefaultHabit(): RoutineHabit {
  const now = new Date().toISOString();

  return {
    id: createId('habit'),
    title: '',
    note: '',
    time: '08:00',
    weekdays: [1, 2, 3, 4, 5],
    reminderEnabled: true,
    pinned: false,
    snoozedUntil: null,
    completions: [],
    notificationIds: [],
    notificationPlanKey: '',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeNote(input: Partial<RoutineNote> | null | undefined, fallbackDate: string): RoutineNote {
  const now = new Date().toISOString();
  const text = typeof input?.text === 'string' ? input.text : '';
  const kind = input?.kind === 'idea' || input?.kind === 'reminder' ? input.kind : 'task';
  const dueDate = typeof input?.dueDate === 'string' && input.dueDate ? input.dueDate : fallbackDate;

  return {
    id: typeof input?.id === 'string' && input.id ? input.id : createId('note'),
    text,
    kind,
    dueDate,
    pinned: Boolean(input?.pinned),
    done: Boolean(input?.done),
    archived: Boolean(input?.archived),
    createdAt: typeof input?.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : now,
    doneAt: typeof input?.doneAt === 'string' ? input.doneAt : null,
  };
}

function normalizeHabit(input: Partial<RoutineHabit> | null | undefined): RoutineHabit {
  const now = new Date().toISOString();
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 6))).sort(
        (a, b) => a - b,
      )
    : [1, 2, 3, 4, 5];

  return {
    id: typeof input?.id === 'string' && input.id ? input.id : createId('habit'),
    title: typeof input?.title === 'string' ? input.title : '',
    note: typeof input?.note === 'string' ? input.note : '',
    time: typeof input?.time === 'string' ? formatTime(input.time) : '08:00',
    weekdays,
    reminderEnabled: input?.reminderEnabled !== false,
    pinned: Boolean(input?.pinned),
    snoozedUntil: typeof input?.snoozedUntil === 'string' && input.snoozedUntil ? input.snoozedUntil : null,
    completions: Array.isArray(input?.completions)
      ? Array.from(new Set(input.completions.filter((value): value is string => typeof value === 'string' && value.length > 0)))
      : [],
    notificationIds: Array.isArray(input?.notificationIds)
      ? input.notificationIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [],
    notificationPlanKey: typeof input?.notificationPlanKey === 'string' ? input.notificationPlanKey : '',
    createdAt: typeof input?.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : now,
  };
}

function normalizeRoutineState(raw: unknown, fallbackDate: string): RoutineState {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<RoutineState>) : {};

  return {
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((note) => normalizeNote(note as Partial<RoutineNote>, fallbackDate)) : [],
    habits: Array.isArray(parsed.habits) ? parsed.habits.map((habit) => normalizeHabit(habit as Partial<RoutineHabit>)) : [],
    compactMode: Boolean(parsed.compactMode),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
  };
}

function buildRoutineSignature(habit: RoutineHabit) {
  return [
    habit.title.trim().toLowerCase(),
    formatTime(habit.time),
    habit.weekdays.join(','),
    habit.reminderEnabled ? '1' : '0',
    habit.snoozedUntil ?? '',
  ].join('|');
}

function calculateStreak(completions: string[]) {
  const completed = new Set(completions);
  let streak = 0;
  const cursor = new Date();

  for (let i = 0; i < 365; i += 1) {
    const key = localDateKey(cursor);

    if (!completed.has(key)) {
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }

      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getNextOccurrence(habit: RoutineHabit) {
  if (!habit.reminderEnabled || !habit.weekdays.length) {
    return null;
  }

  if (habit.snoozedUntil && habit.snoozedUntil >= localDateKey()) {
    return null;
  }

  const { hour, minute } = parseTime(habit.time);
  const now = new Date();

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    if (candidate <= now) {
      continue;
    }

    if (habit.weekdays.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return null;
}

function isHabitCompletedOnDate(habit: RoutineHabit, dateKey: string) {
  return habit.completions.includes(dateKey);
}

function getWeekSeries(baseDateKey: string): TimelineDay[] {
  const base = dateFromKey(baseDateKey);
  const mondayOffset = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = localDateKey(date);

    return {
      index: date.getDay(),
      short: weekdayShort(date.getDay()),
      label: weekdayLabel(date.getDay()),
      dateKey,
      dateLabel: formatShortDate(dateKey),
      isToday: dateKey === localDateKey(),
      isSelected: dateKey === baseDateKey,
      noteCount: 0,
      habitCount: 0,
    };
  });
}

function matchesSearch(value: string, query: string) {
  if (!query) {
    return true;
  }

  return value.toLowerCase().includes(query);
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 16,
      stiffness: 240,
      mass: 0.85,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return { scale, animateTo };
}

function PressScaleButton({
  children,
  onPress,
  style,
  contentStyle,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: object;
  contentStyle?: object;
  disabled?: boolean;
}) {
  const { scale, animateTo } = usePressScale();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.98)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.02)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [contentStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  compact,
  anim,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
  anim: Animated.Value;
  children: ReactNode;
}) {
  return (
    <Animated.View
      style={[
        styles.sectionCard,
        compact && styles.sectionCardCompact,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionKicker}>{title.toUpperCase()}</Text>
          {subtitle ? <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{subtitle}</Text> : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
      {children}
    </Animated.View>
  );
}

function WorkspaceCard({
  workspace,
  active,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  onPress,
}: {
  workspace: RoutineWorkspace;
  active: boolean;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  secondaryLabel: string;
  onPress: () => void;
}) {
  const meta = WORKSPACE_META[workspace];

  return (
    <PressScaleButton
      onPress={onPress}
      style={styles.workspaceCardShell}
      contentStyle={[styles.workspaceCard, active && styles.workspaceCardActive]}
    >
      <LinearGradient
        colors={active ? ['rgba(156, 240, 46, 0.22)', 'rgba(7, 10, 7, 0.98)'] : ['rgba(12, 16, 12, 0.92)', 'rgba(7, 10, 7, 0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.workspaceCardFill}
      >
        <View style={styles.workspaceCardTop}>
          <View style={[styles.workspaceCardIcon, active && styles.workspaceCardIconActive]}>
            <MaterialCommunityIcons name={meta.icon} size={21} color={active ? '#061007' : meta.accent} />
          </View>

          <View style={styles.workspaceCardCopy}>
            <Text style={[styles.workspaceCardKicker, active && styles.workspaceCardKickerActive]}>
              {active ? 'ABERTO AGORA' : meta.title.toUpperCase()}
            </Text>
            <Text style={styles.workspaceCardTitle}>{meta.title}</Text>
            <Text style={styles.workspaceCardSubtitle}>{meta.subtitle}</Text>
          </View>

          <View style={styles.workspaceCardArrow}>
            <Feather name={active ? 'chevron-down' : 'chevron-right'} size={16} color={active ? '#061007' : '#9CF02E'} />
          </View>
        </View>

        <View style={styles.workspaceCardStats}>
          <View style={styles.workspaceStat}>
            <Text style={[styles.workspaceStatValue, active && styles.workspaceStatValueActive]}>{primaryValue}</Text>
            <Text style={[styles.workspaceStatLabel, active && styles.workspaceStatLabelActive]}>{primaryLabel}</Text>
          </View>
          <View style={styles.workspaceStat}>
            <Text style={[styles.workspaceStatValue, active && styles.workspaceStatValueActive]}>{secondaryValue}</Text>
            <Text style={[styles.workspaceStatLabel, active && styles.workspaceStatLabelActive]}>{secondaryLabel}</Text>
          </View>
        </View>
      </LinearGradient>
    </PressScaleButton>
  );
}

function MetricPill({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={15} color="#061007" />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressScaleButton onPress={onPress} style={styles.filterChipShell} contentStyle={[styles.filterChip, active && styles.filterChipActive]}>
      <MaterialCommunityIcons name={icon} size={14} color={active ? '#061007' : '#9CF02E'} />
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </PressScaleButton>
  );
}

function TinyAction({
  icon,
  label,
  onPress,
  active = false,
  tone = 'soft',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  tone?: 'soft' | 'primary' | 'danger';
}) {
  return (
    <PressScaleButton
      onPress={onPress}
      style={styles.tinyActionShell}
      contentStyle={[
        styles.tinyAction,
        tone === 'primary' && styles.tinyActionPrimary,
        tone === 'danger' && styles.tinyActionDanger,
        active && styles.tinyActionActive,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={13} color={active || tone === 'primary' ? '#061007' : tone === 'danger' ? '#FCA5A5' : '#9CF02E'} />
      <Text
        style={[
          styles.tinyActionText,
          active && styles.tinyActionTextActive,
          tone === 'primary' && styles.tinyActionTextPrimary,
        ]}
      >
        {label}
      </Text>
    </PressScaleButton>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={24} color="#061007" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function NoteCard({
  note,
  selected,
  compact,
  onToggleDone,
  onTogglePin,
  onArchive,
  onEdit,
  onDelete,
}: {
  note: RoutineNote;
  selected: boolean;
  compact: boolean;
  onToggleDone: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kindMeta = NOTE_KIND_META[note.kind];

  return (
    <View style={[styles.itemCard, selected && styles.itemCardSelected, compact && styles.itemCardCompact]}>
      <View style={styles.itemTopRow}>
        <Pressable onPress={onToggleDone} style={({ pressed }) => [styles.itemState, note.done && styles.itemStateDone, pressed && styles.pressed]}>
          <MaterialCommunityIcons name={note.done ? 'check-circle' : 'circle-outline'} size={16} color={note.done ? '#061007' : '#9CF02E'} />
        </Pressable>

        <View style={styles.itemCopy}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, note.done && styles.itemTitleDone]} numberOfLines={compact ? 1 : 2}>
              {note.text || 'Nota sem titulo'}
            </Text>
            <View style={[styles.kindBadge, { borderColor: kindMeta.color, backgroundColor: `${kindMeta.color}16` }]}>
              <MaterialCommunityIcons name={kindMeta.icon} size={11} color={kindMeta.color} />
              <Text style={[styles.kindBadgeText, { color: kindMeta.color }]}>{kindMeta.label}</Text>
            </View>
          </View>

          <Text style={styles.itemMeta}>
            {note.done ? 'Concluida' : 'Em aberto'} • {formatDateKey(note.dueDate)}
          </Text>
        </View>

        <View style={styles.itemActions}>
          <Pressable onPress={onTogglePin} style={({ pressed }) => [styles.iconAction, note.pinned && styles.iconActionActive, pressed && styles.pressed]}>
            <Feather name="bookmark" size={14} color={note.pinned ? '#061007' : '#9CF02E'} />
          </Pressable>
          <Pressable onPress={onEdit} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name="edit-3" size={14} color="#9CF02E" />
          </Pressable>
          <Pressable onPress={onArchive} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name="archive" size={14} color="#9CF02E" />
          </Pressable>
          <Pressable onPress={onDelete} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name="trash-2" size={14} color="#FCA5A5" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HabitCard({
  habit,
  selectedDateKey,
  selected,
  compact,
  onToggleCompletion,
  onTogglePin,
  onEdit,
  onDelete,
  onSnooze,
}: {
  habit: RoutineHabit;
  selectedDateKey: string;
  selected: boolean;
  compact: boolean;
  onToggleCompletion: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSnooze: () => void;
}) {
  const completedToday = isHabitCompletedOnDate(habit, selectedDateKey);
  const nextReminder = getNextOccurrence(habit);
  const streak = calculateStreak(habit.completions);
  const snoozed = Boolean(habit.snoozedUntil && habit.snoozedUntil >= localDateKey());

  return (
    <View style={[styles.itemCard, selected && styles.itemCardSelected, compact && styles.itemCardCompact]}>
      <View style={styles.itemTopRow}>
        <Pressable onPress={onToggleCompletion} style={({ pressed }) => [styles.itemState, completedToday && styles.itemStateDone, pressed && styles.pressed]}>
          <MaterialCommunityIcons name={completedToday ? 'check-circle' : 'circle-outline'} size={16} color={completedToday ? '#061007' : '#9CF02E'} />
        </Pressable>

        <View style={styles.itemCopy}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, completedToday && styles.itemTitleDone]} numberOfLines={compact ? 1 : 2}>
              {habit.title || 'Habito sem nome'}
            </Text>
            <View style={[styles.timeBadge, snoozed && styles.timeBadgeMuted]}>
              <Feather name={snoozed ? 'bell-off' : 'clock'} size={11} color={snoozed ? '#FDE68A' : '#9CF02E'} />
              <Text style={[styles.timeBadgeText, snoozed && styles.timeBadgeTextMuted]}>{formatTime(habit.time)}</Text>
            </View>
          </View>

          {habit.note ? (
            <Text style={styles.itemMeta} numberOfLines={compact ? 1 : 2}>
              {habit.note}
            </Text>
          ) : (
            <Text style={styles.itemMeta}>
              {habit.reminderEnabled ? 'Lembrete ativo' : 'Lembrete desativado'} • {habit.weekdays.map((day) => weekdayShort(day)).join(' ')}
            </Text>
          )}
        </View>

        <View style={styles.itemActions}>
          <Pressable onPress={onTogglePin} style={({ pressed }) => [styles.iconAction, habit.pinned && styles.iconActionActive, pressed && styles.pressed]}>
            <Feather name="bookmark" size={14} color={habit.pinned ? '#061007' : '#9CF02E'} />
          </Pressable>
          <Pressable onPress={onEdit} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name="edit-3" size={14} color="#9CF02E" />
          </Pressable>
          <Pressable onPress={onSnooze} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name={snoozed ? 'bell-off' : 'moon'} size={14} color={snoozed ? '#FDE68A' : '#9CF02E'} />
          </Pressable>
          <Pressable onPress={onDelete} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <Feather name="trash-2" size={14} color="#FCA5A5" />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => {
          const active = habit.weekdays.includes(day.index);
          return (
            <View key={`${habit.id}-${day.index}`} style={[styles.dayChip, active && styles.dayChipActive, compact && styles.dayChipCompact]}>
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day.short}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Sequencia</Text>
        <Text style={styles.progressValue}>{streak} dias</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, 12 + streak * 12)}%` }]} />
      </View>

      <View style={styles.itemFooter}>
        <Text style={styles.itemFooterText}>
          {nextReminder ? `Proximo: ${nextReminder.toLocaleDateString('pt-BR')} ${nextReminder.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sem proximo lembrete'}
        </Text>
        <View style={styles.footerActions}>
          <TinyAction icon="check" label="Hoje" onPress={onToggleCompletion} active={completedToday} tone="primary" />
          <TinyAction icon="bell-off-outline" label="24h" onPress={onSnooze} />
        </View>
      </View>
    </View>
  );
}

function HistoryRow({
  icon,
  title,
  meta,
}: {
  icon: IconName;
  title: string;
  meta: string;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <MaterialCommunityIcons name={icon} size={14} color="#061007" />
      </View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.historyMeta} numberOfLines={2}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

function DayPill({
  day,
  onPress,
}: {
  day: TimelineDay;
  onPress: () => void;
}) {
  return (
    <PressScaleButton onPress={onPress} style={styles.dayPillShell} contentStyle={[styles.dayPill, day.isSelected && styles.dayPillSelected, day.isToday && styles.dayPillToday]}>
      <Text style={[styles.dayPillLabel, day.isSelected && styles.dayPillLabelSelected]}>{day.label}</Text>
      <Text style={[styles.dayPillDate, day.isSelected && styles.dayPillLabelSelected]}>{day.dateLabel}</Text>
      <Text style={[styles.dayPillCounts, day.isSelected && styles.dayPillLabelSelected]}>
        {day.noteCount} N • {day.habitCount} H
      </Text>
    </PressScaleButton>
  );
}

export function StudentRoutinePanel({ student, profile }: StudentRoutinePanelProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isWeb = Platform.OS === 'web';
  const storageKey = `${ROUTINE_STORAGE_PREFIX}:${student.consultancy_id}:${student.id}`;
  const today = localDateKey();

  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [routine, setRoutine] = useState<RoutineState>({
    notes: [],
    habits: [],
    compactMode: false,
    updatedAt: new Date().toISOString(),
  });
  const [selectedDateKey, setSelectedDateKey] = useState(today);
  const [filterMode, setFilterMode] = useState<RoutineFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [activeWorkspace, setActiveWorkspace] = useState<RoutineWorkspace>('ideas');

  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteKind, setNoteKind] = useState<NoteKind>('task');
  const [notePinned, setNotePinned] = useState(false);
  const [noteDueDate, setNoteDueDate] = useState(today);

  const [habitDraftId, setHabitDraftId] = useState<string | null>(null);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitNote, setHabitNote] = useState('');
  const [habitTime, setHabitTime] = useState('08:00');
  const [habitDays, setHabitDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [habitPinned, setHabitPinned] = useState(false);
  const [habitReminderEnabled, setHabitReminderEnabled] = useState(true);

  const noteInputRef = useRef<{ focus: () => void } | null>(null);
  const habitInputRef = useRef<{ focus: () => void } | null>(null);
  const searchInputRef = useRef<{ focus: () => void } | null>(null);

  const screenAnim = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.stagger(
        85,
        sectionAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 420,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ),
      ),
    ]).start();
  }, [screenAnim, sectionAnims, student.id]);

  useEffect(() => {
    let active = true;

    const loadRoutine = async () => {
      setLoaded(false);

      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : null;

        if (!active) {
          return;
        }

        const nextRoutine = normalizeRoutineState(parsed, today);
        setRoutine(nextRoutine);
        setSelectedDateKey(today);
        setNoteDueDate(today);
      } catch {
        if (active) {
          setRoutine({
            notes: [],
            habits: [],
            compactMode: false,
            updatedAt: new Date().toISOString(),
          });
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    };

    void loadRoutine();

    return () => {
      active = false;
    };
  }, [storageKey, today]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    void AsyncStorage.setItem(storageKey, JSON.stringify({ ...routine, updatedAt: new Date().toISOString() })).catch(() => {
      setErrorMessage('Nao foi possivel salvar a rotina localmente.');
    });
  }, [loaded, routine, storageKey]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const syncNotifications = async () => {
      if (isWeb) {
        setInfoMessage('No navegador, os lembretes ficam visuais. No app mobile eles viram notificacoes locais.');
        return;
      }

      try {
        const permission = await Notifications.getPermissionsAsync();
        let status = permission.status;

        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }

        if (status !== 'granted') {
          setInfoMessage('Permita notificacoes para receber lembretes dos habitos.');
          return;
        }

        await Notifications.setNotificationChannelAsync(ROUTINE_NOTIFICATION_CHANNEL, {
          name: 'Lembretes da rotina',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 200, 160, 200],
        });

        const nextHabits = await Promise.all(
          routine.habits.map(async (habit) => {
            const signature = buildRoutineSignature(habit);
            const snoozed = Boolean(habit.snoozedUntil && habit.snoozedUntil >= today);

            if (!habit.reminderEnabled || !habit.weekdays.length || snoozed) {
              if (habit.notificationIds.length) {
                await Promise.all(habit.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
              }

              return {
                ...habit,
                notificationIds: [],
                notificationPlanKey: signature,
              };
            }

            if (habit.notificationPlanKey === signature && habit.notificationIds.length === habit.weekdays.length) {
              return habit;
            }

            if (habit.notificationIds.length) {
              await Promise.all(habit.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
            }

            const { hour, minute } = parseTime(habit.time);
            const scheduledIds = await Promise.all(
              habit.weekdays.map((weekday) =>
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: `Hora do habito: ${habit.title}`,
                    body: `${student.full_name} - ${habit.time} (${weekdayLabel(weekday)})`,
                    sound: true,
                    data: {
                      studentId: student.id,
                      habitId: habit.id,
                    },
                  },
                  trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday: weekday + 1,
                    hour,
                    minute,
                    channelId: ROUTINE_NOTIFICATION_CHANNEL,
                  },
                }),
              ),
            );

            return {
              ...habit,
              notificationIds: scheduledIds,
              notificationPlanKey: signature,
            };
          }),
        );

        const changed = nextHabits.some((habit, index) => habit.notificationPlanKey !== routine.habits[index]?.notificationPlanKey || habit.notificationIds.join('|') !== routine.habits[index]?.notificationIds.join('|'));

        if (changed) {
          setRoutine((current) => ({
            ...current,
            habits: nextHabits,
            updatedAt: new Date().toISOString(),
          }));
        }

        setInfoMessage(null);
      } catch {
        setInfoMessage('As notificacoes locais nao puderam ser configuradas agora.');
      }
    };

    void syncNotifications();
  }, [loaded, routine.habits, student.full_name, student.id, today, isWeb]);

  useEffect(() => {
    if (noteDraftId === null) {
      setNoteDueDate(selectedDateKey);
    }
  }, [noteDraftId, selectedDateKey]);

  const updateRoutine = (updater: (current: RoutineState) => RoutineState) => {
    setRoutine((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
    setErrorMessage(null);
  };

  const clearNoteDraft = () => {
    setNoteDraftId(null);
    setNoteText('');
    setNoteKind('task');
    setNotePinned(false);
    setNoteDueDate(selectedDateKey);
  };

  const clearHabitDraft = () => {
    setHabitDraftId(null);
    setHabitTitle('');
    setHabitNote('');
    setHabitTime('08:00');
    setHabitDays([1, 2, 3, 4, 5]);
    setHabitPinned(false);
    setHabitReminderEnabled(true);
  };

  const noteComposerDateLabel = useMemo(() => formatShortDate(noteDueDate), [noteDueDate]);
  const compactMode = routine.compactMode;

  const weekSeries = useMemo(() => {
    const series = getWeekSeries(selectedDateKey);
    const weekdayMap = new Map<number, number>();

    routine.notes
      .filter((note) => !note.archived && note.dueDate)
      .forEach((note) => {
        weekdayMap.set(dateFromKey(note.dueDate).getDay(), (weekdayMap.get(dateFromKey(note.dueDate).getDay()) ?? 0) + 1);
      });

    const habitCounts = new Map<number, number>();
    routine.habits.forEach((habit) => {
      habit.weekdays.forEach((weekday) => {
        if (habit.reminderEnabled && !(habit.snoozedUntil && habit.snoozedUntil >= today)) {
          habitCounts.set(weekday, (habitCounts.get(weekday) ?? 0) + 1);
        }
      });
    });

    return series.map((day) => ({
      ...day,
      noteCount: weekdayMap.get(day.index) ?? 0,
      habitCount: habitCounts.get(day.index) ?? 0,
    }));
  }, [routine.habits, routine.notes, selectedDateKey, today]);

  const searchQuery = searchText.trim().toLowerCase();
  const selectedWeekday = dateFromKey(selectedDateKey).getDay();

  const visibleNotes = useMemo(() => {
    return routine.notes
      .filter((note) => {
        if (note.archived && filterMode !== 'done') {
          return false;
        }

        if (filterMode === 'open' && (note.done || note.archived)) {
          return false;
        }

        if (filterMode === 'done' && !(note.done || note.archived)) {
          return false;
        }

        if (filterMode === 'pinned' && !note.pinned) {
          return false;
        }

        if (filterMode === 'reminders' && note.kind !== 'reminder') {
          return false;
        }

        const matchesText = matchesSearch(`${note.text} ${NOTE_KIND_META[note.kind].label} ${formatDateKey(note.dueDate)}`, searchQuery);
        return matchesText;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        if (a.done !== b.done) {
          return a.done ? 1 : -1;
        }

        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }

        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [filterMode, routine.notes, searchQuery]);

  const visibleHabits = useMemo(() => {
    return routine.habits
      .filter((habit) => {
        const completedToday = isHabitCompletedOnDate(habit, selectedDateKey);

        if (filterMode === 'open' && completedToday) {
          return false;
        }

        if (filterMode === 'done' && !completedToday && calculateStreak(habit.completions) === 0) {
          return false;
        }

        if (filterMode === 'pinned' && !habit.pinned) {
          return false;
        }

        if (filterMode === 'reminders' && !habit.reminderEnabled) {
          return false;
        }

        const helperText = `${habit.title} ${habit.note} ${habit.weekdays.map((day) => weekdayLabel(day)).join(' ')} ${formatTime(habit.time)}`;
        return matchesSearch(helperText, searchQuery);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        if (a.reminderEnabled !== b.reminderEnabled) {
          return a.reminderEnabled ? -1 : 1;
        }

        return a.title.localeCompare(b.title);
      });
  }, [filterMode, routine.habits, searchQuery, selectedDateKey]);

  const todayNotes = useMemo(
    () =>
      routine.notes.filter(
        (note) => !note.archived && note.dueDate === selectedDateKey && (!searchQuery || matchesSearch(note.text, searchQuery)),
      ),
    [routine.notes, searchQuery, selectedDateKey],
  );

  const todayHabits = useMemo(
    () =>
      routine.habits.filter((habit) => {
        const snoozed = Boolean(habit.snoozedUntil && habit.snoozedUntil >= today);
        return habit.weekdays.includes(selectedWeekday) && !snoozed && (!searchQuery || matchesSearch(habit.title + habit.note, searchQuery));
      }),
    [routine.habits, searchQuery, selectedWeekday, today],
  );

  const pinnedNotes = useMemo(() => routine.notes.filter((note) => note.pinned && !note.archived), [routine.notes]);
  const pinnedHabits = useMemo(() => routine.habits.filter((habit) => habit.pinned), [routine.habits]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const noteHistory = routine.notes
      .filter((note) => note.doneAt)
      .map<ActivityItem>((note) => ({
        id: `note-${note.id}`,
        icon: NOTE_KIND_META[note.kind].icon,
        title: note.text || 'Nota concluida',
        meta: `Concluida em ${formatDateKey(localDateKey(new Date(note.doneAt ?? Date.now())))} `,
        color: NOTE_KIND_META[note.kind].color,
      }));

    const habitHistory = routine.habits.flatMap((habit) =>
      habit.completions.map<ActivityItem>((dateKey) => ({
        id: `habit-${habit.id}-${dateKey}`,
        icon: 'calendar-check-outline' as IconName,
        title: habit.title || 'Habito concluido',
        meta: `Marcado em ${formatDateKey(dateKey)}`,
        color: '#9CF02E',
      })),
    );

    return [...noteHistory, ...habitHistory]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 6);
  }, [routine.habits, routine.notes]);

  const nextReminder = useMemo(() => {
    return routine.habits
      .map((habit) => ({ habit, next: getNextOccurrence(habit) }))
      .filter((entry): entry is { habit: RoutineHabit; next: Date } => Boolean(entry.next))
      .sort((a, b) => a.next.getTime() - b.next.getTime())[0] ?? null;
  }, [routine.habits]);

  const stats = useMemo(() => {
    const openNotes = routine.notes.filter((note) => !note.done && !note.archived).length;
    const doneNotes = routine.notes.filter((note) => note.done || note.archived).length;
    const activeHabits = routine.habits.length;
    const reminders = routine.habits.filter((habit) => habit.reminderEnabled && !(habit.snoozedUntil && habit.snoozedUntil >= today)).length;
    const bestStreak = routine.habits.reduce((best, habit) => Math.max(best, calculateStreak(habit.completions)), 0);

    return { openNotes, doneNotes, activeHabits, reminders, bestStreak };
  }, [routine.habits, routine.notes, today]);

  const activeWorkspaceMeta = WORKSPACE_META[activeWorkspace];
  const ideaCardCount = routine.notes.filter((note) => !note.archived).length;
  const ideaPinnedCount = routine.notes.filter((note) => note.pinned && !note.archived).length;
  const habitCardCount = routine.habits.length;
  const habitActiveCount = stats.activeHabits;

  const selectedDateLabel = useMemo(() => dateFormatter.format(dateFromKey(selectedDateKey)), [selectedDateKey]);

  const syncSelectedDateFromNote = (nextDateKey: string) => {
    setNoteDueDate(nextDateKey);
    setSelectedDateKey(nextDateKey);
  };

  const handleSaveNote = () => {
    const text = noteText.trim();

    if (!text) {
      setErrorMessage('Escreva a nota antes de salvar.');
      return;
    }

    updateRoutine((current) => {
      const now = new Date().toISOString();
      const nextNote = noteDraftId ? current.notes.find((note) => note.id === noteDraftId) : null;
      const note: RoutineNote = {
        ...(nextNote ?? createDefaultNote(noteDueDate)),
        id: noteDraftId ?? createId('note'),
        text,
        kind: noteKind,
        dueDate: noteDueDate,
        pinned: notePinned,
        updatedAt: now,
        done: nextNote?.done ?? false,
        archived: nextNote?.archived ?? false,
        doneAt: nextNote?.doneAt ?? null,
        createdAt: nextNote?.createdAt ?? now,
      };

      const notes = noteDraftId
        ? current.notes.map((item) => (item.id === note.id ? note : item))
        : [note, ...current.notes];

      return { ...current, notes };
    });

    clearNoteDraft();
  };

  const handleSaveHabit = () => {
    const title = habitTitle.trim();

    if (!title) {
      setErrorMessage('Escreva o nome do habito antes de salvar.');
      return;
    }

    updateRoutine((current) => {
      const now = new Date().toISOString();
      const nextHabit = habitDraftId ? current.habits.find((habit) => habit.id === habitDraftId) : null;
      const habit: RoutineHabit = {
        ...(nextHabit ?? createDefaultHabit()),
        id: habitDraftId ?? createId('habit'),
        title,
        note: habitNote.trim(),
        time: formatTime(habitTime),
        weekdays: Array.from(new Set(habitDays)).sort((a, b) => a - b),
        reminderEnabled: habitReminderEnabled,
        pinned: habitPinned,
        snoozedUntil: nextHabit?.snoozedUntil ?? null,
        completions: nextHabit?.completions ?? [],
        notificationIds: nextHabit?.notificationIds ?? [],
        notificationPlanKey: nextHabit?.notificationPlanKey ?? '',
        createdAt: nextHabit?.createdAt ?? now,
        updatedAt: now,
      };

      const habits = habitDraftId
        ? current.habits.map((item) => (item.id === habit.id ? habit : item))
        : [habit, ...current.habits];

      return { ...current, habits };
    });

    clearHabitDraft();
  };

  const toggleNoteDone = (noteId: string) => {
    updateRoutine((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              done: !note.done,
              doneAt: !note.done ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    }));
  };

  const toggleNotePin = (noteId: string) => {
    updateRoutine((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              pinned: !note.pinned,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    }));
  };

  const archiveNote = (noteId: string) => {
    updateRoutine((current) => ({
      ...current,
      notes: current.notes.map((note) => (note.id === noteId ? { ...note, archived: true, updatedAt: new Date().toISOString() } : note)),
    }));
  };

  const deleteNote = (noteId: string) => {
    updateRoutine((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== noteId) }));
  };

  const editNote = (note: RoutineNote) => {
    setActiveWorkspace('ideas');
    setNoteDraftId(note.id);
    setNoteText(note.text);
    setNoteKind(note.kind);
    setNotePinned(note.pinned);
    setNoteDueDate(note.dueDate);
    setTimeout(() => {
      noteInputRef.current?.focus();
    }, 0);
  };

  const toggleHabitCompletion = (habitId: string, dateKey = selectedDateKey) => {
    updateRoutine((current) => ({
      ...current,
      habits: current.habits.map((habit) => {
        if (habit.id !== habitId) {
          return habit;
        }

        const completions = habit.completions.includes(dateKey)
          ? habit.completions.filter((item) => item !== dateKey)
          : [...habit.completions, dateKey];

        return {
          ...habit,
          completions,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  };

  const toggleHabitPin = (habitId: string) => {
    updateRoutine((current) => ({
      ...current,
      habits: current.habits.map((habit) =>
        habit.id === habitId
          ? {
              ...habit,
              pinned: !habit.pinned,
              updatedAt: new Date().toISOString(),
            }
          : habit,
      ),
    }));
  };

  const snoozeHabit = (habitId: string) => {
    const tomorrow = localDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
    updateRoutine((current) => ({
      ...current,
      habits: current.habits.map((habit) =>
        habit.id === habitId
          ? {
              ...habit,
              snoozedUntil: habit.snoozedUntil ? null : tomorrow,
              updatedAt: new Date().toISOString(),
            }
          : habit,
      ),
    }));
  };

  const deleteHabit = (habitId: string) => {
    updateRoutine((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== habitId) }));
  };

  const editHabit = (habit: RoutineHabit) => {
    setActiveWorkspace('habits');
    setHabitDraftId(habit.id);
    setHabitTitle(habit.title);
    setHabitNote(habit.note);
    setHabitTime(habit.time);
    setHabitDays(habit.weekdays);
    setHabitPinned(habit.pinned);
    setHabitReminderEnabled(habit.reminderEnabled);
    setTimeout(() => {
      habitInputRef.current?.focus();
    }, 0);
  };

  const toggleCompactMode = () => {
    setRoutine((current) => ({
      ...current,
      compactMode: !current.compactMode,
      updatedAt: new Date().toISOString(),
    }));
  };

  const markTodayDone = () => {
    updateRoutine((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.dueDate === selectedDateKey && !note.archived
          ? {
              ...note,
              done: true,
              doneAt: note.doneAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
      habits: current.habits.map((habit) => {
        if (!habit.weekdays.includes(selectedWeekday) || habit.snoozedUntil) {
          return habit;
        }

        if (habit.completions.includes(selectedDateKey)) {
          return habit;
        }

        return {
          ...habit,
          completions: [...habit.completions, selectedDateKey],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  };

  const archiveCompletedNotes = () => {
    updateRoutine((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.done && !note.archived
          ? {
              ...note,
              archived: true,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    }));
  };

  const clearSearch = () => {
    setSearchText('');
    setFilterMode('all');
  };

  const snoozeAllReminders = () => {
    const tomorrow = localDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
    updateRoutine((current) => ({
      ...current,
      habits: current.habits.map((habit) =>
        habit.reminderEnabled
          ? {
              ...habit,
              snoozedUntil: tomorrow,
              updatedAt: new Date().toISOString(),
            }
          : habit,
      ),
    }));
  };

  const quickAddNote = () => {
    setActiveWorkspace('ideas');
    setFilterMode('open');
    setNoteDraftId(null);
    setNoteText('');
    setNoteKind('idea');
    setNotePinned(false);
    setNoteDueDate(selectedDateKey);
    setTimeout(() => {
      noteInputRef.current?.focus();
    }, 0);
  };

  const quickAddHabit = () => {
    setActiveWorkspace('habits');
    setFilterMode('all');
    setHabitDraftId(null);
    setHabitTitle('');
    setHabitNote('');
    setHabitTime('08:00');
    setHabitDays([1, 2, 3, 4, 5]);
    setHabitPinned(false);
    setHabitReminderEnabled(true);
    setTimeout(() => {
      habitInputRef.current?.focus();
    }, 0);
  };

  const jumpToIdeasWorkspace = () => {
    setActiveWorkspace('ideas');
    setTimeout(() => {
      noteInputRef.current?.focus();
    }, 0);
  };

  const jumpToHabitsWorkspace = () => {
    setActiveWorkspace('habits');
    setTimeout(() => {
      habitInputRef.current?.focus();
    }, 0);
  };

  const noteSectionAnim = sectionAnims[0];
  const habitSectionAnim = sectionAnims[1];
  const sideRailAnim = sectionAnims[2];
  const calendarAnim = sectionAnims[3];
  const pinnedAnim = sectionAnims[4];
  const historyAnim = sectionAnims[5];
  const footerAnim = sectionAnims[6];

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: screenAnim,
          transform: [
            {
              translateY: screenAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(5, 8, 5, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="calendar-check-outline" size={23} color="#061007" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>ROTINA DIARIA</Text>
            <Text style={styles.heroTitle}>{student.full_name}</Text>
            <Text style={styles.heroSubtitle}>
              Organize o dia, marque o que foi feito, fixe o importante e receba lembretes no horario certo.
            </Text>
          </View>
          <View style={styles.heroPills}>
            <Pressable
              onPress={toggleCompactMode}
              style={({ pressed }) => [styles.compactButton, routine.compactMode && styles.compactButtonActive, pressed && styles.pressed]}
            >
              <Feather name={routine.compactMode ? 'eye-off' : 'eye'} size={14} color={routine.compactMode ? '#061007' : '#9CF02E'} />
              <Text style={[styles.compactButtonText, routine.compactMode && styles.compactButtonTextActive]}>
                {routine.compactMode ? 'Compacto' : 'Completo'}
              </Text>
            </Pressable>

            <Pressable onPress={quickAddNote} style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
              <Feather name="plus" size={14} color="#061007" />
              <Text style={styles.heroActionText}>Nova ideia</Text>
            </Pressable>

            <Pressable onPress={quickAddHabit} style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
              <Feather name="activity" size={14} color="#061007" />
              <Text style={styles.heroActionText}>Novo hábito</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricPill icon="clipboard-text-outline" label="Ideias" value={String(stats.openNotes)} />
          <MetricPill icon="check-circle-outline" label="Concluídas" value={String(stats.doneNotes)} />
          <MetricPill icon="bell-outline" label="Alertas" value={String(stats.reminders)} />
          <MetricPill icon="pin-outline" label="Fixadas" value={String(pinnedNotes.length + pinnedHabits.length)} />
          <MetricPill icon="trending-up" label="Melhor streak" value={`${stats.bestStreak}d`} />
        </View>
      </LinearGradient>

      {errorMessage ? (
        <View style={styles.bannerError}>
          <Feather name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={styles.bannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {infoMessage ? (
        <View style={styles.bannerInfo}>
          <Feather name="bell" size={14} color="#9CF02E" />
          <Text style={styles.bannerText}>{infoMessage}</Text>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.searchShell}>
          <Feather name="search" size={15} color="#9CF02E" />
          <TextInput
            ref={searchInputRef as never}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar notas, habitos, dias ou palavras-chave"
            placeholderTextColor="rgba(220, 244, 200, 0.34)"
            style={styles.searchInput}
          />
          {searchText ? (
            <Pressable onPress={clearSearch} style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}>
              <Feather name="x" size={14} color="#061007" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {FILTER_META.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              icon={filter.icon}
              active={filterMode === filter.value}
              onPress={() => setFilterMode(filter.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.workspaceGrid}>
        <WorkspaceCard
          workspace="ideas"
          active={activeWorkspace === 'ideas'}
          primaryValue={String(ideaCardCount)}
          primaryLabel="Ideias"
          secondaryValue={String(ideaPinnedCount)}
          secondaryLabel="Fixadas"
          onPress={jumpToIdeasWorkspace}
        />
        <WorkspaceCard
          workspace="habits"
          active={activeWorkspace === 'habits'}
          primaryValue={String(habitCardCount)}
          primaryLabel="Hábitos"
          secondaryValue={String(habitActiveCount)}
          secondaryLabel="Ativos"
          onPress={jumpToHabitsWorkspace}
        />
      </View>

      <View style={styles.workspaceSectionHeader}>
        <Text style={styles.workspaceSectionKicker}>Área ativa</Text>
        <Text style={styles.workspaceSectionTitle}>{activeWorkspaceMeta.title}</Text>
        <Text style={styles.workspaceSectionSubtitle}>{activeWorkspaceMeta.subtitle}</Text>
      </View>

      <View style={[styles.layout, isWide && styles.layoutWide]}>
        <View style={styles.mainColumn}>
          <SectionCard
            title="Hoje"
            subtitle={selectedDateLabel}
            compact={compactMode}
            anim={sectionAnims[0]}
            action={
              <TinyAction icon="check-circle-outline" label="Concluir tudo" onPress={markTodayDone} tone="primary" />
            }
          >
            <View style={styles.todayMetaRow}>
              <MetricPill icon="clipboard-text-outline" label="Ideias" value={String(todayNotes.length)} />
              <MetricPill icon="target" label="Hábitos" value={String(todayHabits.length)} />
              <MetricPill icon="calendar" label="Dia" value={selectedDateKey === today ? 'Hoje' : formatShortDate(selectedDateKey)} />
            </View>

            <View style={styles.todayGrid}>
              <View style={styles.todayList}>
                <Text style={styles.subSectionTitle}>Ideias do dia</Text>
                {todayNotes.length ? (
                  todayNotes.map((note) => (
                    <Pressable
                      key={note.id}
                      onPress={() => toggleNoteDone(note.id)}
                      style={({ pressed }) => [styles.todayRow, pressed && styles.pressed]}
                    >
                      <Feather name={note.done ? 'check-circle' : 'circle'} size={14} color={note.done ? '#9CF02E' : '#9CF02E'} />
                      <View style={styles.todayRowCopy}>
                        <Text style={[styles.todayRowTitle, note.done && styles.todayRowTitleDone]} numberOfLines={2}>
                          {note.text}
                        </Text>
                        <Text style={styles.todayRowMeta}>
                          {NOTE_KIND_META[note.kind].label} • {formatDateKey(note.dueDate)}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <EmptyState
                    icon="clipboard-text-outline"
                    title="Sem ideias para este dia"
                    text="Use a barra superior para criar uma nova tarefa ou selecione outro dia no calendario rapido."
                  />
                )}
              </View>

              <View style={styles.todayList}>
                <Text style={styles.subSectionTitle}>Hábitos do dia</Text>
                {todayHabits.length ? (
                  todayHabits.map((habit) => {
                    const completed = isHabitCompletedOnDate(habit, selectedDateKey);
                    return (
                      <Pressable
                        key={habit.id}
                        onPress={() => toggleHabitCompletion(habit.id)}
                        style={({ pressed }) => [styles.todayRow, pressed && styles.pressed]}
                      >
                        <Feather name={completed ? 'check-circle' : 'circle'} size={14} color={completed ? '#9CF02E' : '#9CF02E'} />
                        <View style={styles.todayRowCopy}>
                          <Text style={[styles.todayRowTitle, completed && styles.todayRowTitleDone]} numberOfLines={2}>
                            {habit.title}
                          </Text>
                          <Text style={styles.todayRowMeta}>
                            {formatTime(habit.time)} • {habit.weekdays.map((day) => weekdayShort(day)).join(' ')}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <EmptyState
                    icon="calendar-check-outline"
                    title="Nada agendado para este dia"
                    text="Selecione outro dia ou crie um novo habito com recorrencia semanal."
                  />
                )}
              </View>
            </View>
          </SectionCard>

          {activeWorkspace === 'ideas' ? (
            <SectionCard
            title="Ideias"
            subtitle={noteDraftId ? 'Editando ideia' : 'Bloco de ideias inteligente'}
            compact={compactMode}
            anim={noteSectionAnim}
            action={<TinyAction icon="plus" label={noteDraftId ? 'Cancelar' : 'Nova ideia'} onPress={noteDraftId ? clearNoteDraft : quickAddNote} tone="primary" />}
          >
            <View style={styles.composerCard}>
              <TextInput
                ref={noteInputRef as never}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Ex.: ideia de post, ajuste de treino, lembrete de chamada..."
                placeholderTextColor="rgba(220, 244, 200, 0.34)"
                multiline
                style={[styles.input, styles.textArea]}
              />

              <View style={styles.composerMetaRow}>
                <View style={styles.pickerGroup}>
                  {(['task', 'idea', 'reminder'] as NoteKind[]).map((kind) => {
                    const meta = NOTE_KIND_META[kind];
                    const active = noteKind === kind;

                    return (
                      <Pressable
                        key={kind}
                        onPress={() => setNoteKind(kind)}
                        style={({ pressed }) => [styles.kindPick, active && styles.kindPickActive, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name={meta.icon} size={13} color={active ? '#061007' : meta.color} />
                        <Text style={[styles.kindPickText, active && styles.kindPickTextActive]}>{meta.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.pickerGroup}>
                  <TinyAction icon="calendar" label="Hoje" onPress={() => syncSelectedDateFromNote(today)} />
                  <TinyAction icon="target" label="Selecionado" onPress={() => setNoteDueDate(selectedDateKey)} />
                  <TinyAction icon="calendar-plus" label="Amanhã" onPress={() => setNoteDueDate(localDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000)))} />
                </View>
              </View>

              <View style={styles.composerMetaRow}>
                <Text style={styles.helperText}>Data ativa: {noteComposerDateLabel}</Text>
                <TinyAction
                  icon={notePinned ? 'pin' : 'pin-outline'}
                  label={notePinned ? 'Fixada' : 'Fixar'}
                  onPress={() => setNotePinned((current) => !current)}
                  active={notePinned}
                />
              </View>

              <View style={styles.composerActions}>
                <PressScaleButton onPress={handleSaveNote} style={styles.primaryButtonShell} contentStyle={styles.primaryButton}>
                  <Feather name="check" size={14} color="#061007" />
                  <Text style={styles.primaryButtonText}>{noteDraftId ? 'Salvar ideia' : 'Adicionar ideia'}</Text>
                </PressScaleButton>
                <TinyAction icon="magnify" label="Focar busca" onPress={() => searchInputRef.current?.focus()} />
              </View>
            </View>

            <View style={styles.listStack}>
              {visibleNotes.length ? (
                visibleNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    selected={note.dueDate === selectedDateKey}
                    compact={compactMode}
                    onToggleDone={() => toggleNoteDone(note.id)}
                    onTogglePin={() => toggleNotePin(note.id)}
                    onArchive={() => archiveNote(note.id)}
                    onEdit={() => editNote(note)}
                    onDelete={() => deleteNote(note.id)}
                  />
                ))
              ) : (
                <EmptyState
                  icon="note-text-outline"
                  title="Sem ideias para mostrar"
                  text="Use a busca, mude o filtro ou crie uma nova ideia para este dia."
                />
              )}
            </View>
          </SectionCard>
          ) : (
            <SectionCard
            title="Hábitos"
            subtitle={habitDraftId ? 'Editando hábito' : 'Recorrência com horário e lembretes'}
            compact={compactMode}
            anim={habitSectionAnim}
            action={<TinyAction icon="repeat" label={habitDraftId ? 'Cancelar' : 'Novo hábito'} onPress={habitDraftId ? clearHabitDraft : quickAddHabit} tone="primary" />}
          >
            <View style={styles.composerCard}>
              <TextInput
                ref={habitInputRef as never}
                value={habitTitle}
                onChangeText={setHabitTitle}
                placeholder="Ex.: beber agua, ler 10 min, caminhar 20 min"
                placeholderTextColor="rgba(220, 244, 200, 0.34)"
                style={styles.input}
              />

                <TextInput
                  value={habitNote}
                  onChangeText={setHabitNote}
                  placeholder="Detalhe opcional: contexto, regra ou observação"
                  placeholderTextColor="rgba(220, 244, 200, 0.34)"
                  multiline
                  style={[styles.input, styles.textAreaSmall]}
                />

              <View style={styles.composerMetaRow}>
                <View style={styles.pickerGroup}>
                  <View style={styles.timeShell}>
                    <Feather name="clock" size={13} color="#9CF02E" />
                    <TextInput
                      value={habitTime}
                      onChangeText={setHabitTime}
                      placeholder="08:00"
                      placeholderTextColor="rgba(220, 244, 200, 0.34)"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      style={styles.timeInput}
                    />
                  </View>
                  <TinyAction
                    icon={habitReminderEnabled ? 'bell' : 'bell-off-outline'}
                    label={habitReminderEnabled ? 'Lembrete ligado' : 'Sem alerta'}
                    onPress={() => setHabitReminderEnabled((current) => !current)}
                    active={habitReminderEnabled}
                  />
                  <TinyAction
                    icon={habitPinned ? 'pin' : 'pin-outline'}
                    label={habitPinned ? 'Fixado' : 'Fixar'}
                    onPress={() => setHabitPinned((current) => !current)}
                    active={habitPinned}
                  />
                </View>
              </View>

              <View style={styles.daysGrid}>
                {WEEKDAYS.map((day) => {
                  const active = habitDays.includes(day.index);
                  return (
                    <Pressable
                      key={day.index}
                      onPress={() =>
                        setHabitDays((current) =>
                          active ? current.filter((item) => item !== day.index) : [...current, day.index].sort((a, b) => a - b),
                        )
                      }
                      style={({ pressed }) => [styles.dayPick, active && styles.dayPickActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.dayPickText, active && styles.dayPickTextActive]}>{day.short}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.composerActions}>
                <PressScaleButton onPress={handleSaveHabit} style={styles.primaryButtonShell} contentStyle={styles.primaryButton}>
                  <Feather name="check" size={14} color="#061007" />
                  <Text style={styles.primaryButtonText}>{habitDraftId ? 'Salvar alteração' : 'Adicionar hábito'}</Text>
                </PressScaleButton>
                <TinyAction icon="bell-off-outline" label="Silenciar 24h" onPress={snoozeAllReminders} />
              </View>
            </View>

            <View style={styles.listStack}>
              {visibleHabits.length ? (
                visibleHabits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    selectedDateKey={selectedDateKey}
                    selected={habit.weekdays.includes(selectedWeekday)}
                    compact={compactMode}
                    onToggleCompletion={() => toggleHabitCompletion(habit.id)}
                    onTogglePin={() => toggleHabitPin(habit.id)}
                    onEdit={() => editHabit(habit)}
                    onDelete={() => deleteHabit(habit.id)}
                    onSnooze={() => snoozeHabit(habit.id)}
                  />
                ))
              ) : (
                  <EmptyState
                    icon="calendar-check-outline"
                    title="Sem hábitos para mostrar"
                    text="Use a busca, mude o filtro ou crie um novo hábito recorrente."
                  />
              )}
            </View>
          </SectionCard>
          )}

          <Animated.View
            style={[
              styles.sectionCard,
              styles.footerCard,
              {
                opacity: footerAnim,
                transform: [
                  {
                    translateY: footerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionKicker}>AÇÕES RÁPIDAS</Text>
                <Text style={styles.sectionTitle}>Controle sem perder o ritmo</Text>
              </View>
              <TinyAction icon="refresh" label="Limpar filtro" onPress={clearSearch} />
            </View>

            <View style={styles.quickActionsGrid}>
              <TinyAction icon="plus" label="Nova ideia" onPress={quickAddNote} tone="primary" />
              <TinyAction icon="repeat" label="Novo hábito" onPress={quickAddHabit} tone="primary" />
              <TinyAction icon="check-circle-outline" label="Concluir hoje" onPress={markTodayDone} tone="primary" />
              <TinyAction icon="archive-outline" label="Arquivar concluídas" onPress={archiveCompletedNotes} />
              <TinyAction icon="bell-off-outline" label="Silenciar tudo" onPress={snoozeAllReminders} />
              <TinyAction icon="eye-off-outline" label="Modo compacto" onPress={toggleCompactMode} active={compactMode} />
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.sideRail,
            isWide && Platform.OS === 'web' ? ({ position: 'sticky', top: 16 } as object) : null,
            {
              opacity: sideRailAnim,
              transform: [
                {
                  translateY: sideRailAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SectionCard
            title="Calendario rapido"
            subtitle={selectedDateLabel}
            compact={compactMode}
            anim={calendarAnim}
            action={<TinyAction icon="calendar" label="Hoje" onPress={() => setSelectedDateKey(today)} />}
          >
            <View style={styles.weekGrid}>
              {weekSeries.map((day) => (
                <DayPill key={day.dateKey} day={day} onPress={() => setSelectedDateKey(day.dateKey)} />
              ))}
            </View>

            {nextReminder ? (
              <View style={styles.nextReminderBox}>
                <View style={styles.nextReminderIcon}>
                  <Feather name="clock" size={14} color="#061007" />
                </View>
                <View style={styles.nextReminderCopy}>
                  <Text style={styles.nextReminderTitle}>Próximo lembrete</Text>
                  <Text style={styles.nextReminderText}>
                    {nextReminder.next.toLocaleDateString('pt-BR')} as {nextReminder.next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Fixados"
            subtitle="Itens importantes no topo"
            compact={compactMode}
            anim={pinnedAnim}
            action={<TinyAction icon="pin" label="Top" onPress={() => setFilterMode('pinned')} />}
          >
            <View style={styles.historyList}>
              {pinnedNotes.length || pinnedHabits.length ? (
                <>
                  {pinnedNotes.slice(0, 3).map((note) => (
                    <HistoryRow key={note.id} icon={NOTE_KIND_META[note.kind].icon} title={note.text || 'Nota fixada'} meta={`Nota • ${formatDateKey(note.dueDate)}`} />
                  ))}
                  {pinnedHabits.slice(0, 3).map((habit) => (
                    <HistoryRow
                      key={habit.id}
                      icon="calendar-check-outline"
                      title={habit.title || 'Habito fixado'}
                      meta={`Habito • ${formatTime(habit.time)} • ${habit.weekdays.map((day) => weekdayShort(day)).join(' ')}`}
                    />
                  ))}
                </>
              ) : (
                <EmptyState
                  icon="pin-outline"
                  title="Nada fixado ainda"
                  text="Marque as notas ou habitos mais importantes para eles ficarem no topo desta coluna."
                />
              )}
            </View>
          </SectionCard>

          <SectionCard
            title="Histórico rápido"
            subtitle="Últimas conclusões"
            compact={compactMode}
            anim={historyAnim}
            action={<TinyAction icon="refresh" label="Atualizar" onPress={() => setSelectedDateKey(selectedDateKey)} />}
          >
            <View style={styles.historyList}>
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <HistoryRow key={item.id} icon={item.icon} title={item.title} meta={item.meta} />
                ))
              ) : (
                <EmptyState
                  icon="clock-outline"
                  title="Sem historico ainda"
                  text="Quando voce concluir notas ou habitos, os ultimos eventos aparecem aqui."
                />
              )}
            </View>
          </SectionCard>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 14,
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F4FFE8',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    maxWidth: 680,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 260,
  },
  compactButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 22, 15, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  compactButtonActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  compactButtonText: {
    color: '#DFF7C9',
    fontSize: 11,
    fontWeight: '900',
  },
  compactButtonTextActive: {
    color: '#061007',
  },
  heroAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#9CF02E',
  },
  heroActionText: {
    color: '#061007',
    fontSize: 11,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    minWidth: 128,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  metricCopy: {
    gap: 2,
  },
  metricValue: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  metricLabel: {
    color: 'rgba(220, 244, 200, 0.54)',
    fontSize: 10,
    fontWeight: '800',
  },
  bannerError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.2)',
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  bannerText: {
    flex: 1,
    color: '#DFF7C9',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  toolbar: {
    gap: 10,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 22, 15, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  searchInput: {
    flex: 1,
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 10,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChipShell: {
    borderRadius: 16,
  },
  filterChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 22, 15, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  filterChipActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  filterChipText: {
    color: '#DFF7C9',
    fontSize: 11,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: '#061007',
  },
  workspaceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  workspaceSectionHeader: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(11, 18, 10, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    gap: 4,
  },
  workspaceSectionKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  workspaceSectionTitle: {
    color: '#F4FFE8',
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  workspaceSectionSubtitle: {
    color: 'rgba(220, 244, 200, 0.7)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  workspaceCardShell: {
    flex: 1,
    minWidth: 220,
  },
  workspaceCard: {
    minHeight: 154,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  workspaceCardActive: {
    borderColor: 'rgba(156, 240, 46, 0.4)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  workspaceCardFill: {
    flex: 1,
    gap: 14,
    padding: 14,
  },
  workspaceCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  workspaceCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  workspaceCardIconActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  workspaceCardCopy: {
    flex: 1,
    gap: 4,
  },
  workspaceCardKicker: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  workspaceCardKickerActive: {
    color: '#9CF02E',
  },
  workspaceCardTitle: {
    color: '#F4FFE8',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  workspaceCardSubtitle: {
    color: 'rgba(220, 244, 200, 0.7)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  workspaceCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  workspaceCardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workspaceStat: {
    flex: 1,
    minWidth: 72,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 12, 8, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    gap: 2,
  },
  workspaceStatValue: {
    color: '#F4FFE8',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  workspaceStatValueActive: {
    color: '#061007',
  },
  workspaceStatLabel: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    fontWeight: '800',
  },
  workspaceStatLabelActive: {
    color: 'rgba(6, 16, 7, 0.72)',
  },
  layout: {
    gap: 12,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  sideRail: {
    gap: 12,
    minWidth: 300,
  },
  sectionCard: {
    gap: 14,
    padding: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  sectionCardCompact: {
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#F4FFE8',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionTitleCompact: {
    fontSize: 15,
  },
  todayMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  todayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  todayList: {
    flex: 1,
    minWidth: 260,
    gap: 10,
  },
  subSectionTitle: {
    color: '#DFF7C9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  todayRowCopy: {
    flex: 1,
    gap: 4,
  },
  todayRowTitle: {
    color: '#F4FFE8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  todayRowTitleDone: {
    color: 'rgba(220, 244, 200, 0.52)',
    textDecorationLine: 'line-through',
  },
  todayRowMeta: {
    color: 'rgba(220, 244, 200, 0.54)',
    fontSize: 10,
    fontWeight: '700',
  },
  composerCard: {
    gap: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  input: {
    minHeight: 48,
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 22, 15, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  composerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  kindPick: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  kindPickActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  kindPickText: {
    color: '#DFF7C9',
    fontSize: 11,
    fontWeight: '900',
  },
  kindPickTextActive: {
    color: '#061007',
  },
  helperText: {
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 11,
    fontWeight: '700',
  },
  timeShell: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  timeInput: {
    minWidth: 54,
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPick: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  dayPickActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  dayPickText: {
    color: '#DFF7C9',
    fontSize: 11,
    fontWeight: '900',
  },
  dayPickTextActive: {
    color: '#061007',
  },
  composerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonShell: {
    borderRadius: 16,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  listStack: {
    gap: 10,
  },
  itemCard: {
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  itemCardCompact: {
    padding: 10,
    gap: 10,
  },
  itemCardSelected: {
    borderColor: 'rgba(156, 240, 46, 0.34)',
    backgroundColor: 'rgba(156, 240, 46, 0.05)',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemState: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 22, 15, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  itemStateDone: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    minWidth: 160,
    color: '#F4FFE8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  itemTitleDone: {
    color: 'rgba(220, 244, 200, 0.52)',
    textDecorationLine: 'line-through',
  },
  itemMeta: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 22, 15, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  iconActionActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  kindBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  timeBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  timeBadgeMuted: {
    backgroundColor: 'rgba(253, 230, 138, 0.08)',
    borderColor: 'rgba(253, 230, 138, 0.18)',
  },
  timeBadgeText: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
  },
  timeBadgeTextMuted: {
    color: '#FDE68A',
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    minWidth: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  dayChipCompact: {
    minWidth: 30,
    height: 30,
    borderRadius: 12,
  },
  dayChipActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    borderColor: 'rgba(156, 240, 46, 0.24)',
  },
  dayChipText: {
    color: '#DFF7C9',
    fontSize: 10,
    fontWeight: '900',
  },
  dayChipTextActive: {
    color: '#9CF02E',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressLabel: {
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  progressValue: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  itemFooter: {
    gap: 8,
  },
  itemFooterText: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tinyActionShell: {
    borderRadius: 14,
  },
  tinyAction: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  tinyActionPrimary: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  tinyActionDanger: {
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    borderColor: 'rgba(252, 165, 165, 0.18)',
  },
  tinyActionActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  tinyActionText: {
    color: '#DFF7C9',
    fontSize: 10,
    fontWeight: '900',
  },
  tinyActionTextPrimary: {
    color: '#061007',
  },
  tinyActionTextActive: {
    color: '#061007',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  emptyTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(220, 244, 200, 0.64)',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '600',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayPillShell: {
    borderRadius: 16,
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 92,
  },
  dayPill: {
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  dayPillSelected: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  dayPillToday: {
    borderColor: 'rgba(156, 240, 46, 0.28)',
  },
  dayPillLabel: {
    color: '#DFF7C9',
    fontSize: 10,
    fontWeight: '900',
  },
  dayPillLabelSelected: {
    color: '#061007',
  },
  dayPillDate: {
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  dayPillCounts: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 9,
    fontWeight: '800',
  },
  nextReminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  nextReminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  nextReminderCopy: {
    flex: 1,
    gap: 3,
  },
  nextReminderTitle: {
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  nextReminderText: {
    color: 'rgba(220, 244, 200, 0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  historyIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  historyCopy: {
    flex: 1,
    gap: 3,
  },
  historyTitle: {
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '900',
  },
  historyMeta: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerCard: {
    marginBottom: 6,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
