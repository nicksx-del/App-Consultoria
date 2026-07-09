import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthBackground } from '../components/AuthBackground';
import { CheckInPanel } from '../components/CheckInPanel';
import { NutritionBuilder } from '../components/NutritionBuilder';
import { StudentProfileEditor } from '../components/StudentProfileEditor';
import { StudentAnamnesisPanel } from '../components/StudentAnamnesisPanel';
import { StudentChat } from '../components/StudentChat';
import { StudentNutritionTracker } from '../components/StudentNutritionTracker';
import { StudentRoutinePanel } from '../components/StudentRoutinePanel';
import { StudentWorkoutRunner } from '../components/StudentWorkoutRunner';
import { TrainingBuilder } from '../components/TrainingBuilder';
import {
  activityLevelLabels,
  calculateStudentMetrics,
  goalLabels,
  sexLabels,
} from '../lib/studentCalculations';
import {
  createStudent as createStudentRecord,
  fetchOwnStudent,
  fetchTrainerStudents,
  updateStudent as updateStudentRecord,
} from '../lib/students';
import { updateStudentProfile as updateStudentProfileRecord } from '../lib/studentProfile';
import { isSupabaseConfigured as isSupabaseConfiguredBase } from '../lib/supabase';
import {
  buildDefaultTrainingPlan,
  fetchStudentTrainingPlan,
  saveStudentTrainingPlan,
  weekdayLabels,
  weekdayOrder,
} from '../lib/training';
import {
  buildDefaultNutritionPlan,
  buildInitialFoodLibrary,
  createEmptyLibraryItem,
  fetchStudentNutritionPlan,
  fetchNutritionFoodLibrary,
  loadLocalNutritionFoodLibrary,
  saveLocalNutritionFoodLibrary,
  saveNutritionFoodLibrary,
  saveStudentNutritionPlan,
  nutritionWeekdayLabels,
} from '../lib/nutrition';
import {
  fetchStudentChatMessages,
  sendStudentChatMessage,
  toggleStudentChatMessageStar,
} from '../lib/chat';
import {
  fetchStudentCheckIns,
  reviewStudentCheckIn,
  submitStudentCheckIn,
} from '../lib/checkins';
import {
  fetchStudentCardioLogs,
  fetchLocalStudentMealLogs,
  fetchStudentMealLogs,
  fetchStudentWorkoutSessions,
  finishStudentWorkoutSession,
  saveLocalStudentMealLog,
  saveStudentCardioLog,
  saveStudentMealLog,
  saveStudentWorkoutSession as saveStudentWorkoutSessionRecord,
  startStudentWorkoutSession,
  todayIsoDate,
} from '../lib/studentExecution';
import {
  createLocalStudentAnamnesis,
  createPrefilledAnamnesisAnswers,
  fetchStudentAnamnesis,
  getAnamnesisProgress,
  saveStudentAnamnesis,
} from '../lib/anamnesis';
import type { Consultancy } from '../types/consultancy';
import type { Profile } from '../types/auth';
import type {
  ActivityLevel,
  Student,
  StudentFormPayload,
  StudentGoal,
  StudentProfilePayload,
  StudentProfileTab,
  StudentSex,
  TrainingExperience,
} from '../types/student';
import type { StudentTrainingPlan } from '../types/training';
import type {
  NutritionLibraryItem,
  NutritionMeal,
  NutritionPhase,
  StudentNutritionPlan,
} from '../types/nutrition';
import type { ChatMessage, SendChatMessagePayload } from '../types/chat';
import type { ReviewCheckInPayload, StudentCheckIn, SubmitCheckInPayload } from '../types/checkin';
import type { SaveAnamnesisPayload, StudentAnamnesis } from '../types/anamnesis';
import type { SaveCardioLogPayload, SaveMealLogPayload, StudentCardioLog, StudentMealLog, StudentWorkoutSession } from '../types/studentExecution';
import type { WorkoutDay } from '../types/training';

type DashboardScreenProps = {
  profile: Profile;
  consultancy?: Consultancy | null;
  loading?: boolean;
  onLogout: () => void;
};

class NutritionViewErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { errorMessage: string | null }
> {
  state = {
    errorMessage: null,
  };

  static getDerivedStateFromError(error: unknown) {
    return {
      errorMessage: error instanceof Error ? error.message : 'Erro inesperado ao abrir a dieta.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Nutrition view crashed', error, info);
  }

  componentDidUpdate(prevProps: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.errorMessage) {
      this.setState({ errorMessage: null });
    }
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(248, 113, 113, 0.28)',
            backgroundColor: 'rgba(25, 8, 8, 0.92)',
            padding: 20,
            gap: 10,
          }}
        >
          <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>Erro ao abrir a dieta</Text>
          <Text style={{ color: '#F3F4F6', fontSize: 22, fontWeight: '800' }}>
            A tela de dieta encontrou um erro de renderização.
          </Text>
          <Text style={{ color: 'rgba(243, 244, 246, 0.84)', fontSize: 14, lineHeight: 21 }}>
            {this.state.errorMessage}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type WorkspaceSection = 'overview' | 'students' | 'notifications' | 'payments' | 'ia';
type StudentFormMode = 'create' | 'edit';
const ANAMNESIS_DISMISS_STORAGE_KEY = 'consultoria:anamnesis-dismissed:';
const STUDENT_WORKSPACE_STATE_STORAGE_KEY = 'consultoria:student-workspace-state';

type BottomTab = {
  id: WorkspaceSection | 'more';
  icon: IconName;
  label: string;
  section?: WorkspaceSection;
};

type StudentBottomTab = {
  id: StudentProfileTab | 'more';
  icon: IconName;
  label: string;
  tab?: StudentProfileTab;
};

type QuickAction = {
  id: WorkspaceSection;
  icon: IconName;
  title: string;
  description: string;
};

type DesktopRailItem = {
  id: string;
  icon: IconName;
  title: string;
  description: string;
};

type StudentProfileTabMeta = {
  id: StudentProfileTab;
  icon: IconName;
  title: string;
  label: string;
  description: string;
};

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type PaymentStatus = 'active' | 'paused' | 'review';
type PaymentMethod = 'pix' | 'card' | 'manual';

type PaymentConfig = {
  status: PaymentStatus;
  amount: string;
  dueDay: string;
  method: PaymentMethod;
};

type NotificationEntry = {
  student: Student;
  count: number;
};

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 16,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return { scale, animateTo };
}

const bottomTabs: BottomTab[] = [
  { id: 'overview', section: 'overview', icon: 'home-variant-outline', label: 'Início' },
  { id: 'students', section: 'students', icon: 'account-group-outline', label: 'Alunos' },
  { id: 'notifications', section: 'notifications', icon: 'bell-outline', label: 'Notificações' },
  { id: 'payments', section: 'payments', icon: 'credit-card-outline', label: 'Pagamento' },
  { id: 'more', icon: 'dots-horizontal', label: 'Mais' },
];

const allWorkspaceTabs: QuickAction[] = [
  {
    id: 'overview',
    icon: 'view-dashboard-outline',
    title: 'Início',
    description: 'Resumo, métricas e operação do dia.',
  },
  {
    id: 'students',
    icon: 'account-group-outline',
    title: 'Alunos',
    description: 'Cadastro, perfil e status dos alunos.',
  },
  {
    id: 'notifications',
    icon: 'bell-outline',
    title: 'Notificações',
    description: 'Pendências, alertas e retorno dos alunos.',
  },
  {
    id: 'payments',
    icon: 'credit-card-outline',
    title: 'Pagamento',
    description: 'Mensalidade, vencimento e forma de cobrança.',
  },
  {
    id: 'ia',
    icon: 'robot-outline',
    title: 'Coach IA',
    description: 'Apoio inteligente para análise, treino e nutrição.',
  },
];

const defaultPaymentConfig: PaymentConfig = {
  status: 'active',
  amount: '349,90',
  dueDay: '5',
  method: 'pix',
};

const paymentStatusOptions: Array<SelectOption<PaymentStatus>> = [
  { value: 'active', label: 'Ativa' },
  { value: 'paused', label: 'Pausada' },
  { value: 'review', label: 'Em revisão' },
];

const paymentMethodOptions: Array<SelectOption<PaymentMethod>> = [
  { value: 'pix', label: 'PIX' },
  { value: 'card', label: 'Cartão' },
  { value: 'manual', label: 'Manual' },
];

const studentProfileTabs: StudentProfileTabMeta[] = [
  {
    id: 'profile',
    label: 'Perfil',
    title: 'Perfil público',
    icon: 'account-edit-outline',
    description: 'Foto, bio, links e identidade pública do aluno.',
  },
  {
    id: 'summary',
    label: 'Resumo',
    title: 'Resumo do aluno',
    icon: 'view-dashboard-outline',
    description: 'Visão geral, métricas iniciais e dados de acesso.',
  },
  {
    id: 'training',
    label: 'Treino',
    title: 'Treino',
    icon: 'dumbbell',
    description: 'Fichas, cardio, execução e histórico de cargas.',
  },
  {
    id: 'nutrition',
    label: 'Dieta',
    title: 'Dieta',
    icon: 'food-apple-outline',
    description: 'Macros, refeições, estratégia e ajustes semanais.',
  },
  {
    id: 'checkins',
    label: 'Check-in',
    title: 'Check-ins',
    icon: 'clipboard-check-outline',
    description: 'Fotos, peso, medidas, feedback e evolução semanal.',
  },
  {
    id: 'routine',
    label: 'Rotina',
    title: 'Rotina e notas',
    icon: 'calendar-check-outline',
    description: 'Notas do dia, habitos, horarios e lembretes recorrentes.',
  },
  {
    id: 'methodology',
    label: 'Método',
    title: 'Metodologia',
    icon: 'strategy',
    description: 'Regras do coach, periodização e lógica do processo.',
  },
  {
    id: 'anamnesis',
    label: 'Anamnese',
    title: 'Anamnese',
    icon: 'clipboard-text-outline',
    description: 'Rotina, saúde, histórico de treino e objetivos.',
  },
  {
    id: 'evolution',
    label: 'Evolução',
    title: 'Evolução',
    icon: 'chart-line',
    description: 'Comparativos, fotos e indicadores do progresso.',
  },
  {
    id: 'chat',
    label: 'Chat',
    title: 'Chat',
    icon: 'message-text-outline',
    description: 'Conversa direta e notificações do aluno.',
  },
  {
    id: 'ia',
    label: 'Coach IA',
    title: 'Coach IA',
    icon: 'robot-outline',
    description: 'Apoio inteligente para análise, treino e dieta.',
  },
];

const primaryStudentTabs: StudentBottomTab[] = [
  { id: 'summary', tab: 'summary', icon: 'view-dashboard-outline', label: 'Resumo' },
  { id: 'training', tab: 'training', icon: 'dumbbell', label: 'Treino' },
  { id: 'nutrition', tab: 'nutrition', icon: 'food-apple-outline', label: 'Dieta' },
  { id: 'routine', tab: 'routine', icon: 'calendar-check-outline', label: 'Rotina' },
  { id: 'more', icon: 'dots-horizontal', label: 'Mais' },
];

const studentMoreTabsBase = studentProfileTabs.filter(
  (tab) => !primaryStudentTabs.some((bottomTab) => bottomTab.tab === tab.id),
);

const studentMoreTabsForTrainer = studentMoreTabsBase;

const studentMoreTabsForStudent = studentMoreTabsBase.filter(
  (tab) => tab.id !== 'methodology' && tab.id !== 'ia',
);

const sexOptions: Array<SelectOption<StudentSex>> = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'other', label: 'Outro' },
];

const goalOptions: Array<SelectOption<StudentGoal>> = [
  { value: 'hypertrophy', label: goalLabels.hypertrophy },
  { value: 'fat_loss', label: goalLabels.fat_loss },
  { value: 'recomposition', label: goalLabels.recomposition },
  { value: 'health', label: goalLabels.health },
  { value: 'performance', label: goalLabels.performance },
];

const activityOptions: Array<SelectOption<ActivityLevel>> = [
  { value: 'sedentary', label: activityLevelLabels.sedentary },
  { value: 'light', label: activityLevelLabels.light },
  { value: 'moderate', label: activityLevelLabels.moderate },
  { value: 'active', label: activityLevelLabels.active },
  { value: 'very_active', label: activityLevelLabels.very_active },
];

const experienceOptions: Array<SelectOption<TrainingExperience>> = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
];

function emptyStudentPayload(): StudentFormPayload {
  return {
    fullName: '',
    email: '',
    password: '',
    whatsapp: '',
    age: '',
    sex: 'male',
    heightCm: '',
    weightKg: '',
    goal: 'hypertrophy',
    activityLevel: 'moderate',
    experience: 'beginner',
    restrictions: '',
  };
}

function studentToPayload(student: Student): StudentFormPayload {
  return {
    fullName: student.full_name,
    email: student.email,
    password: '',
    whatsapp: student.whatsapp ?? '',
    age: student.age ? String(student.age) : '',
    sex: student.sex ?? 'male',
    heightCm: student.height_cm ? String(student.height_cm).replace('.', ',') : '',
    weightKg: student.weight_kg ? String(student.weight_kg).replace('.', ',') : '',
    goal: student.goal,
    activityLevel: student.activity_level,
    experience: student.experience,
    restrictions: student.restrictions ?? '',
  };
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return initials || 'AL';
}

function normalizeWhatsappUrl(whatsapp: string | null) {
  if (!whatsapp) {
    return null;
  }

  const digits = whatsapp.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function formatKcal(value: number | null) {
  return value ? `${value.toLocaleString('pt-BR')} kcal` : 'Completar dados';
}

function formatMetric(value: number | null, suffix = '') {
  if (value === null) {
    return 'Completar';
  }

  return `${value.toLocaleString('pt-BR')}${suffix}`;
}

function formatList(items: string[]) {
  const filtered = items.filter(Boolean);
  return filtered.length ? filtered.join(' / ') : 'Ainda em ajuste';
}

function buildTrainingPreview(plan: StudentTrainingPlan) {
  if (!plan) {
    return {
      title: 'Treino ainda não definido',
      subtitle: 'Abra a aba Treino para montar a primeira ficha.',
      stats: ['Sem treino salvo', 'Aguardando rotina'],
      notes: ['Cardio e progressão pendentes'],
    };
  }

  const workoutDays = plan.workoutDays.length;
  const exerciseCount = plan.workoutDays.reduce((total, day) => total + day.exercises.length, 0);
  const activeWeekdays = weekdayOrder.filter((weekday) => Boolean(plan.weeklySchedule[weekday]?.workoutDayId));
  const firstWorkoutDay = plan.workoutDays[0];

  return {
    title: firstWorkoutDay?.name ?? 'Treino organizado',
    subtitle: firstWorkoutDay?.subtitle ?? 'Seu plano já está pronto para começar.',
    stats: [
      `${workoutDays} dias de treino`,
      `${exerciseCount} exercícios`,
      `${plan.cardioConfig.weeklyMinutes} min cardio/sem`,
    ],
    notes: [
      activeWeekdays.length ? `Agenda: ${formatList(activeWeekdays.map((weekday) => weekdayLabels[weekday]))}` : 'Agenda semanal ainda não definida',
      plan.cardioConfig.notes?.trim() || 'Sem observações de cardio por enquanto',
    ],
  };
}

function buildNutritionPreview(plan: StudentNutritionPlan | null) {
  if (!plan) {
    return {
      title: 'Dieta ainda não definida',
      subtitle: 'Abra a aba Dieta para estruturar refeições e macros.',
      stats: ['Sem dieta salva', 'Aguardando ajuste'],
      notes: ['Cardápio e macros pendentes'],
    };
  }

  const firstPhase = plan.phases[0];
  const mealCount = plan.meals.length;
  const mealDays = Array.from(new Set(plan.meals.map((meal) => meal.weekday)));

  return {
    title: firstPhase?.name ?? plan.config.protocolName ?? 'Plano alimentar',
    subtitle: firstPhase?.subtitle ?? plan.config.coachNotes?.trim() ?? 'Seu plano alimentar está pronto para seguir.',
    stats: [
      firstPhase ? `${firstPhase.calories} kcal` : 'Calorias em ajuste',
      firstPhase ? `${firstPhase.protein}g P / ${firstPhase.carbs}g C / ${firstPhase.fat}g G` : `${mealCount} refeições`,
      mealDays.length ? `${mealDays.length} dias com refeições` : 'Sem dias definidos',
    ],
    notes: [
      mealDays.length ? `Dias: ${formatList(mealDays.map((weekday) => nutritionWeekdayLabels[weekday]))}` : 'Dias de refeição ainda não organizados',
      firstPhase ? `Cardio: ${firstPhase.cardioMinutes} min` : 'Cardio da dieta ainda não foi definido',
    ],
  };
}

function getTrainingPreview(plan: StudentTrainingPlan | null, fallbackPlan: StudentTrainingPlan) {
  if (plan) {
    return buildTrainingPreview(plan);
  }

  const preview = buildTrainingPreview(fallbackPlan);
  return {
    ...preview,
    subtitle: 'Preview padrao. O treinador ainda nao salvou um treino oficial para esta conta.',
    notes: ['Assim que o treino oficial for salvo, ele aparece aqui.', ...preview.notes],
  };
}

function getNutritionPreview(plan: StudentNutritionPlan | null, fallbackPlan: StudentNutritionPlan) {
  if (plan) {
    return buildNutritionPreview(plan);
  }

  const preview = buildNutritionPreview(fallbackPlan);
  return {
    ...preview,
    subtitle: 'Preview padrao. O treinador ainda nao salvou uma dieta oficial para esta conta.',
    notes: ['Assim que a dieta oficial for salva, ela aparece aqui.', ...preview.notes],
  };
}

function getStudentTabMeta(tab: StudentProfileTab) {
  return studentProfileTabs.find((item) => item.id === tab) ?? studentProfileTabs[0];
}

type StudentWorkspaceState = {
  activeSection?: WorkspaceSection;
  studentId?: string | null;
  studentProfileTab?: StudentProfileTab;
};

async function loadStudentWorkspaceState() {
  try {
    const raw = await AsyncStorage.getItem(STUDENT_WORKSPACE_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StudentWorkspaceState | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      activeSection: parsed.activeSection,
      studentId: typeof parsed.studentId === 'string' ? parsed.studentId : null,
      studentProfileTab:
        parsed.studentProfileTab && studentProfileTabs.some((tab) => tab.id === parsed.studentProfileTab)
          ? parsed.studentProfileTab
          : undefined,
    } satisfies StudentWorkspaceState;
  } catch {
    return null;
  }
}

async function saveStudentWorkspaceState(state: StudentWorkspaceState) {
  try {
    await AsyncStorage.setItem(STUDENT_WORKSPACE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort persistence only.
  }
}

function translateStudentError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Não foi possível concluir a operação agora.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('function') && lowerMessage.includes('not found')) {
    return 'A função create-student ainda não foi publicada no Supabase.';
  }

  if (lowerMessage.includes('students') && lowerMessage.includes('does not exist')) {
    return 'A tabela de alunos ainda não existe. Aplique o SQL supabase/students-schema.sql.';
  }

  if (lowerMessage.includes('student-profile-media') && lowerMessage.includes('bucket')) {
    return 'O bucket do perfil do aluno ainda não existe. Aplique o SQL supabase/students-schema.sql.';
  }

  if (lowerMessage.includes('already') || lowerMessage.includes('duplicate')) {
    return 'Já existe um aluno com este e-mail.';
  }

  if (lowerMessage.includes('username') && lowerMessage.includes('duplicate')) {
    return 'Esse @ de usuário já está em uso. Escolha outro nome.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a ação por segurança. Confira as policies de alunos.';
  }

  if (lowerMessage.includes('edge function returned a non-2xx')) {
    return 'A criação do aluno falhou na Edge Function. Confira os dados e os logs do Supabase.';
  }

  if (
    lowerMessage.includes('failed to send request to the edge function') ||
    lowerMessage.includes('failed to send a request to the edge function') ||
    lowerMessage.includes('failed to reach the edge function')
  ) {
    return 'Nao foi possivel falar com a Edge Function. Verifique se ela foi publicada e se os segredos do Supabase estao configurados.';
  }

  if (lowerMessage.includes('nao foi possivel alcançar a edge function')) {
    return 'Nao foi possivel alcançar a Edge Function. Verifique a publicação no Supabase.';
  }

  if (message === 'OWN_STUDENT_NOT_FOUND') {
    return 'Nao encontramos um cadastro de aluno vinculado a esta conta. Peca ao treinador para revisar o acesso.';
  }

  if (message === 'OWN_STUDENT_AMBIGUOUS') {
    return 'Existe mais de um cadastro de aluno com este e-mail. O treinador precisa corrigir o vinculo no Supabase.';
  }

  if (message === 'OWN_STUDENT_LINKED_TO_ANOTHER_ACCOUNT') {
    return 'Este cadastro de aluno ja esta vinculado a outra conta. O treinador precisa corrigir o vinculo no Supabase.';
  }

  if (message === 'OWN_STUDENT_EMAIL_NOT_FOUND') {
    return 'Nao foi possivel confirmar o e-mail desta conta para localizar seu cadastro de aluno.';
  }

  if (message === 'OWN_STUDENT_LINK_UPDATE_FAILED') {
    return 'Nao foi possivel religar automaticamente este cadastro de aluno. Revise o vinculo no Supabase.';
  }

  return message;
}

function translateTrainingError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('student_training_plans') && lowerMessage.includes('does not exist')) {
    return 'A tabela de treinos ainda nao existe. Aplique o SQL supabase/training-schema.sql.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a acao por seguranca. Confira as policies de treinos.';
  }

  if (lowerMessage.includes('permission denied')) {
    return 'Permissao insuficiente para salvar este treino. Verifique o vinculo do aluno com a consultoria.';
  }

  return message;
}

function isCardioTableMissing(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('student_cardio_logs') && message.toLowerCase().includes('does not exist');
}

function translateCardioError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (isCardioTableMissing(error)) {
    return 'A tabela de cardio ainda nao foi aplicada no Supabase. Usando modo local no preview.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou o registro de cardio por seguranca. Confira as policies de cardio.';
  }

  if (lowerMessage.includes('permission denied')) {
    return 'Permissao insuficiente para salvar este cardio. Verifique o vinculo do aluno com a consultoria.';
  }

  return message;
}

function buildLocalCardioLog(student: Student, payload: SaveCardioLogPayload): StudentCardioLog {
  const now = new Date().toISOString();

  return {
    id: `local-cardio-${Date.now()}`,
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    trainingPlanId: payload.planId,
    logDate: payload.logDate,
    source: payload.source,
    modality: payload.modality.trim() || 'Cardio',
    intensity: payload.intensity,
    durationSeconds: Math.max(1, Math.round(payload.durationSeconds)),
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    distanceKm: payload.distanceKm,
    calories: payload.calories,
    notes: payload.notes.trim(),
    createdAt: payload.completedAt ?? now,
    updatedAt: now,
  };
}

const NUTRITION_PLAN_STORAGE_PREFIX = '@consultoria:nutrition-plan';

type LocalNutritionPlanTiming = {
  createdAt?: string;
  updatedAt?: string;
};

function nutritionPlanStorageKey(student: Student) {
  return `${NUTRITION_PLAN_STORAGE_PREFIX}:${student.consultancy_id}:${student.id}`;
}

function buildLocalNutritionPlan(
  student: Student,
  plan?: Partial<StudentNutritionPlan> | null,
  timing: LocalNutritionPlanTiming = {},
): StudentNutritionPlan {
  const basePlan = buildDefaultNutritionPlan(student);
  const source: Partial<StudentNutritionPlan> = plan && typeof plan === 'object' ? plan : {};
  const now = new Date().toISOString();
  const createdAt = timing.createdAt ?? (typeof source.createdAt === 'string' ? source.createdAt : now);
  const updatedAt = timing.updatedAt ?? (typeof source.updatedAt === 'string' ? source.updatedAt : now);
  const config =
    source.config && typeof source.config === 'object'
      ? { ...basePlan.config, ...(source.config as StudentNutritionPlan['config']) }
      : basePlan.config;
  const phases = Array.isArray(source.phases) ? (source.phases as NutritionPhase[]) : basePlan.phases;
  const meals = Array.isArray(source.meals) ? (source.meals as NutritionMeal[]) : basePlan.meals;

  return {
    ...basePlan,
    ...(source as StudentNutritionPlan),
    id:
      typeof source.id === 'string' && source.id.trim().length
        ? source.id
        : `local-nutrition-${student.consultancy_id}-${student.id}`,
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    config,
    phases,
    meals,
    createdAt,
    updatedAt,
  };
}

async function loadLocalNutritionPlan(student: Student) {
  try {
    const raw = await AsyncStorage.getItem(nutritionPlanStorageKey(student));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return buildLocalNutritionPlan(student, parsed as Partial<StudentNutritionPlan>);
  } catch {
    return null;
  }
}

async function saveLocalNutritionPlan(student: Student, plan: StudentNutritionPlan) {
  const normalized = buildLocalNutritionPlan(student, plan, {
    createdAt: plan.createdAt,
    updatedAt: new Date().toISOString(),
  });

  await AsyncStorage.setItem(nutritionPlanStorageKey(student), JSON.stringify(normalized));
  return normalized;
}

function isNutritionFallbackError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('student_nutrition_plans') ||
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('permission denied') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('network request failed')
  );
}

function isNutritionLibraryFallbackError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('nutrition_food_library') ||
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('permission denied') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('network request failed')
  );
}

function isAnamnesisTableMissing(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('student_anamneses') && message.toLowerCase().includes('does not exist');
}

function translateAnamnesisError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (isAnamnesisTableMissing(error)) {
    return 'A tabela de anamnese ainda nao foi aplicada no Supabase. Usando modo local no preview.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a anamnese por seguranca. Confira as policies de anamnese.';
  }

  if (lowerMessage.includes('permission denied')) {
    return 'Permissao insuficiente para salvar a anamnese. Verifique o vinculo do aluno com a consultoria.';
  }

  return message;
}

function translateNutritionError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('student_nutrition_plans') && lowerMessage.includes('does not exist')) {
    return 'A tabela de dietas ainda nao existe. Aplique o SQL supabase/nutrition-schema.sql.';
  }

  if (lowerMessage.includes('nutrition_food_library') && lowerMessage.includes('does not exist')) {
    return 'A tabela da biblioteca de alimentos ainda nao existe. O app segue usando a base pronta local no preview.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a acao por seguranca. Confira as policies de dietas.';
  }

  if (lowerMessage.includes('permission denied')) {
    return 'Permissao insuficiente para salvar esta dieta. Verifique o vinculo do aluno com a consultoria.';
  }

  return message;
}

function translateChatError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('student_chat_messages') && lowerMessage.includes('does not exist')) {
    return 'A tabela de chat ainda nao existe. Aplique o SQL supabase/chat-schema.sql.';
  }

  if (lowerMessage.includes('bucket') && lowerMessage.includes('not found')) {
    return 'O bucket chat-media ainda nao existe. Aplique o SQL supabase/chat-schema.sql.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a acao por seguranca. Confira as policies do chat.';
  }

  if (lowerMessage.includes('mime type')) {
    return 'Este tipo de arquivo ainda nao esta liberado para envio no chat.';
  }

  return message;
}

function translateCheckInError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Nao foi possivel concluir a operacao agora.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('student_checkins') && lowerMessage.includes('does not exist')) {
    return 'A tabela de check-ins ainda nao existe. Aplique o SQL supabase/checkins-schema.sql.';
  }

  if (lowerMessage.includes('bucket') && lowerMessage.includes('not found')) {
    return 'O bucket checkin-media ainda nao existe. Aplique o SQL supabase/checkins-schema.sql.';
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('policy')) {
    return 'O Supabase bloqueou a acao por seguranca. Confira as policies de check-ins.';
  }

  if (lowerMessage.includes('mime type')) {
    return 'Este tipo de imagem ainda nao esta liberado para check-in.';
  }

  return message;
}

function DashboardMetric({
  icon,
  label,
  value,
  helper,
}: {
  icon: IconName;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <View style={styles.metricIcon}>
          <MaterialCommunityIcons name={icon} size={19} color="#9CF02E" />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function ContactButton({
  icon,
  label,
  url,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  url: string | null;
}) {
  const { scale, animateTo } = usePressScale();

  if (!url) {
    return null;
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => void Linking.openURL(url)}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.02)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}
      >
        <Feather name={icon} size={15} color="#9CF02E" />
        <Text style={styles.contactText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function BottomTabButton({
  tab,
  active,
  onPress,
}: {
  tab: BottomTab;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, animateTo } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.02)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.bottomTab, active && styles.bottomTabActive, pressed && styles.pressed]}
      >
        <View style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>
          <MaterialCommunityIcons name={tab.icon} size={20} color={active ? '#061007' : '#CDEAC0'} />
        </View>
        <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{tab.label}</Text>
        <View style={[styles.bottomTabIndicator, active ? styles.bottomTabIndicatorActive : styles.bottomTabIndicatorInactive]} />
      </Pressable>
    </Animated.View>
  );
}

function StudentBottomTabButton({
  tab,
  active,
  onPress,
}: {
  tab: StudentBottomTab;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, animateTo } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.02)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.bottomTab, active && styles.bottomTabActive, pressed && styles.pressed]}
      >
        <View style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>
          <MaterialCommunityIcons name={tab.icon} size={20} color={active ? '#061007' : '#CDEAC0'} />
        </View>
        <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{tab.label}</Text>
        <View style={[styles.bottomTabIndicator, active ? styles.bottomTabIndicatorActive : styles.bottomTabIndicatorInactive]} />
      </Pressable>
    </Animated.View>
  );
}

function DesktopRailButton({
  item,
  active,
  onPress,
}: {
  item: DesktopRailItem;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, animateTo } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.015 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.015)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.desktopRailButton, active && styles.desktopRailButtonActive, pressed && styles.pressed]}
      >
        <View style={[styles.desktopRailButtonIcon, active && styles.desktopRailButtonIconActive]}>
          <MaterialCommunityIcons name={item.icon} size={18} color={active ? '#061007' : '#9CF02E'} />
        </View>
        <View style={styles.desktopRailButtonCopy}>
          <Text style={[styles.desktopRailButtonTitle, active && styles.desktopRailButtonTitleActive]}>{item.title}</Text>
          <Text style={styles.desktopRailButtonText}>{item.description}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MoreTabsSheet({
  activeSection,
  onClose,
  onSelect,
}: {
  activeSection: WorkspaceSection;
  onClose: () => void;
  onSelect: (section: WorkspaceSection) => void;
}) {
  return (
    <View style={styles.moreLayer} pointerEvents="box-none">
      <Pressable style={styles.moreScrim} onPress={onClose} />

      <View style={styles.moreSheetWrap} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(18, 28, 14, 0.98)', 'rgba(4, 6, 4, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.moreSheet}
        >
          <View style={styles.moreHandle} />

          <View style={styles.moreHeader}>
            <View style={styles.moreHeaderCopy}>
              <Text style={styles.moreKicker}>Navegação</Text>
              <Text style={styles.moreTitle}>Todas as abas</Text>
            </View>

            <Pressable onPress={onClose} style={({ pressed }) => [styles.moreClose, pressed && styles.pressed]}>
              <Feather name="x" size={17} color="#DCF4C8" />
            </Pressable>
          </View>

          <View style={styles.moreTabsGrid}>
            {allWorkspaceTabs.map((item) => {
              const active = activeSection === item.id;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => [
                    styles.moreTab,
                    active && styles.moreTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.moreTabIcon, active && styles.moreTabIconActive]}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={19}
                      color={active ? '#061007' : '#9CF02E'}
                    />
                  </View>
                  <View style={styles.moreTabCopy}>
                    <Text style={styles.moreTabTitle}>{item.title}</Text>
                    <Text style={styles.moreTabText}>{item.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function NotificationsPanel({
  entries,
  loading,
  onClearAll,
  onOpenStudent,
}: {
  entries: NotificationEntry[];
  loading: boolean;
  onClearAll: () => void;
  onOpenStudent: (student: Student) => void;
}) {
  const totalNotifications = entries.reduce((total, entry) => total + entry.count, 0);
  const studentCount = entries.length;

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionKicker}>Notificações</Text>
          <Text style={styles.sectionTitle}>Pendências dos alunos</Text>
          <Text style={styles.sectionHint}>
            {studentCount > 0
              ? `${studentCount} alunos com ${totalNotifications} notificações pendentes`
              : 'Nenhuma pendência para tratar agora'}
          </Text>
        </View>

        <Pressable
          onPress={entries.length ? onClearAll : undefined}
          disabled={!entries.length || loading}
          style={({ pressed }) => [
            styles.smallGhostButton,
            (!entries.length || loading) && styles.disabledButton,
            pressed && !loading && entries.length ? styles.pressed : null,
          ]}
        >
          <Feather name="trash-2" size={14} color="#9CF02E" />
          <Text style={styles.smallGhostButtonText}>Limpar tudo</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="small" color="#9CF02E" />
          <Text style={styles.loadingText}>Carregando notificações...</Text>
        </View>
      ) : entries.length ? (
        <View style={styles.notificationList}>
          {entries.map((entry) => (
            <Pressable
              key={entry.student.id}
              onPress={() => onOpenStudent(entry.student)}
              style={({ pressed }) => [styles.notificationItem, pressed && styles.pressed]}
            >
              <View style={styles.notificationItemIcon}>
                <MaterialCommunityIcons name="bell-alert-outline" size={18} color="#061007" />
              </View>

              <View style={styles.notificationItemCopy}>
                <Text style={styles.notificationItemTitle}>{entry.student.full_name}</Text>
                <Text style={styles.notificationItemText}>
                  {entry.count} {entry.count === 1 ? 'notificação pendente' : 'notificações pendentes'}
                </Text>
              </View>

              <View style={styles.notificationItemBadge}>
                <Text style={styles.notificationItemBadgeText}>{entry.count}</Text>
              </View>

              <Feather name="chevron-right" size={16} color="#9CF02E" />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="bell-off-outline" size={28} color="#061007" />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma notificação no momento</Text>
          <Text style={styles.emptyText}>
            Quando houver pendências, elas aparecem aqui para acompanhamento rápido.
          </Text>
        </View>
      )}
    </View>
  );
}

function PaymentSummaryCard({
  config,
  onOpenPayments,
}: {
  config: PaymentConfig;
  onOpenPayments: () => void;
}) {
  const statusLabel = paymentStatusOptions.find((option) => option.value === config.status)?.label ?? config.status;
  const methodLabel = paymentMethodOptions.find((option) => option.value === config.method)?.label ?? config.method;

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionKicker}>Pagamento</Text>
          <Text style={styles.sectionTitle}>Cobrança da consultoria</Text>
          <Text style={styles.sectionHint}>Resumo rápido da configuração atual</Text>
        </View>
      </View>

      <View style={styles.paymentSummaryHero}>
        <View style={styles.paymentSummaryIcon}>
          <MaterialCommunityIcons name="credit-card-outline" size={20} color="#061007" />
        </View>
        <View style={styles.paymentSummaryCopy}>
          <Text style={styles.paymentSummaryStatus}>{statusLabel}</Text>
          <Text style={styles.paymentSummaryValue}>R$ {config.amount}</Text>
          <Text style={styles.paymentSummaryText}>
            Vencimento dia {config.dueDay} · {methodLabel}
          </Text>
        </View>
      </View>

      <View style={styles.paymentSummaryGrid}>
        <View style={styles.paymentSummaryItem}>
          <Text style={styles.paymentSummaryItemLabel}>Mensalidade</Text>
          <Text style={styles.paymentSummaryItemValue}>R$ {config.amount}</Text>
        </View>
        <View style={styles.paymentSummaryItem}>
          <Text style={styles.paymentSummaryItemLabel}>Vencimento</Text>
          <Text style={styles.paymentSummaryItemValue}>Dia {config.dueDay}</Text>
        </View>
        <View style={styles.paymentSummaryItem}>
          <Text style={styles.paymentSummaryItemLabel}>Forma</Text>
          <Text style={styles.paymentSummaryItemValue}>{methodLabel}</Text>
        </View>
      </View>

      <Pressable onPress={onOpenPayments} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Feather name="settings" size={16} color="#061007" />
        <Text style={styles.primaryButtonText}>Abrir pagamento</Text>
      </Pressable>
    </View>
  );
}

function NotificationsPage({
  entries,
  loading,
  onClearAll,
  onOpenStudent,
}: {
  entries: NotificationEntry[];
  loading: boolean;
  onClearAll: () => void;
  onOpenStudent: (student: Student) => void;
}) {
  return (
    <View style={styles.pageStack}>
      <View style={styles.pageHero}>
        <View style={styles.pageHeroIcon}>
          <MaterialCommunityIcons name="bell-outline" size={30} color="#061007" />
        </View>

        <View style={styles.pageHeroCopy}>
          <Text style={styles.pageKicker}>Centro de notificações</Text>
          <Text style={styles.pageTitle}>Acompanhe as pendências</Text>
          <Text style={styles.pageSubtitle}>
            Veja as notificações dos alunos, abra o perfil correspondente e limpe a fila quando
            tudo estiver resolvido.
          </Text>
        </View>

        <Pressable
          onPress={entries.length && !loading ? onClearAll : undefined}
          disabled={!entries.length || loading}
          style={({ pressed }) => [
            styles.smallGhostButton,
            (!entries.length || loading) && styles.disabledButton,
            pressed && entries.length && !loading ? styles.pressed : null,
          ]}
        >
          <Feather name="trash-2" size={15} color="#9CF02E" />
          <Text style={styles.smallGhostButtonText}>Limpar tudo</Text>
        </Pressable>
      </View>

      <NotificationsPanel
        entries={entries}
        loading={loading}
        onClearAll={onClearAll}
        onOpenStudent={onOpenStudent}
      />
    </View>
  );
}

function PaymentsPage({
  config,
  onChange,
  onReset,
}: {
  config: PaymentConfig;
  onChange: (next: PaymentConfig) => void;
  onReset: () => void;
}) {
  const statusLabel = paymentStatusOptions.find((option) => option.value === config.status)?.label ?? config.status;
  const methodLabel = paymentMethodOptions.find((option) => option.value === config.method)?.label ?? config.method;

  return (
    <View style={styles.pageStack}>
      <View style={styles.pageHero}>
        <View style={styles.pageHeroIcon}>
          <MaterialCommunityIcons name="credit-card-outline" size={30} color="#061007" />
        </View>

        <View style={styles.pageHeroCopy}>
          <Text style={styles.pageKicker}>Pagamento</Text>
          <Text style={styles.pageTitle}>Configuração da cobrança</Text>
          <Text style={styles.pageSubtitle}>
            Ajuste mensalidade, vencimento, status e forma de cobrança sem conectar backend nesta
            etapa.
          </Text>
        </View>

        <Pressable onPress={onReset} style={({ pressed }) => [styles.smallGhostButton, pressed && styles.pressed]}>
          <Feather name="rotate-ccw" size={15} color="#9CF02E" />
          <Text style={styles.smallGhostButtonText}>Resetar rascunho</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Configuração</Text>
            <Text style={styles.sectionTitle}>Cobrança local</Text>
            <Text style={styles.sectionHint}>Use este rascunho para evoluir a integração depois</Text>
          </View>
        </View>

        <View style={styles.twoColumns}>
          <Field
            label="Valor da mensalidade"
            value={config.amount}
            placeholder="349,90"
            onChangeText={(amount) => onChange({ ...config, amount })}
            keyboardType="numeric"
          />
          <Field
            label="Dia de vencimento"
            value={config.dueDay}
            placeholder="5"
            onChangeText={(dueDay) => onChange({ ...config, dueDay })}
            keyboardType="numeric"
          />
        </View>

        <SegmentedSelect
          label="Status da cobrança"
          value={config.status}
          options={paymentStatusOptions}
          onChange={(status) => onChange({ ...config, status })}
        />

        <SegmentedSelect
          label="Forma de cobrança"
          value={config.method}
          options={paymentMethodOptions}
          onChange={(method) => onChange({ ...config, method })}
        />

        <View style={styles.paymentPreviewCard}>
          <Text style={styles.paymentPreviewLabel}>Prévia atual</Text>
          <Text style={styles.paymentPreviewValue}>
            {statusLabel} · R$ {config.amount}
          </Text>
          <Text style={styles.paymentPreviewText}>
            Vence todo dia {config.dueDay} · {methodLabel}
          </Text>
          <Text style={styles.paymentPreviewHint}>
            Rascunho local, pronto para receber integração real depois.
          </Text>
        </View>
      </View>
    </View>
  );
}

function CoachIAPage({
  studentCount,
  notificationCount,
  onNavigate,
}: {
  studentCount: number;
  notificationCount: number;
  onNavigate: (section: WorkspaceSection) => void;
}) {
  const aiCards = [
    {
      icon: 'brain',
      title: 'Análise da anamnese',
      text: 'Leve rotina, dores, sono e objetivo para uma leitura rápida antes de montar o plano.',
      tag: 'Análise',
    },
    {
      icon: 'swap-horizontal-circle-outline',
      title: 'Troca de exercício',
      text: 'Encontre alternativas por equipamento, limitação ou preferência sem quebrar a lógica do treino.',
      tag: 'Treino',
    },
    {
      icon: 'food-variant',
      title: 'Apoio na dieta',
      text: 'Sugestões de refeições, macros e ajustes para manter a aderência no dia a dia.',
      tag: 'Dieta',
    },
    {
      icon: 'message-text-outline',
      title: 'Resumo do aluno',
      text: 'Converta check-ins, mensagens e pendências em próximos passos mais claros.',
      tag: 'Resumo',
    },
  ] as const;

  const navigationActions: QuickAction[] = [
    {
      id: 'students',
      icon: 'account-group-outline',
      title: 'Abrir alunos',
      description: 'Escolha um aluno e use a IA com contexto real.',
    },
    {
      id: 'notifications',
      icon: 'bell-outline',
      title: 'Ver alertas',
      description: 'Pendências e retornos que pedem resposta agora.',
    },
    {
      id: 'payments',
      icon: 'credit-card-outline',
      title: 'Pagamentos',
      description: 'Acompanhe mensalidades e status de cobrança.',
    },
    {
      id: 'overview',
      icon: 'home-variant-outline',
      title: 'Voltar ao início',
      description: 'Retome o resumo e as métricas principais.',
    },
  ];

  return (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(8, 12, 8, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pageHero}
      >
        <View style={styles.pageHeroIcon}>
          <MaterialCommunityIcons name="robot-outline" size={29} color="#061007" />
        </View>

        <View style={styles.pageHeroCopy}>
          <Text style={styles.pageKicker}>Coach IA</Text>
          <Text style={styles.pageTitle}>Assistente de decisão rápida</Text>
          <Text style={styles.pageSubtitle}>
            Use a base do aluno para acelerar análises, ajustes e respostas sem perder o padrão da consultoria.
          </Text>
        </View>

        <Pressable
          onPress={() => onNavigate('students')}
          style={({ pressed }) => [styles.primarySmallButton, pressed && styles.pressed]}
        >
          <Feather name="users" size={15} color="#061007" />
          <Text style={styles.primarySmallButtonText}>Escolher aluno</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.metricsGrid}>
        <DashboardMetric
          icon="account-group-outline"
          label="Alunos na base"
          value={String(studentCount)}
          helper="Contexto disponível para análise"
        />
        <DashboardMetric
          icon="bell-outline"
          label="Pendências"
          value={String(notificationCount)}
          helper="Alertas que pedem atenção"
        />
        <DashboardMetric
          icon="flash-outline"
          label="Atalhos"
          value={String(navigationActions.length)}
          helper="Fluxo rápido entre áreas"
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>O que a IA pode apoiar</Text>
            <Text style={styles.sectionTitle}>Atalhos prontos para uso</Text>
            <Text style={styles.sectionHint}>
              Aqui a IA entra como apoio do treinador, não como mais um menu escondido.
            </Text>
          </View>
        </View>

        <View style={styles.moduleGrid}>
          {aiCards.map((card) => (
            <View key={card.title} style={styles.moduleCard}>
              <View style={styles.moduleCardTop}>
                <View style={styles.moduleCardIcon}>
                  <MaterialCommunityIcons name={card.icon} size={18} color="#9CF02E" />
                </View>
                <View style={styles.moduleTag}>
                  <Text style={styles.moduleTagText}>{card.tag}</Text>
                </View>
              </View>
              <Text style={styles.moduleCardTitle}>{card.title}</Text>
              <Text style={styles.moduleCardText}>{card.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Navegação rápida</Text>
            <Text style={styles.sectionTitle}>Voltar em um toque</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          {navigationActions.map((action) => (
            <QuickActionButton
              key={action.id}
              action={action}
              active={false}
              onPress={() => onNavigate(action.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function StudentMoreTabsSheet({
  activeTab,
  tabs,
  onClose,
  onSelect,
}: {
  activeTab: StudentProfileTab;
  tabs: StudentProfileTabMeta[];
  onClose: () => void;
  onSelect: (tab: StudentProfileTab) => void;
}) {
  return (
    <View style={styles.moreLayer} pointerEvents="box-none">
      <Pressable style={styles.moreScrim} onPress={onClose} />

      <View style={styles.moreSheetWrap} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(18, 28, 14, 0.98)', 'rgba(4, 6, 4, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.moreSheet}
        >
          <View style={styles.moreHandle} />

          <View style={styles.moreHeader}>
            <View style={styles.moreHeaderCopy}>
              <Text style={styles.moreKicker}>Perfil do aluno</Text>
              <Text style={styles.moreTitle}>Mais áreas</Text>
              <Text style={styles.moreSubtitle}>
                Acesso rápido para rotina, evolução, anotações e conversa com o aluno.
              </Text>
            </View>

            <Pressable onPress={onClose} style={({ pressed }) => [styles.moreClose, pressed && styles.pressed]}>
              <Feather name="x" size={17} color="#DCF4C8" />
            </Pressable>
          </View>

          <View style={styles.moreTabsGrid}>
            {tabs.map((item) => {
              const active = activeTab === item.id;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelect(item.id)}
                  style={({ pressed }) => [
                    styles.moreTab,
                    active && styles.moreTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.moreTabIcon, active && styles.moreTabIconActive]}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={19}
                      color={active ? '#061007' : '#9CF02E'}
                    />
                  </View>
                  <View style={styles.moreTabCopy}>
                    <Text style={styles.moreTabTitle}>{item.title}</Text>
                    <Text style={styles.moreTabText}>{item.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function QuickActionButton({
  action,
  active,
  onPress,
}: {
  action: QuickAction;
  active: boolean;
  onPress: () => void;
}) {
  const { scale, animateTo } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.015 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.015)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.quickAction, active && styles.quickActionActive, pressed && styles.pressed]}
      >
        <View style={[styles.quickIcon, active && styles.quickIconActive]}>
          <MaterialCommunityIcons name={action.icon} size={20} color={active ? '#061007' : '#9CF02E'} />
        </View>
        <View style={styles.quickCopy}>
          <Text style={styles.quickTitle}>{action.title}</Text>
          <Text style={styles.quickDescription}>{action.description}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={active ? '#9CF02E' : 'rgba(232, 246, 221, 0.45)'} />
      </Pressable>
    </Animated.View>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorNotice}>
      <Feather name="alert-circle" size={16} color="#FFB4A8" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  editable = true,
  multiline = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  editable?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(230, 244, 218, 0.34)"
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

function SegmentedSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentGrid}>
        {options.map((option) => {
          const active = value === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segmentOption,
                active && styles.segmentOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StudentFormSheet({
  mode,
  student,
  loading,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  mode: StudentFormMode;
  student?: Student | null;
  loading: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (payload: StudentFormPayload) => void;
}) {
  const [payload, setPayload] = useState<StudentFormPayload>(
    student ? studentToPayload(student) : emptyStudentPayload(),
  );
  const isCreate = mode === 'create';
  const metrics = calculateStudentMetrics(payload);

  const updatePayload = (next: Partial<StudentFormPayload>) => {
    setPayload((current) => ({ ...current, ...next }));
  };

  return (
    <View style={styles.formLayer}>
      <Pressable style={styles.formScrim} onPress={loading ? undefined : onCancel} />

      <View style={styles.formSheetWrap}>
        <LinearGradient
          colors={['rgba(18, 28, 14, 0.98)', 'rgba(4, 6, 4, 0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.formSheet}
        >
          <View style={styles.moreHandle} />

          <View style={styles.formHeader}>
            <View style={styles.formHeaderCopy}>
              <Text style={styles.moreKicker}>{isCreate ? 'Novo cadastro' : 'Editar aluno'}</Text>
              <Text style={styles.formTitle}>
                {isCreate ? 'Criar aluno da consultoria' : 'Atualizar dados iniciais'}
              </Text>
              <Text style={styles.formSubtitle}>
                Dados usados para IMC, TMB, gasto diário e sugestão calórica inicial.
              </Text>
            </View>

            <Pressable onPress={loading ? undefined : onCancel} style={styles.moreClose}>
              <Feather name="x" size={17} color="#DCF4C8" />
            </Pressable>
          </View>

          {errorMessage ? <ErrorNotice message={errorMessage} /> : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
            <Field
              label="Nome completo"
              value={payload.fullName}
              placeholder="Ex: João Silva"
              onChangeText={(fullName) => updatePayload({ fullName })}
            />

            <View style={styles.twoColumns}>
              <Field
                label="E-mail de acesso"
                value={payload.email}
                placeholder="aluno@email.com"
                keyboardType="email-address"
                editable={isCreate}
                onChangeText={(email) => updatePayload({ email })}
              />
              {isCreate ? (
                <Field
                  label="Senha provisória"
                  value={payload.password ?? ''}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  onChangeText={(password) => updatePayload({ password })}
                />
              ) : (
                <Field
                  label="Acesso"
                  value="E-mail protegido pelo Supabase Auth"
                  placeholder=""
                  editable={false}
                  onChangeText={() => undefined}
                />
              )}
            </View>

            <View style={styles.twoColumns}>
              <Field
                label="WhatsApp"
                value={payload.whatsapp}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                onChangeText={(whatsapp) => updatePayload({ whatsapp })}
              />
              <Field
                label="Idade"
                value={payload.age}
                placeholder="Ex: 28"
                keyboardType="numeric"
                onChangeText={(age) => updatePayload({ age })}
              />
            </View>

            <View style={styles.twoColumns}>
              <Field
                label="Altura (cm)"
                value={payload.heightCm}
                placeholder="Ex: 178"
                keyboardType="numeric"
                onChangeText={(heightCm) => updatePayload({ heightCm })}
              />
              <Field
                label="Peso (kg)"
                value={payload.weightKg}
                placeholder="Ex: 82,5"
                keyboardType="numeric"
                onChangeText={(weightKg) => updatePayload({ weightKg })}
              />
            </View>

            <SegmentedSelect
              label="Sexo biológico para cálculo"
              value={payload.sex}
              options={sexOptions}
              onChange={(sex) => updatePayload({ sex })}
            />

            <SegmentedSelect
              label="Objetivo principal"
              value={payload.goal}
              options={goalOptions}
              onChange={(goal) => updatePayload({ goal })}
            />

            <SegmentedSelect
              label="Nível de atividade"
              value={payload.activityLevel}
              options={activityOptions}
              onChange={(activityLevel) => updatePayload({ activityLevel })}
            />

            <SegmentedSelect
              label="Experiência de treino"
              value={payload.experience}
              options={experienceOptions}
              onChange={(experience) => updatePayload({ experience })}
            />

            <Field
              label="Restrições, lesões ou observações"
              value={payload.restrictions}
              placeholder="Ex: dor no joelho, intolerâncias, preferência alimentar..."
              multiline
              onChangeText={(restrictions) => updatePayload({ restrictions })}
            />

            <View style={styles.formMetrics}>
              <MiniMetric label="IMC" value={formatMetric(metrics.bmi)} />
              <MiniMetric label="TMB" value={formatKcal(metrics.bmr)} />
              <MiniMetric label="Gasto diário" value={formatKcal(metrics.dailyCalories)} />
              <MiniMetric label="Sugestão" value={formatKcal(metrics.suggestedCalories)} />
            </View>
          </ScrollView>

          <View style={styles.formActions}>
            <Pressable
              onPress={loading ? undefined : onCancel}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={loading ? undefined : () => onSubmit(payload)}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                loading && styles.disabledButton,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#061007" />
              ) : (
                <Feather name={isCreate ? 'user-plus' : 'save'} size={16} color="#061007" />
              )}
              <Text style={styles.primaryButtonText}>{loading ? 'Salvando...' : isCreate ? 'Criar aluno' : 'Salvar'}</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricValue}>{value}</Text>
      <Text style={styles.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function StudentListCard({
  student,
  onPress,
}: {
  student: Student;
  onPress: () => void;
}) {
  const metrics = calculateStudentMetrics(student);
  const notifications = student.notifications_count ?? 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.studentCard, pressed && styles.pressed]}>
      <View style={styles.studentAvatar}>
        <Text style={styles.studentInitial}>{getInitials(student.full_name)}</Text>
      </View>

      <View style={styles.studentBody}>
        <View style={styles.studentHeading}>
          <Text style={styles.studentName}>{student.full_name}</Text>
          <View style={styles.studentStatusPill}>
            <Text style={styles.studentStatusText}>{student.status === 'active' ? 'Ativo' : 'Pausado'}</Text>
          </View>
        </View>

        <Text style={styles.studentGoal}>{goalLabels[student.goal]} • {student.email}</Text>

        <View style={styles.studentFooter}>
          <View style={styles.studentMeta}>
            <MaterialCommunityIcons name="scale-bathroom" size={14} color="#9CF02E" />
            <Text style={styles.studentMetaText}>IMC {formatMetric(metrics.bmi)}</Text>
          </View>
          <View style={styles.studentMeta}>
            <MaterialCommunityIcons name="fire" size={14} color="#9CF02E" />
            <Text style={styles.studentMetaText}>{formatKcal(metrics.suggestedCalories)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.studentRightRail}>
        {notifications > 0 ? (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{notifications}</Text>
          </View>
        ) : (
          <View style={styles.noNotificationBadge}>
            <Feather name="bell" size={14} color="#8EA783" />
          </View>
        )}
        <View style={styles.openStudent}>
          <Feather name="arrow-up-right" size={17} color="#061007" />
        </View>
      </View>
    </Pressable>
  );
}

function StudentsPage({
  students,
  loading,
  errorMessage,
  onRefresh,
  onCreate,
  onOpenStudent,
}: {
  students: Student[];
  loading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onCreate: () => void;
  onOpenStudent: (student: Student) => void;
}) {
  const activeStudents = students.filter((student) => student.status === 'active').length;
  const unreadNotifications = students.reduce((total, student) => total + (student.notifications_count ?? 0), 0);

  return (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(8, 12, 8, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pageHero}
      >
        <View style={styles.pageHeroIcon}>
          <MaterialCommunityIcons name="account-group-outline" size={29} color="#061007" />
        </View>
        <View style={styles.pageHeroCopy}>
          <Text style={styles.pageKicker}>Central de alunos</Text>
          <Text style={styles.pageTitle}>Operacao de alunos</Text>
          <Text style={styles.pageSubtitle}>
            Cadastre alunos, acompanhe notificacoes e abra o perfil para estruturar treino,
            dieta e evolucao.
          </Text>
        </View>

        <Pressable onPress={onCreate} style={({ pressed }) => [styles.primarySmallButton, pressed && styles.pressed]}>
          <Feather name="user-plus" size={15} color="#061007" />
          <Text style={styles.primarySmallButtonText}>Adicionar aluno</Text>
        </Pressable>
      </LinearGradient>

      {errorMessage ? <ErrorNotice message={errorMessage} /> : null}

      <View style={styles.metricsGrid}>
        <DashboardMetric
          icon="account-check-outline"
          label="Alunos ativos"
          value={String(activeStudents)}
          helper="Contas criadas pelo treinador"
        />
        <DashboardMetric
          icon="bell-outline"
          label="Notificações"
          value={String(unreadNotifications)}
          helper="Pendências vindas dos alunos"
        />
        <DashboardMetric
          icon="calculator-variant-outline"
          label="Com cálculo"
          value={String(students.filter((student) => calculateStudentMetrics(student).bmr !== null).length)}
          helper="IMC, TMB e calorias"
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Lista</Text>
            <Text style={styles.sectionTitle}>Alunos da consultoria</Text>
          </View>

          <Pressable onPress={onRefresh} style={({ pressed }) => [styles.smallGhostButton, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator size="small" color="#9CF02E" /> : <Feather name="refresh-cw" size={14} color="#9CF02E" />}
            <Text style={styles.smallGhostButtonText}>Atualizar</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="small" color="#9CF02E" />
            <Text style={styles.loadingText}>Preparando a base de alunos...</Text>
          </View>
        ) : students.length ? (
          <View style={styles.studentsList}>
            {students.map((student) => (
              <StudentListCard key={student.id} student={student} onPress={() => onOpenStudent(student)} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="account-plus-outline" size={28} color="#061007" />
            </View>
            <Text style={styles.emptyTitle}>Sua base de alunos ainda esta vazia</Text>
            <Text style={styles.emptyText}>
              Comece criando o primeiro acesso de aluno com e-mail, senha e dados para cálculo.
            </Text>
            <Pressable onPress={onCreate} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Feather name="user-plus" size={16} color="#061007" />
              <Text style={styles.primaryButtonText}>Criar primeiro aluno</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function StudentProfilePage({
  student,
  tab,
  isTrainerView,
  canEdit,
  studentSaving,
  trainingPlan,
  trainingLoading,
  trainingSaving,
  trainingError,
  workoutSessions,
  workoutSessionsLoading,
  workoutSessionSaving,
  workoutSessionError,
  cardioLogs,
  cardioLogsLoading,
  cardioLogSaving,
  cardioLogError,
  anamnesis,
  anamnesisLoading,
  anamnesisSaving,
  anamnesisError,
  nutritionPlan,
  nutritionLibrary,
  nutritionLoading,
  nutritionSaving,
  nutritionLibrarySaving,
  nutritionError,
  nutritionLibraryError,
  mealLogs,
  mealLogsLoading,
  mealLogSaving,
  mealLogError,
  mealLogDate,
  checkIns,
  checkInsLoading,
  checkInSaving,
  checkInError,
  chatMessages,
  chatLoading,
  chatSending,
  chatError,
  onBack,
  onEdit,
  onCloseEditor,
  onChangeTab,
  onSaveTrainingPlan,
  onStartWorkoutSession,
  onSaveWorkoutSession,
  onFinishWorkoutSession,
  onRefreshWorkoutSessions,
  onSaveCardioLog,
  onRefreshCardioLogs,
  onSaveAnamnesis,
  onSaveNutritionPlan,
  onSaveNutritionLibrary,
  onChangeMealLogDate,
  onSaveMealLog,
  onRefreshMealLogs,
  onSubmitCheckIn,
  onReviewCheckIn,
  onRefreshCheckIns,
  onSendChatMessage,
  onToggleChatMessageStar,
  onRefreshChat,
  onSaveStudentProfile,
  profile,
}: {
  student: Student;
  tab: StudentProfileTab;
  isTrainerView: boolean;
  canEdit: boolean;
  studentSaving: boolean;
  trainingPlan: StudentTrainingPlan | null;
  trainingLoading: boolean;
  trainingSaving: boolean;
  trainingError?: string | null;
  workoutSessions: StudentWorkoutSession[];
  workoutSessionsLoading: boolean;
  workoutSessionSaving: boolean;
  workoutSessionError?: string | null;
  cardioLogs: StudentCardioLog[];
  cardioLogsLoading: boolean;
  cardioLogSaving: boolean;
  cardioLogError?: string | null;
  anamnesis: StudentAnamnesis | null;
  anamnesisLoading: boolean;
  anamnesisSaving: boolean;
  anamnesisError?: string | null;
  nutritionPlan: StudentNutritionPlan | null;
  nutritionLibrary: NutritionLibraryItem[];
  nutritionLoading: boolean;
  nutritionSaving: boolean;
  nutritionLibrarySaving: boolean;
  nutritionError?: string | null;
  nutritionLibraryError?: string | null;
  mealLogs: StudentMealLog[];
  mealLogsLoading: boolean;
  mealLogSaving: boolean;
  mealLogError?: string | null;
  mealLogDate: string;
  checkIns: StudentCheckIn[];
  checkInsLoading: boolean;
  checkInSaving: boolean;
  checkInError?: string | null;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatSending: boolean;
  chatError?: string | null;
  onBack?: () => void;
  onEdit?: () => void;
  onCloseEditor?: () => void;
  onChangeTab: (tab: StudentProfileTab) => void;
  onSaveTrainingPlan: (plan: StudentTrainingPlan) => Promise<void> | void;
  onStartWorkoutSession: (workoutDay: WorkoutDay) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onSaveWorkoutSession: (session: StudentWorkoutSession) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onFinishWorkoutSession: (session: StudentWorkoutSession) => Promise<StudentWorkoutSession | void> | StudentWorkoutSession | void;
  onRefreshWorkoutSessions: () => Promise<void> | void;
  onSaveCardioLog: (payload: SaveCardioLogPayload) => Promise<StudentCardioLog | void> | StudentCardioLog | void;
  onRefreshCardioLogs: () => Promise<void> | void;
  onSaveAnamnesis: (payload: SaveAnamnesisPayload) => Promise<StudentAnamnesis | void> | StudentAnamnesis | void;
  onSaveNutritionPlan: (plan: StudentNutritionPlan) => Promise<void> | void;
  onSaveNutritionLibrary: (items: NutritionLibraryItem[]) => Promise<NutritionLibraryItem[] | void> | NutritionLibraryItem[] | void;
  onChangeMealLogDate: (date: string) => void;
  onSaveMealLog: (payload: SaveMealLogPayload) => Promise<StudentMealLog | void> | StudentMealLog | void;
  onRefreshMealLogs: () => Promise<void> | void;
  onSubmitCheckIn: (payload: SubmitCheckInPayload) => Promise<void> | void;
  onReviewCheckIn: (checkIn: StudentCheckIn, payload: ReviewCheckInPayload) => Promise<void> | void;
  onRefreshCheckIns: () => Promise<void> | void;
  onSendChatMessage: (payload: SendChatMessagePayload) => Promise<void> | void;
  onToggleChatMessageStar: (message: ChatMessage) => Promise<void> | void;
  onRefreshChat: () => Promise<void> | void;
  onSaveStudentProfile: (payload: StudentProfilePayload) => Promise<void> | void;
  profile: Profile;
}) {
  const metrics = calculateStudentMetrics(student);
  const notifications = student.notifications_count ?? 0;
  const normalizedTab = tab === 'data' ? 'summary' : tab;
  const activeTab = getStudentTabMeta(normalizedTab);
  const showStudentProfileHero = normalizedTab === 'summary';
  const showProfileContextCard = isTrainerView && normalizedTab !== 'summary';
  const trainingPreview = getTrainingPreview(trainingPlan, buildDefaultTrainingPlan(student));
  const nutritionPreview = getNutritionPreview(nutritionPlan, buildDefaultNutritionPlan(student));
  const nutritionBuilderErrorMessage = (() => {
    const message = nutritionError || nutritionLibraryError;
    if (!message) {
      return null;
    }

    const lowerMessage = message.toLowerCase();
    const hasFallbackData = Boolean(nutritionPlan || nutritionLibrary.length);
    const isFallbackOnlyIssue =
      lowerMessage === 'nao foi possivel concluir a operacao agora.' ||
      lowerMessage.includes('nutrition_food_library') ||
      lowerMessage.includes('student_nutrition_plans');

    if (hasFallbackData && isFallbackOnlyIssue) {
      return null;
    }

    return message;
  })();

  return (
    <View style={styles.pageStack}>
      {showStudentProfileHero ? (
        <LinearGradient
          colors={['rgba(156, 240, 46, 0.18)', 'rgba(8, 12, 8, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.studentProfileHero}
        >
          <View style={styles.profileTopRow}>
            {onBack ? (
              <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Feather name="arrow-left" size={16} color="#DCF4C8" />
                <Text style={styles.backText}>Alunos</Text>
              </Pressable>
            ) : (
              <View />
            )}

            {notifications > 0 ? (
              <View style={styles.notificationPill}>
                <Feather name="bell" size={13} color="#061007" />
                <Text style={styles.notificationPillText}>{notifications} notificações</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.profileIdentity}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>{getInitials(student.full_name)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.pageKicker}>{student.status === 'active' ? 'Aluno ativo' : 'Aluno pausado'}</Text>
              <Text style={styles.pageTitle}>{student.full_name}</Text>
              <Text style={styles.pageSubtitle}>
                {goalLabels[student.goal]} • {activityLevelLabels[student.activity_level]} • {student.email}
              </Text>
            </View>
          </View>

          <View style={styles.profileMetrics}>
            <MiniMetric label="IMC" value={formatMetric(metrics.bmi)} />
            <MiniMetric label="TMB" value={formatKcal(metrics.bmr)} />
            <MiniMetric label="Gasto diário" value={formatKcal(metrics.dailyCalories)} />
            <MiniMetric label="Sugestão" value={formatKcal(metrics.suggestedCalories)} />
          </View>
        </LinearGradient>
      ) : null}

      {showProfileContextCard ? (
        <View style={styles.profileContextCard}>
          <View style={styles.profileContextIcon}>
            <MaterialCommunityIcons name={activeTab.icon} size={21} color="#061007" />
          </View>
          <View style={styles.profileContextCopy}>
            <Text style={styles.sectionKicker}>Área atual</Text>
            <Text style={styles.profileContextTitle}>{activeTab.title}</Text>
            <Text style={styles.profileContextText}>{activeTab.description}</Text>
          </View>
        </View>
      ) : null}

      {normalizedTab === 'profile' && onBack ? (
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Feather name="arrow-left" size={16} color="#DCF4C8" />
          <Text style={styles.backText}>Alunos</Text>
        </Pressable>
      ) : null}

      <View style={styles.panel}>
        {normalizedTab === 'profile' ? (
          <StudentProfileEditor
            student={student}
            canEdit={canEdit}
            errorMessage={canEdit ? null : 'Somente o aluno ou o treinador podem editar este perfil.'}
            saving={studentSaving}
            onEditLater={onCloseEditor}
            onSave={onSaveStudentProfile}
          />
        ) : normalizedTab === 'summary' ? (
          <View style={styles.profileTabStack}>
            <View style={styles.profileTabPanel}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionKicker}>Resumo</Text>
                  <Text style={styles.sectionTitle}>Seu ponto de partida</Text>
                </View>
              </View>

              <View style={styles.planPreviewGrid}>
                <PlanPreviewCard
                  icon="dumbbell"
                  eyebrow={trainingPlan ? 'Treino para seguir' : 'Preview de treino'}
                  title={trainingPreview.title}
                  subtitle={trainingPreview.subtitle}
                  stats={trainingPreview.stats}
                  notes={trainingPreview.notes}
                  actionLabel="Abrir treino"
                  onAction={() => onChangeTab('training')}
                  loading={trainingLoading}
                />
                <PlanPreviewCard
                  icon="food-apple-outline"
                  eyebrow={nutritionPlan ? 'Dieta do aluno' : 'Preview de dieta'}
                  title={nutritionPreview.title}
                  subtitle={nutritionPreview.subtitle}
                  stats={nutritionPreview.stats}
                  notes={nutritionPreview.notes}
                  actionLabel="Abrir dieta"
                  onAction={() => onChangeTab('nutrition')}
                  loading={nutritionLoading}
                />
              </View>

              {trainingError ? <ErrorNotice message={trainingError} /> : null}
              {nutritionError ? <ErrorNotice message={nutritionError} /> : null}

              <View style={styles.infoGrid}>
                <InfoTile icon="calendar" label="Idade" value={student.age ? `${student.age} anos` : 'Não informado'} />
                <InfoTile icon="gender-male-female" label="Sexo" value={student.sex ? sexLabels[student.sex] : 'Não informado'} />
                <InfoTile icon="human-male-height" label="Altura" value={student.height_cm ? `${student.height_cm} cm` : 'Não informado'} />
                <InfoTile icon="scale-bathroom" label="Peso" value={student.weight_kg ? `${student.weight_kg} kg` : 'Não informado'} />
                <InfoTile icon="target" label="Objetivo" value={goalLabels[student.goal]} />
                <InfoTile icon="run" label="Atividade" value={activityLevelLabels[student.activity_level]} />
              </View>

              <View style={styles.notePanel}>
                <Text style={styles.noteTitle}>Restrições e observações</Text>
                <Text style={styles.noteText}>{student.restrictions || 'Nenhuma restrição informada ainda.'}</Text>
              </View>

              <View style={styles.summaryActionRow}>
                <Pressable onPress={() => onChangeTab('checkins')} style={({ pressed }) => [styles.summaryAction, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={16} color="#9CF02E" />
                  <Text style={styles.summaryActionText}>Check-ins</Text>
                </Pressable>
                <Pressable onPress={() => onChangeTab('anamnesis')} style={({ pressed }) => [styles.summaryAction, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={16} color="#9CF02E" />
                  <Text style={styles.summaryActionText}>Anamnese</Text>
                </Pressable>
                <Pressable onPress={() => onChangeTab('chat')} style={({ pressed }) => [styles.summaryAction, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="message-text-outline" size={16} color="#9CF02E" />
                  <Text style={styles.summaryActionText}>Chat</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.profileTabPanel}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionKicker}>Dados</Text>
                  <Text style={styles.sectionTitle}>Informações editáveis</Text>
                </View>
                {canEdit && onEdit ? (
                  <Pressable onPress={onEdit} style={({ pressed }) => [styles.primarySmallButton, pressed && styles.pressed]}>
                    <Feather name="edit-3" size={14} color="#061007" />
                    <Text style={styles.primarySmallButtonText}>Editar dados</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.infoGrid}>
                <InfoTile icon="email-outline" label="E-mail" value={student.email} />
                <InfoTile icon="phone-outline" label="WhatsApp" value={student.whatsapp || 'Não informado'} />
                <InfoTile icon="arm-flex-outline" label="Experiência" value={experienceOptions.find((item) => item.value === student.experience)?.label ?? 'Iniciante'} />
                <InfoTile icon="account-check-outline" label="Status" value={student.status === 'active' ? 'Ativo' : 'Pausado'} />
              </View>
            </View>
          </View>
        ) : normalizedTab === 'anamnesis' ? (
          <StudentAnamnesisPanel
            student={student}
            profile={profile}
            anamnesis={anamnesis}
            loading={anamnesisLoading}
            saving={anamnesisSaving}
            errorMessage={anamnesisError}
            canEdit={!isTrainerView || canEdit}
            onSave={onSaveAnamnesis}
          />
        ) : normalizedTab === 'training' ? (
          !isTrainerView ? (
            <StudentWorkoutRunner
              student={student}
              plan={trainingPlan}
              sessions={workoutSessions}
              loading={trainingLoading || workoutSessionsLoading}
              saving={trainingSaving || workoutSessionSaving}
              errorMessage={workoutSessionError || trainingError}
              cardioLogs={cardioLogs}
              cardioLogsLoading={cardioLogsLoading}
              cardioLogSaving={cardioLogSaving}
              cardioLogError={cardioLogError}
              onStartSession={onStartWorkoutSession}
              onSaveSession={onSaveWorkoutSession}
              onFinishSession={onFinishWorkoutSession}
              onSaveCardioLog={onSaveCardioLog}
              onRefreshCardioLogs={onRefreshCardioLogs}
              onRefresh={onRefreshWorkoutSessions}
            />
          ) : (
            <TrainingBuilder
              plan={trainingPlan}
              studentName={student.full_name}
              loading={trainingLoading}
              saving={trainingSaving}
              errorMessage={trainingError}
              canEdit={canEdit}
              onSave={onSaveTrainingPlan}
            />
          )
        ) : normalizedTab === 'nutrition' ? (
          !isTrainerView ? (
            <NutritionViewErrorBoundary resetKey={`${student.id}:${normalizedTab}:student`}>
              <StudentNutritionTracker
                student={student}
                plan={nutritionPlan}
                foodLibrary={nutritionLibrary}
                mealLogs={mealLogs}
                logDate={mealLogDate}
                loading={nutritionLoading || mealLogsLoading}
                saving={nutritionSaving || mealLogSaving}
                errorMessage={mealLogError || nutritionError}
                onChangeLogDate={onChangeMealLogDate}
                onSaveMealLog={onSaveMealLog}
                onRefresh={onRefreshMealLogs}
              />
            </NutritionViewErrorBoundary>
          ) : (
            <NutritionViewErrorBoundary resetKey={`${student.id}:${normalizedTab}:trainer`}>
              <NutritionBuilder
                plan={nutritionPlan}
                foodLibrary={nutritionLibrary}
                studentName={student.full_name}
                studentGoal={student.goal}
                loading={nutritionLoading}
                saving={nutritionSaving || nutritionLibrarySaving}
                errorMessage={nutritionBuilderErrorMessage}
                canEdit={canEdit}
                mealLogs={mealLogs}
                mealLogDate={mealLogDate}
                onSaveLibrary={onSaveNutritionLibrary}
                onSave={onSaveNutritionPlan}
              />
            </NutritionViewErrorBoundary>
          )
        ) : normalizedTab === 'checkins' ? (
          <CheckInPanel
            student={student}
            profile={profile}
            checkIns={checkIns}
            loading={checkInsLoading}
            saving={checkInSaving}
            errorMessage={checkInError}
            canSubmit={isTrainerView || student.auth_user_id === profile.id}
            canReview={isTrainerView}
            onSubmit={onSubmitCheckIn}
            onReview={onReviewCheckIn}
            onRefresh={onRefreshCheckIns}
          />
        ) : normalizedTab === 'routine' ? (
          <StudentRoutinePanel student={student} profile={profile} />
        ) : normalizedTab === 'chat' ? (
          <StudentChat
            student={student}
            profile={profile}
            messages={chatMessages}
            loading={chatLoading}
            sending={chatSending}
            errorMessage={chatError}
            canSend={isTrainerView || student.auth_user_id === profile.id}
            onSend={onSendChatMessage}
            onToggleStar={onToggleChatMessageStar}
            onRefresh={onRefreshChat}
          />
        ) : (
          <StudentModulePanel tab={normalizedTab} studentName={student.full_name} onChangeTab={onChangeTab} />
        )}
      </View>
    </View>
  );
}

function StudentModulePanel({
  tab,
  studentName,
  onChangeTab,
}: {
  tab: StudentProfileTab;
  studentName: string;
  onChangeTab: (tab: StudentProfileTab) => void;
}) {
  const moduleContent: Record<
    StudentProfileTab,
    {
      title: string;
      text: string;
      icon: IconName;
      features: Array<{ icon: IconName; title: string; text: string; tag: string }>;
      relatedTabs?: Array<{ tab: StudentProfileTab; icon: IconName; label: string }>;
    }
  > = {
    profile: {
      title: 'Perfil público',
      text: 'Foto, bio e links do aluno.',
      icon: 'account-edit-outline',
      features: [
        {
          icon: 'camera-outline',
          title: 'Identidade visual',
          text: 'Atualize avatar, capa e um nome de exibição mais bonito para o perfil.',
          tag: 'Visual',
        },
        {
          icon: 'at',
          title: 'Usuário e bio',
          text: 'Monte um @ simples, uma frase de apresentação e uma bio curta para o futuro feed.',
          tag: 'Perfil',
        },
        {
          icon: 'link-variant',
          title: 'Links públicos',
          text: 'Instagram, site e localização ficam prontos para a próxima fase social do app.',
          tag: 'Links',
        },
      ],
      relatedTabs: [
        { tab: 'summary', icon: 'view-dashboard-outline', label: 'Ver resumo' },
        { tab: 'chat', icon: 'message-text-outline', label: 'Abrir chat' },
      ],
    },
    summary: {
      title: 'Resumo',
      text: 'Resumo do aluno.',
      icon: 'view-dashboard-outline',
      features: [],
    },
    data: {
      title: 'Dados',
      text: 'Dados do aluno.',
      icon: 'account-edit-outline',
      features: [],
    },
    methodology: {
      title: 'Metodologia de trabalho',
      text: 'Aqui ficar? a regra do jogo para este aluno: divis?o semanal, progress?o, cardio, descanso, fase da dieta e decis?es do coach.',
      icon: 'strategy',
      features: [
        {
          icon: 'map-marker-path',
          title: 'M?todo atual',
          text: 'Defina se o aluno est? em adapta??o, hipertrofia, recomposi??o, cutting ou manuten??o.',
          tag: 'Fase',
        },
        {
          icon: 'chart-timeline-variant',
          title: 'Periodiza??o',
          text: 'Organize blocos, semanas de carga, deload, troca de est?mulo e prioridades musculares.',
          tag: 'Treino',
        },
        {
          icon: 'calendar-week-outline',
          title: 'Divis?o semanal',
          text: 'Cruze dias de treino, cardio, descanso e dias com mais ou menos calorias.',
          tag: 'Semana',
        },
        {
          icon: 'book-open-variant',
          title: 'Regras do processo',
          text: 'Guarde observa??es privadas do coach e crit?rios para ajustes futuros.',
          tag: 'Coach',
        },
      ],
      relatedTabs: [
        { tab: 'training', icon: 'dumbbell', label: 'Abrir treino' },
        { tab: 'nutrition', icon: 'food-apple-outline', label: 'Abrir dieta' },
        { tab: 'routine', icon: 'calendar-check-outline', label: 'Abrir rotina' },
      ],
    },
    routine: {
      title: 'Rotina do dia',
      text: 'Notas, h?bitos e lembretes que mant?m o aluno consistente entre os treinos.',
      icon: 'calendar-check-outline',
      features: [
        {
          icon: 'note-text-outline',
          title: 'Notas r?pidas',
          text: 'Registre tarefas do dia, pend?ncias e pequenos lembretes para n?o esquecer detalhes.',
          tag: 'Notas',
        },
        {
          icon: 'target',
          title: 'H?bitos recorrentes',
          text: 'Escolha dias da semana, hor?rio e acompanhe a execu??o com marca??o di?ria.',
          tag: 'H?bitos',
        },
        {
          icon: 'bell-outline',
          title: 'Lembretes',
          text: 'Ative notifica??es locais para refor?ar o hor?rio certo e aumentar a const?ncia.',
          tag: 'Alertas',
        },
      ],
      relatedTabs: [
        { tab: 'checkins', icon: 'clipboard-check-outline', label: 'Abrir check-in' },
        { tab: 'anamnesis', icon: 'clipboard-text-outline', label: 'Ver anamnese' },
      ],
    },
    anamnesis: {
      title: 'Anamnese inteligente',
      text: 'Base para entender rotina, saúde, histórico de treino, preferências, disponibilidade e objetivo antes de montar o plano.',
      icon: 'clipboard-text-outline',
      features: [
        {
          icon: 'account-heart-outline',
          title: 'Dados pessoais e saúde',
          text: 'Sono, estresse, lesões, medicamentos, limitações e sinais de atenção.',
          tag: 'Saúde',
        },
        {
          icon: 'clock-outline',
          title: 'Rotina diária',
          text: 'Trabalho, estudo, horários, deslocamento e janelas reais para treinar e comer.',
          tag: 'Rotina',
        },
        {
          icon: 'weight-lifter',
          title: 'Histórico de treino',
          text: 'Tempo de treino, frequência, equipamentos disponíveis e exercícios preferidos.',
          tag: 'Treino',
        },
        {
          icon: 'bullseye-arrow',
          title: 'Objetivos e dieta',
          text: 'Meta principal, aderência alimentar, alergias, suplementos e preferências.',
          tag: 'Plano',
        },
      ],
      relatedTabs: [
        { tab: 'methodology', icon: 'strategy', label: 'Criar método' },
        { tab: 'summary', icon: 'view-dashboard-outline', label: 'Ver perfil' },
      ],
    },
    evolution: {
      title: 'Evolução do aluno',
      text: 'Área para comparar peso, fotos, medidas, aderência, treinos concluídos e resposta do plano ao longo do tempo.',
      icon: 'chart-line',
      features: [
        {
          icon: 'scale-bathroom',
          title: 'Peso e medidas',
          text: 'Acompanhe tendência semanal, variação e pontos fora da curva.',
          tag: 'Métricas',
        },
        {
          icon: 'image-multiple-outline',
          title: 'Fotos comparativas',
          text: 'Compare frente, costas e laterais por período, como no fechamento mensal.',
          tag: 'Fotos',
        },
        {
          icon: 'clipboard-check-outline',
          title: 'Aderência',
          text: 'Cruze check-ins, treino, dieta e feedback para decidir ajustes.',
          tag: 'Check-in',
        },
        {
          icon: 'trophy-outline',
          title: 'Fechamentos',
          text: 'Resumo mensal com conquistas, próximos passos e mensagem do coach.',
          tag: 'Mês',
        },
      ],
      relatedTabs: [
        { tab: 'checkins', icon: 'clipboard-check-outline', label: 'Ver check-ins' },
        { tab: 'chat', icon: 'message-text-outline', label: 'Abrir chat' },
      ],
    },
    training: {
      title: 'Treino',
      text: 'Lugar para montar ficha, cardio, ordem dos exercícios, séries, cargas, progressão e substituições para o aluno.',
      icon: 'dumbbell',
      features: [
        {
          icon: 'format-list-bulleted',
          title: 'Ficha principal',
          text: 'Monte treinos por dia, grupos musculares, exercícios, séries, reps e observações.',
          tag: 'Musculação',
        },
        {
          icon: 'run-fast',
          title: 'Cardio',
          text: 'Defina modalidade, duração, intensidade e dias de cardio dentro da semana.',
          tag: 'Cardio',
        },
        {
          icon: 'progress-check',
          title: 'Execução e cargas',
          text: 'Prepare o histórico de cargas, repetições e conclusão de cada sessão.',
          tag: 'Histórico',
        },
        {
          icon: 'swap-horizontal',
          title: 'Substituições',
          text: 'Separe alternativas quando equipamento estiver ocupado ou houver limitação.',
          tag: 'Trocas',
        },
      ],
      relatedTabs: [
        { tab: 'methodology', icon: 'strategy', label: 'Metodologia' },
        { tab: 'checkins', icon: 'clipboard-check-outline', label: 'Check-ins' },
      ],
    },
    nutrition: {
      title: 'Dieta',
      text: 'Lugar para montar dieta base, refeições por dia, macros, distribuição semanal e ajustes por objetivo.',
      icon: 'food-apple-outline',
      features: [
        {
          icon: 'calculator-variant-outline',
          title: 'Estratégia calórica',
          text: 'Use TMB, gasto diário e objetivo para sugerir calorias, déficit ou superávit.',
          tag: 'Cálculo',
        },
        {
          icon: 'silverware-fork-knife',
          title: 'Refeições',
          text: 'Organize café, almoço, jantar, pré-treino, pós-treino e alternativas.',
          tag: 'Plano',
        },
        {
          icon: 'chart-donut',
          title: 'Macros',
          text: 'Distribua proteína, carboidrato e gordura de forma prática para o aluno.',
          tag: 'Macros',
        },
        {
          icon: 'calendar-sync-outline',
          title: 'Dias específicos',
          text: 'Prepare dias de treino pesado, cardio, descanso, high/mid/low carb.',
          tag: 'Semana',
        },
      ],
      relatedTabs: [
        { tab: 'methodology', icon: 'strategy', label: 'Metodologia' },
        { tab: 'anamnesis', icon: 'clipboard-text-outline', label: 'Anamnese' },
      ],
    },
    checkins: {
      title: 'Check-ins',
      text: 'Lugar para receber peso, fotos do shape, vídeo da última série, feedback e histórico do progresso.',
      icon: 'clipboard-check-outline',
      features: [
        {
          icon: 'camera-outline',
          title: 'Fotos do shape',
          text: 'Frente, costas e laterais para comparação visual do progresso.',
          tag: 'Fotos',
        },
        {
          icon: 'scale',
          title: 'Peso semanal',
          text: 'Registro de peso, variação e impacto nos cálculos de dieta.',
          tag: 'Peso',
        },
        {
          icon: 'video-outline',
          title: 'Vídeo de execução',
          text: 'Espaço para avaliar técnica e última série enviada pelo aluno.',
          tag: 'Técnica',
        },
        {
          icon: 'comment-check-outline',
          title: 'Feedback do coach',
          text: 'Resposta semanal com ajustes, elogios e próximos focos.',
          tag: 'Review',
        },
      ],
      relatedTabs: [
        { tab: 'evolution', icon: 'chart-line', label: 'Evolução' },
        { tab: 'chat', icon: 'message-text-outline', label: 'Chat' },
      ],
    },
    chat: {
      title: 'Chat',
      text: 'Lugar para conversa direta, avisos rápidos, dúvidas do aluno e histórico de mensagens.',
      icon: 'message-text-outline',
      features: [
        {
          icon: 'message-reply-text-outline',
          title: 'Mensagens',
          text: 'Conversa direta entre treinador e aluno com histórico organizado.',
          tag: 'Chat',
        },
        {
          icon: 'bell-badge-outline',
          title: 'Notificações',
          text: 'Destaque mensagens pendentes e alertas importantes do aluno.',
          tag: 'Alertas',
        },
        {
          icon: 'image-outline',
          title: 'Mídia',
          text: 'Prepare envio de imagens, vídeos e arquivos quando o chat real entrar.',
          tag: 'Mídia',
        },
        {
          icon: 'whatsapp',
          title: 'WhatsApp',
          text: 'Mantenha o contato externo como atalho sem perder o painel central.',
          tag: 'Contato',
        },
      ],
      relatedTabs: [
        { tab: 'checkins', icon: 'clipboard-check-outline', label: 'Check-ins' },
        { tab: 'ia', icon: 'robot-outline', label: 'Coach IA' },
      ],
    },
    ia: {
      title: 'Coach IA',
      text: 'Lugar para usar dados do aluno como apoio em análise de anamnese, troca de exercícios, dieta e feedback.',
      icon: 'robot-outline',
      features: [
        {
          icon: 'brain',
          title: 'Análise da anamnese',
          text: 'Resumo dos pontos de atenção e próximos passos com base no cadastro.',
          tag: 'Análise',
        },
        {
          icon: 'swap-horizontal-circle-outline',
          title: 'Troca de exercícios',
          text: 'Sugestões de substituição por equipamento, dor, preferência ou objetivo.',
          tag: 'Treino',
        },
        {
          icon: 'food-variant',
          title: 'Apoio na dieta',
          text: 'Ideias de refeições, ajustes de macros e observações para aderência.',
          tag: 'Dieta',
        },
        {
          icon: 'book-open-page-variant-outline',
          title: 'Base do coach',
          text: 'Espaço futuro para ensinar sua metodologia e padronizar respostas.',
          tag: 'Base',
        },
      ],
      relatedTabs: [
        { tab: 'anamnesis', icon: 'clipboard-text-outline', label: 'Anamnese' },
        { tab: 'methodology', icon: 'strategy', label: 'Metodologia' },
      ],
    },
  };
  const module = moduleContent[tab];

  return (
    <View style={styles.studentModule}>
      <View style={styles.moduleHero}>
        <View style={styles.placeholderIcon}>
          <MaterialCommunityIcons name={module.icon} size={32} color="#061007" />
        </View>
        <View style={styles.moduleHeroCopy}>
          <Text style={styles.sectionKicker}>Area em evolucao</Text>
          <Text style={styles.placeholderTitle}>{module.title} de {studentName}</Text>
          <Text style={styles.placeholderText}>{module.text}</Text>
        </View>
      </View>

      <View style={styles.moduleGrid}>
        {module.features.map((feature) => (
          <View key={feature.title} style={styles.moduleCard}>
            <View style={styles.moduleCardTop}>
              <View style={styles.moduleCardIcon}>
                <MaterialCommunityIcons name={feature.icon} size={18} color="#9CF02E" />
              </View>
              <View style={styles.moduleTag}>
                <Text style={styles.moduleTagText}>{feature.tag}</Text>
              </View>
            </View>
            <Text style={styles.moduleCardTitle}>{feature.title}</Text>
            <Text style={styles.moduleCardText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {module.relatedTabs ? (
        <View style={styles.relatedActions}>
          {module.relatedTabs.map((action) => (
            <Pressable
              key={action.tab}
              onPress={() => onChangeTab(action.tab)}
              style={({ pressed }) => [styles.relatedAction, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name={action.icon} size={16} color="#9CF02E" />
              <Text style={styles.relatedActionText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.placeholderPill}>
        <Text style={styles.placeholderPillText}>Estrutura pronta para conectar o editor real</Text>
      </View>
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <MaterialCommunityIcons name={icon} size={18} color="#9CF02E" />
      <View style={styles.infoTileCopy}>
        <Text style={styles.infoTileValue}>{value}</Text>
        <Text style={styles.infoTileLabel}>{label}</Text>
      </View>
    </View>
  );
}

function PlanPreviewCard({
  icon,
  eyebrow,
  title,
  subtitle,
  stats,
  notes,
  actionLabel,
  onAction,
  loading,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: string[];
  notes: string[];
  actionLabel: string;
  onAction: () => void;
  loading: boolean;
}) {
  return (
    <View style={styles.planPreviewCard}>
      <View style={styles.planPreviewTopRow}>
        <View style={styles.planPreviewIcon}>
          <MaterialCommunityIcons name={icon} size={19} color="#061007" />
        </View>
        <Text style={styles.planPreviewEyebrow}>{eyebrow}</Text>
      </View>

      <Text style={styles.planPreviewTitle}>{loading ? 'Carregando...' : title}</Text>
      <Text style={styles.planPreviewSubtitle}>{loading ? 'Sincronizando os dados do aluno.' : subtitle}</Text>

      <View style={styles.planPreviewStats}>
        {stats.map((stat) => (
          <View key={stat} style={styles.planPreviewStatPill}>
            <Text style={styles.planPreviewStatText}>{stat}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planPreviewNotes}>
        {notes.map((note) => (
          <View key={note} style={styles.planPreviewNoteRow}>
            <View style={styles.planPreviewDot} />
            <Text style={styles.planPreviewNoteText}>{note}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onAction} style={({ pressed }) => [styles.planPreviewButton, pressed && styles.pressed]}>
        <Text style={styles.planPreviewButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export function DashboardScreen({
  profile,
  consultancy,
  loading = false,
  onLogout,
}: DashboardScreenProps) {
  const dashboardScrollRef = useRef<ScrollView>(null);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('overview');
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const [showStudentMoreTabs, setShowStudentMoreTabs] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [ownStudent, setOwnStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentProfileTab, setStudentProfileTab] = useState<StudentProfileTab>('summary');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<StudentTrainingPlan | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [workoutSessions, setWorkoutSessions] = useState<StudentWorkoutSession[]>([]);
  const [workoutSessionsLoading, setWorkoutSessionsLoading] = useState(false);
  const [workoutSessionSaving, setWorkoutSessionSaving] = useState(false);
  const [workoutSessionError, setWorkoutSessionError] = useState<string | null>(null);
  const [cardioLogs, setCardioLogs] = useState<StudentCardioLog[]>([]);
  const [cardioLogsLoading, setCardioLogsLoading] = useState(false);
  const [cardioLogSaving, setCardioLogSaving] = useState(false);
  const [cardioLogError, setCardioLogError] = useState<string | null>(null);
  const [anamnesis, setAnamnesis] = useState<StudentAnamnesis | null>(null);
  const [anamnesisLoading, setAnamnesisLoading] = useState(false);
  const [anamnesisSaving, setAnamnesisSaving] = useState(false);
  const [anamnesisError, setAnamnesisError] = useState<string | null>(null);
  const [showAnamnesisPrompt, setShowAnamnesisPrompt] = useState(false);
  const [anamnesisPromptClosed, setAnamnesisPromptClosed] = useState(false);
  const [nutritionPlan, setNutritionPlan] = useState<StudentNutritionPlan | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionSaving, setNutritionSaving] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [nutritionLibrary, setNutritionLibrary] = useState<NutritionLibraryItem[]>([]);
  const [nutritionLibrarySaving, setNutritionLibrarySaving] = useState(false);
  const [nutritionLibraryError, setNutritionLibraryError] = useState<string | null>(null);
  const [mealLogs, setMealLogs] = useState<StudentMealLog[]>([]);
  const [mealLogsLoading, setMealLogsLoading] = useState(false);
  const [mealLogSaving, setMealLogSaving] = useState(false);
  const [mealLogError, setMealLogError] = useState<string | null>(null);
  const [mealLogDate, setMealLogDate] = useState(() => todayIsoDate());
  const [checkIns, setCheckIns] = useState<StudentCheckIn[]>([]);
  const [checkInsLoading, setCheckInsLoading] = useState(false);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<StudentFormMode | null>(null);
  const [studentWorkspaceState, setStudentWorkspaceState] = useState<StudentWorkspaceState | null>(null);
  const { width } = useWindowDimensions();
  const isDesktopLayout = Platform.OS === 'web' && width >= 1240;
  const isDemoMode =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === 'trainer';
  const isSupabaseConfigured = isSupabaseConfiguredBase && !isDemoMode;
  const isTrainer = profile.role === 'trainer';
  const displayName = profile.full_name?.trim() || (isTrainer ? 'Treinador' : 'Aluno');
  const title = consultancy?.name || (isTrainer ? 'Dashboard do treinador' : 'Dashboard do aluno');
  const whatsappUrl = normalizeWhatsappUrl(consultancy?.whatsapp ?? null);
  const activeStudents = students.filter((student) => student.status === 'active').length;
  const unreadNotifications = students.reduce((total, student) => total + (student.notifications_count ?? 0), 0);
  const notificationEntries: NotificationEntry[] = students
    .map((student) => ({
      student,
      count: student.notifications_count ?? 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((entryA, entryB) => {
      if (entryA.count !== entryB.count) {
        return entryB.count - entryA.count;
      }

      return entryA.student.full_name.localeCompare(entryB.student.full_name);
    });
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({ ...defaultPaymentConfig });
  const isInsideStudentProfile = isTrainer ? activeSection === 'students' && Boolean(selectedStudent) : Boolean(ownStudent);
  const isStudentTabInMore = !primaryStudentTabs.some((tab) => tab.tab === studentProfileTab);
  const profileStudent = isTrainer ? selectedStudent : ownStudent;
  const desktopRailTabs: DesktopRailItem[] = isInsideStudentProfile
    ? studentProfileTabs
    : allWorkspaceTabs;
  const desktopRailActiveId = isInsideStudentProfile ? studentProfileTab : activeSection;
  const desktopRailTitle = isInsideStudentProfile ? 'Perfil do aluno' : 'Central do treinador';
  const desktopRailDescription = isInsideStudentProfile
    ? profileStudent
      ? `${profileStudent.full_name} com resumo, treino, dieta, check-ins e chat em uma navegação lateral fixa.`
      : 'Abra um aluno para ver o perfil detalhado em tela larga.'
    : 'Atalhos visuais para navegar entre alunos, notificações, pagamento e IA sem abrir menus compactos.';

  useEffect(() => {
    let cancelled = false;

    void loadStudentWorkspaceState().then((state) => {
      if (!cancelled) {
        setStudentWorkspaceState(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [profile.id, consultancy?.id, isTrainer]);

  useEffect(() => {
    if (!studentWorkspaceState || !isTrainer) {
      return;
    }

    const restoredStudent = studentWorkspaceState.studentId
      ? students.find((student) => student.id === studentWorkspaceState.studentId) ?? null
      : null;

    if (studentWorkspaceState.studentId && !restoredStudent) {
      return;
    }

    if (studentWorkspaceState.activeSection) {
      setActiveSection(studentWorkspaceState.activeSection);
    }

    if (studentWorkspaceState.studentProfileTab) {
      setStudentProfileTab(studentWorkspaceState.studentProfileTab);
    }

    if (restoredStudent) {
      setSelectedStudent(restoredStudent);
    }

    setStudentWorkspaceState(null);
  }, [studentWorkspaceState, students, isTrainer]);

  useEffect(() => {
    if (!isTrainer) {
      return;
    }

    void saveStudentWorkspaceState({
      activeSection,
      studentId: selectedStudent?.id ?? null,
      studentProfileTab,
    });
  }, [activeSection, selectedStudent?.id, studentProfileTab, isTrainer]);

  const demoStudent: Student = {
    id: 'demo-student',
    trainer_id: profile.id,
    consultancy_id: consultancy?.id ?? 'demo-consultancy',
    auth_user_id: null,
    full_name: 'Rafael Costa',
    email: 'rafael.costa@exemplo.com',
    whatsapp: '(11) 99999-0101',
    age: 29,
    sex: 'male',
    height_cm: 178,
    weight_kg: 84,
    goal: 'hypertrophy',
    activity_level: 'moderate',
    experience: 'intermediate',
    restrictions: 'Nenhuma restricao relevante.',
    status: 'active',
    notifications_count: 3,
  };

  const localPreviewStudent: Student | null = !isSupabaseConfigured
    ? {
        id: `local-student-${profile.id}`,
        trainer_id: profile.id,
        consultancy_id: consultancy?.id ?? 'local-consultancy',
        auth_user_id: profile.role === 'student' ? profile.id : null,
        full_name: profile.role === 'trainer' ? 'Aluno de preview' : profile.full_name?.trim() || 'Aluno de preview',
        email: profile.role === 'trainer' ? 'aluno.preview@local' : `${profile.id}@preview.local`,
        whatsapp: '(11) 98888-0000',
        age: 28,
        sex: 'male',
        height_cm: 178,
        weight_kg: 82,
        goal: 'hypertrophy',
        activity_level: 'moderate',
        experience: 'intermediate',
        restrictions: 'Sem restricoes relevantes.',
        status: 'active',
        notifications_count: 0,
      }
    : null;

  const loadStudents = async () => {
    if (isDemoMode) {
      const trainerStudents = [demoStudent];
      setStudents(trainerStudents);
      setSelectedStudent(trainerStudents[0]);
      setStudentProfileTab('summary');
      setActiveSection('students');
      setTrainingPlan(buildDefaultTrainingPlan(demoStudent));
      setNutritionPlan(buildDefaultNutritionPlan(demoStudent));
      setWorkoutSessions([]);
      setCardioLogs([]);
      setAnamnesis(null);
      setMealLogs([]);
      setCheckIns([]);
      setChatMessages([]);
      setStudentError(null);
      setTrainingError(null);
      setNutritionError(null);
      setWorkoutSessionError(null);
      setCardioLogError(null);
      setAnamnesisError(null);
      setMealLogError(null);
      setCheckInError(null);
      setChatError(null);
      setStudentsLoading(false);
      setTrainingLoading(false);
      setNutritionLoading(false);
      setWorkoutSessionsLoading(false);
      setCardioLogsLoading(false);
      setAnamnesisLoading(false);
      setMealLogsLoading(false);
      setCheckInsLoading(false);
      setChatLoading(false);
      setShowStudentMoreTabs(false);
      setFormMode(null);
      return;
    }

    if (!isSupabaseConfigured) {
      if (localPreviewStudent) {
        const localNutritionPlan = await loadLocalNutritionPlan(localPreviewStudent);

        setStudents([localPreviewStudent]);
        setOwnStudent(isTrainer ? null : localPreviewStudent);
        setSelectedStudent(isTrainer ? localPreviewStudent : null);
        setStudentProfileTab('summary');
        setActiveSection('students');
        setTrainingPlan(buildDefaultTrainingPlan(localPreviewStudent));
        setNutritionPlan(localNutritionPlan ?? buildDefaultNutritionPlan(localPreviewStudent));
        setWorkoutSessions([]);
        setCardioLogs([]);
        setAnamnesis(
          createLocalStudentAnamnesis(localPreviewStudent, {
            answers: createPrefilledAnamnesisAnswers(localPreviewStudent),
            status: 'completed',
            dismissedAt: null,
            completedAt: new Date().toISOString(),
          }),
        );
        setMealLogs([]);
        setCheckIns([]);
        setChatMessages([]);
        setStudentError(null);
        setTrainingError(null);
        setNutritionError(null);
        setWorkoutSessionError(null);
        setCardioLogError(null);
        setAnamnesisError(null);
        setMealLogError(null);
        setCheckInError(null);
        setChatError(null);
        setStudentsLoading(false);
        setTrainingLoading(false);
        setNutritionLoading(false);
        setWorkoutSessionsLoading(false);
        setCardioLogsLoading(false);
        setAnamnesisLoading(false);
        setMealLogsLoading(false);
        setCheckInsLoading(false);
        setChatLoading(false);
        setShowStudentMoreTabs(false);
        setFormMode(null);
        return;
      }

      setStudentError('Configure o Supabase para carregar alunos.');
      return;
    }

    setStudentsLoading(true);
    setStudentError(null);

    try {
      if (isTrainer) {
        const trainerStudents = await fetchTrainerStudents(profile.id);
        setStudents(trainerStudents);
        setSelectedStudent((current) =>
          current ? trainerStudents.find((student) => student.id === current.id) ?? null : null,
        );
      } else {
        setOwnStudent(null);
        setTrainingPlan(null);
        setNutritionPlan(null);
        setWorkoutSessions([]);
        setMealLogs([]);
        setCardioLogs([]);
        setCheckIns([]);
        setChatMessages([]);
        const student = await fetchOwnStudent(profile.id);
        setOwnStudent(student);
        setStudentProfileTab('summary');
        setActiveSection('students');
      }
    } catch (error) {
      setOwnStudent(null);
      setStudentError(translateStudentError(error));
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    void loadStudents();
  }, [profile.id, profile.role, consultancy?.id]);

  const loadTrainingPlan = async (student: Student | null) => {
    if (!student) {
      setTrainingPlan(null);
      setTrainingError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      setTrainingPlan(buildDefaultTrainingPlan(student));
      setTrainingError(localPreviewStudent ? null : 'Configure o Supabase para carregar e salvar treinos.');
      return;
    }

    setTrainingLoading(true);
    setTrainingError(null);

    try {
      const currentPlan = await fetchStudentTrainingPlan(student);
      setTrainingPlan(currentPlan ?? (isTrainer ? buildDefaultTrainingPlan(student) : null));
    } catch (error) {
      setTrainingPlan(null);
      setTrainingError(translateTrainingError(error));
    } finally {
      setTrainingLoading(false);
    }
  };

  useEffect(() => {
    void loadTrainingPlan(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const loadNutritionPlan = async (student: Student | null) => {
    if (!student) {
      setNutritionPlan(null);
      setNutritionError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      const localPlan = await loadLocalNutritionPlan(student);
      setNutritionPlan(localPlan ?? buildDefaultNutritionPlan(student));
      setNutritionError(null);
      return;
    }

    setNutritionLoading(true);
    setNutritionError(null);

    try {
      const currentPlan = await fetchStudentNutritionPlan(student);
      setNutritionPlan(currentPlan ?? (isTrainer ? buildDefaultNutritionPlan(student) : null));
    } catch (error) {
      if (isNutritionFallbackError(error)) {
        const localPlan = await loadLocalNutritionPlan(student);
        setNutritionPlan(localPlan ?? buildDefaultNutritionPlan(student));
        setNutritionError(null);
      } else {
        setNutritionPlan(null);
        setNutritionError(translateNutritionError(error));
      }
    } finally {
      setNutritionLoading(false);
    }
  };

  useEffect(() => {
    void loadNutritionPlan(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const loadNutritionLibrary = async (student: Student | null) => {
    if (!student) {
      setNutritionLibrary([]);
      setNutritionLibraryError(null);
      return;
    }

    setNutritionLibraryError(null);

    try {
      if (!isSupabaseConfigured) {
        const localLibrary = await loadLocalNutritionFoodLibrary(student);
        setNutritionLibrary(localLibrary.length ? localLibrary : buildInitialFoodLibrary(student.trainer_id, student.consultancy_id));
        return;
      }

      const currentLibrary = await fetchNutritionFoodLibrary(student);
      setNutritionLibrary(
        currentLibrary.length ? currentLibrary : buildInitialFoodLibrary(student.trainer_id, student.consultancy_id),
      );
    } catch (error) {
      const localLibrary = await loadLocalNutritionFoodLibrary(student);
      setNutritionLibrary(
        localLibrary.length ? localLibrary : buildInitialFoodLibrary(student.trainer_id, student.consultancy_id),
      );
      setNutritionLibraryError(isNutritionLibraryFallbackError(error) ? null : translateNutritionError(error));
    }
  };

  useEffect(() => {
    void loadNutritionLibrary(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const handleSaveTrainingPlan = async (nextPlan: StudentTrainingPlan) => {
    if (!profileStudent) {
      setTrainingError('Abra o perfil de um aluno antes de salvar o treino.');
      return;
    }

    if (!isSupabaseConfigured) {
      setTrainingError('Configure o Supabase para salvar treinos.');
      return;
    }

    setTrainingSaving(true);
    setTrainingError(null);

    try {
      const savedPlan = await saveStudentTrainingPlan(profileStudent, nextPlan);
      setTrainingPlan(savedPlan);
    } catch (error) {
      setTrainingError(translateTrainingError(error));
      throw error;
    } finally {
      setTrainingSaving(false);
    }
  };

  const loadWorkoutSessions = async (student: Student | null) => {
    if (!student) {
      setWorkoutSessions([]);
      setWorkoutSessionError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      setWorkoutSessions([]);
      setWorkoutSessionError(localPreviewStudent ? null : 'Configure o Supabase para carregar sessoes de treino.');
      return;
    }

    setWorkoutSessionsLoading(true);
    setWorkoutSessionError(null);

    try {
      const currentSessions = await fetchStudentWorkoutSessions(student);
      setWorkoutSessions(currentSessions);
    } catch (error) {
      setWorkoutSessions([]);
      setWorkoutSessionError(translateTrainingError(error));
    } finally {
      setWorkoutSessionsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkoutSessions(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const buildLocalWorkoutSession = (workoutDay: WorkoutDay): StudentWorkoutSession => {
    const now = new Date().toISOString();

    return {
      id: `local-workout-${profile.id}-${workoutDay.id}-${Date.now()}`,
      studentId: profileStudent?.id ?? profile.id,
      trainerId: profileStudent?.trainer_id ?? profile.id,
      consultancyId: profileStudent?.consultancy_id ?? consultancy?.id ?? 'local-consultancy',
      trainingPlanId: trainingPlan?.id ?? null,
      workoutDayId: workoutDay.id,
      workoutDayName: workoutDay.name,
      status: 'in_progress',
      startedAt: now,
      completedAt: null,
      durationSeconds: null,
      exerciseLogs: workoutDay.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        primaryMuscle: exercise.primaryMuscle,
        completed: false,
        sets: exercise.sets.map((set, setIndex) => ({
          setId: set.id,
          setIndex: setIndex + 1,
          targetReps: set.reps,
          targetSetType: set.setType ?? 'working',
          targetWeight: set.suggestedWeight,
          targetLoadPercent: set.loadPercent,
          targetRir: set.rir,
          instruction: set.instruction,
          completed: false,
          weight: '',
          reps: '',
          actualRir: '',
          executionQuality: '',
          completedAt: '',
          notes: '',
        })),
      })),
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleStartWorkoutSession = async (workoutDay: WorkoutDay) => {
    if (!profileStudent || !trainingPlan) {
      setWorkoutSessionError('Seu treino ainda nao esta pronto para execucao.');
      return;
    }

    if (!isSupabaseConfigured) {
      if (localPreviewStudent) {
        const createdSession = buildLocalWorkoutSession(workoutDay);
        setWorkoutSessions((current) => [createdSession, ...current.filter((item) => item.id !== createdSession.id)]);
        setWorkoutSessionError(null);
        return createdSession;
      }

      setWorkoutSessionError('Configure o Supabase para iniciar treinos.');
      return;
    }

    setWorkoutSessionSaving(true);
    setWorkoutSessionError(null);

    try {
      const createdSession = await startStudentWorkoutSession({
        student: profileStudent,
        profile,
        plan: trainingPlan,
        workoutDay,
      });
      setWorkoutSessions((current) => [createdSession, ...current.filter((item) => item.id !== createdSession.id)]);
      return createdSession;
    } catch (error) {
      setWorkoutSessionError(translateTrainingError(error));
      throw error;
    } finally {
      setWorkoutSessionSaving(false);
    }
  };

  const handleSaveWorkoutSession = async (session: StudentWorkoutSession) => {
    if (!isSupabaseConfigured) {
      if (localPreviewStudent) {
        setWorkoutSessions((current) => current.map((item) => (item.id === session.id ? session : item)));
        setWorkoutSessionError(null);
        return session;
      }

      setWorkoutSessionError('Configure o Supabase para salvar sessoes de treino.');
      return;
    }

    setWorkoutSessionSaving(true);
    setWorkoutSessionError(null);

    try {
      const savedSession = await saveStudentWorkoutSessionRecord(session);
      setWorkoutSessions((current) =>
        current.map((item) => (item.id === savedSession.id ? savedSession : item)),
      );
      return savedSession;
    } catch (error) {
      setWorkoutSessionError(translateTrainingError(error));
      throw error;
    } finally {
      setWorkoutSessionSaving(false);
    }
  };

  const handleFinishWorkoutSession = async (session: StudentWorkoutSession) => {
    if (!isSupabaseConfigured) {
      if (localPreviewStudent) {
        const finishedAt = new Date();
        const startedAt = new Date(session.startedAt).getTime();
        const durationSeconds = Number.isFinite(startedAt)
          ? Math.max(0, Math.round((finishedAt.getTime() - startedAt) / 1000))
          : session.durationSeconds;
        const finishedSession = {
          ...session,
          status: 'completed' as const,
          completedAt: finishedAt.toISOString(),
          durationSeconds,
        };

        setWorkoutSessions((current) => current.map((item) => (item.id === finishedSession.id ? finishedSession : item)));
        setWorkoutSessionError(null);
        return finishedSession;
      }

      setWorkoutSessionError('Configure o Supabase para finalizar treinos.');
      return;
    }

    setWorkoutSessionSaving(true);
    setWorkoutSessionError(null);

    try {
      const finishedSession = await finishStudentWorkoutSession(session);
      setWorkoutSessions((current) =>
        current.map((item) => (item.id === finishedSession.id ? finishedSession : item)),
      );
      return finishedSession;
    } catch (error) {
      setWorkoutSessionError(translateTrainingError(error));
      throw error;
    } finally {
      setWorkoutSessionSaving(false);
    }
  };

  const loadCardioLogs = async (student: Student | null) => {
    if (!student) {
      setCardioLogs([]);
      setCardioLogError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      setCardioLogs([]);
      setCardioLogError(localPreviewStudent ? null : 'Configure o Supabase para carregar registros de cardio.');
      return;
    }

    setCardioLogsLoading(true);
    setCardioLogError(null);
    setCardioLogs((current) => current.filter((log) => log.studentId === student.id && log.id.startsWith('local-cardio-')));

    try {
      const currentLogs = await fetchStudentCardioLogs(student);
      setCardioLogs(currentLogs);
    } catch (error) {
      if (isCardioTableMissing(error)) {
        setCardioLogError(translateCardioError(error));
      } else {
        setCardioLogs([]);
        setCardioLogError(translateCardioError(error));
      }
    } finally {
      setCardioLogsLoading(false);
    }
  };

  useEffect(() => {
    void loadCardioLogs(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const handleSaveCardioLog = async (payload: SaveCardioLogPayload) => {
    if (!profileStudent) {
      setCardioLogError('Abra o perfil de um aluno antes de registrar cardio.');
      return;
    }

    if (!isSupabaseConfigured) {
      const localLog = buildLocalCardioLog(profileStudent, payload);
      setCardioLogs((current) => [localLog, ...current]);
      setCardioLogError('Registro salvo localmente no preview. Configure o Supabase para persistir.');
      return localLog;
    }

    setCardioLogSaving(true);
    setCardioLogError(null);

    try {
      const savedLog = await saveStudentCardioLog({
        student: profileStudent,
        profile,
        payload,
      });
      setCardioLogs((current) => [savedLog, ...current.filter((item) => item.id !== savedLog.id)]);
      return savedLog;
    } catch (error) {
      if (isCardioTableMissing(error)) {
        const localLog = buildLocalCardioLog(profileStudent, payload);
        setCardioLogs((current) => [localLog, ...current]);
        setCardioLogError(translateCardioError(error));
        return localLog;
      }

      setCardioLogError(translateCardioError(error));
      throw error;
    } finally {
      setCardioLogSaving(false);
    }
  };

  const loadAnamnesis = async (student: Student | null) => {
    if (!student) {
      setAnamnesis(null);
      setAnamnesisError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    const storageKey = `${ANAMNESIS_DISMISS_STORAGE_KEY}${student.id}`;

    if (!isSupabaseConfigured) {
      if (localPreviewStudent) {
        setAnamnesis(
          createLocalStudentAnamnesis(student, {
            answers: createPrefilledAnamnesisAnswers(student),
            status: 'completed',
            dismissedAt: null,
            completedAt: new Date().toISOString(),
          }),
        );
        setAnamnesisError(null);
        return;
      }

      const dismissedAt = await AsyncStorage.getItem(storageKey);
      setAnamnesis(
        dismissedAt
          ? createLocalStudentAnamnesis(student, {
              answers: createPrefilledAnamnesisAnswers(student),
              status: 'draft',
              dismissedAt,
              completedAt: null,
            })
          : null,
      );
      setAnamnesisError(null);
      return;
    }

    setAnamnesisLoading(true);
    setAnamnesisError(null);

    try {
      const currentAnamnesis = await fetchStudentAnamnesis(student);
      setAnamnesis(currentAnamnesis);
    } catch (error) {
      if (isAnamnesisTableMissing(error)) {
        const dismissedAt = await AsyncStorage.getItem(storageKey);
        setAnamnesis(
          dismissedAt
            ? createLocalStudentAnamnesis(student, {
                answers: createPrefilledAnamnesisAnswers(student),
                status: 'draft',
                dismissedAt,
                completedAt: null,
              })
            : null,
        );
      } else {
        setAnamnesis(null);
      }
      setAnamnesisError(isAnamnesisTableMissing(error) ? null : translateAnamnesisError(error));
    } finally {
      setAnamnesisLoading(false);
    }
  };

  useEffect(() => {
    void loadAnamnesis(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  useEffect(() => {
    setAnamnesisPromptClosed(false);
  }, [profileStudent?.id]);

  useEffect(() => {
    if (profile.role !== 'student' || !ownStudent || anamnesisLoading || anamnesisPromptClosed) {
      setShowAnamnesisPrompt(false);
      return;
    }

    const answers = createPrefilledAnamnesisAnswers(ownStudent, anamnesis?.answers ?? {});
    const progress = getAnamnesisProgress(answers);
    const shouldShow = !anamnesis?.dismissedAt && anamnesis?.status !== 'completed' && !progress.completed;

    setShowAnamnesisPrompt(shouldShow);
  }, [
    profile.role,
    ownStudent?.id,
    anamnesis?.id,
    anamnesis?.status,
    anamnesis?.dismissedAt,
    anamnesis?.updatedAt,
    anamnesisLoading,
    anamnesisPromptClosed,
  ]);

  const handleSaveAnamnesis = async (payload: SaveAnamnesisPayload) => {
    if (!profileStudent) {
      setAnamnesisError('Abra o perfil de um aluno antes de salvar a anamnese.');
      return;
    }

    const storageKey = `${ANAMNESIS_DISMISS_STORAGE_KEY}${profileStudent.id}`;

    if (!isSupabaseConfigured) {
      const localRecord = createLocalStudentAnamnesis(profileStudent, payload);
      setAnamnesis(localRecord);
      if (payload.dismissedAt) {
        await AsyncStorage.setItem(storageKey, payload.dismissedAt);
      }
      setAnamnesisError(null);
      return localRecord;
    }

    setAnamnesisSaving(true);
    setAnamnesisError(null);

    try {
      const savedAnamnesis = await saveStudentAnamnesis({
        student: profileStudent,
        profile,
        anamnesis,
        payload,
      });
      setAnamnesis(savedAnamnesis);
      if (payload.dismissedAt) {
        await AsyncStorage.setItem(storageKey, payload.dismissedAt);
      }
      return savedAnamnesis;
    } catch (error) {
      if (isAnamnesisTableMissing(error)) {
        const localRecord = createLocalStudentAnamnesis(profileStudent, payload);
        setAnamnesis(localRecord);
        if (payload.dismissedAt) {
          await AsyncStorage.setItem(storageKey, payload.dismissedAt);
        }
        setAnamnesisError(null);
        return localRecord;
      }

      setAnamnesisError(translateAnamnesisError(error));
      throw error;
    } finally {
      setAnamnesisSaving(false);
    }
  };

  const handleSaveNutritionPlan = async (nextPlan: StudentNutritionPlan) => {
    if (!profileStudent) {
      setNutritionError('Abra o perfil de um aluno antes de salvar a dieta.');
      return;
    }

    setNutritionSaving(true);
    setNutritionError(null);

    try {
      if (!isSupabaseConfigured) {
        const localPlan = await saveLocalNutritionPlan(profileStudent, nextPlan);
        setNutritionPlan(localPlan);
        return;
      }

      const savedPlan = await saveStudentNutritionPlan(profileStudent, nextPlan);
      setNutritionPlan(savedPlan);
      return;
    } catch (error) {
      if (isNutritionFallbackError(error)) {
        const localPlan = await saveLocalNutritionPlan(profileStudent, nextPlan);
        setNutritionPlan(localPlan);
        setNutritionError(null);
        return;
      }

      setNutritionError(translateNutritionError(error));
      throw error;
    } finally {
      setNutritionSaving(false);
    }
  };

  const handleSaveNutritionLibrary = async (nextLibrary: NutritionLibraryItem[]) => {
    if (!profileStudent) {
      setNutritionLibraryError('Abra o perfil de um aluno antes de salvar a biblioteca.');
      return;
    }

    setNutritionLibrarySaving(true);
    setNutritionLibraryError(null);

    try {
      if (!isSupabaseConfigured) {
        const localLibrary = await saveLocalNutritionFoodLibrary(profileStudent, nextLibrary);
        setNutritionLibrary(localLibrary);
        return localLibrary;
      }

      const savedLibrary = await saveNutritionFoodLibrary(profileStudent, nextLibrary);
      setNutritionLibrary(savedLibrary);
      return savedLibrary;
    } catch (error) {
      const localLibrary = await saveLocalNutritionFoodLibrary(profileStudent, nextLibrary);
      setNutritionLibrary(localLibrary);
      setNutritionLibraryError(isNutritionLibraryFallbackError(error) ? null : translateNutritionError(error));
      return localLibrary;
    } finally {
      setNutritionLibrarySaving(false);
    }
  };

  const loadMealLogs = async (student: Student | null, date = mealLogDate) => {
    if (!student) {
      setMealLogs([]);
      setMealLogError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      const localLogs = await fetchLocalStudentMealLogs(student, date);
      setMealLogs(localLogs);
      setMealLogError(null);
      return;
    }

    setMealLogsLoading(true);
    setMealLogError(null);

    try {
      const currentLogs = await fetchStudentMealLogs(student, date);
      setMealLogs(currentLogs);
    } catch (error) {
      const localLogs = await fetchLocalStudentMealLogs(student, date);
      setMealLogs(localLogs);
      setMealLogError(localLogs.length ? null : translateNutritionError(error));
    } finally {
      setMealLogsLoading(false);
    }
  };

  useEffect(() => {
    setMealLogDate(todayIsoDate());
  }, [profileStudent?.id]);

  useEffect(() => {
    void loadMealLogs(profileStudent, mealLogDate);
  }, [profileStudent?.id, isTrainer, mealLogDate]);

  const handleChangeMealLogDate = (date: string) => {
    setMealLogDate(date);
  };

  const handleSaveMealLog = async (payload: SaveMealLogPayload) => {
    if (!profileStudent) {
      setMealLogError('Abra o perfil de um aluno antes de atualizar a dieta.');
      return;
    }

    if (!isSupabaseConfigured) {
      const savedLog = await saveLocalStudentMealLog({
        student: profileStudent,
        payload,
      });
      setMealLogs((current) => [savedLog, ...current.filter((item) => item.id !== savedLog.id)]);
      setMealLogError(null);
      return savedLog;
    }

    setMealLogSaving(true);
    setMealLogError(null);

    try {
      const savedLog = await saveStudentMealLog({
        student: profileStudent,
        payload,
      });
      setMealLogs((current) => [savedLog, ...current.filter((item) => item.id !== savedLog.id)]);
      return savedLog;
    } catch (error) {
      const savedLog = await saveLocalStudentMealLog({
        student: profileStudent,
        payload,
      });
      setMealLogs((current) => [savedLog, ...current.filter((item) => item.id !== savedLog.id)]);
      setMealLogError(translateNutritionError(error));
      return savedLog;
    } finally {
      setMealLogSaving(false);
    }
  };

  const loadCheckIns = async (student: Student | null) => {
    if (!student) {
      setCheckIns([]);
      setCheckInError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      setCheckIns([]);
      setCheckInError('Configure o Supabase para carregar e enviar check-ins.');
      return;
    }

    setCheckInsLoading(true);
    setCheckInError(null);

    try {
      const currentCheckIns = await fetchStudentCheckIns(student);
      setCheckIns(currentCheckIns);
    } catch (error) {
      setCheckIns([]);
      setCheckInError(translateCheckInError(error));
    } finally {
      setCheckInsLoading(false);
    }
  };

  useEffect(() => {
    void loadCheckIns(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const handleSubmitCheckIn = async (payload: SubmitCheckInPayload) => {
    if (!profileStudent) {
      setCheckInError('Abra o perfil de um aluno antes de enviar check-in.');
      return;
    }

    if (!isSupabaseConfigured) {
      setCheckInError('Configure o Supabase para enviar check-ins.');
      return;
    }

    setCheckInSaving(true);
    setCheckInError(null);

    try {
      const createdCheckIn = await submitStudentCheckIn({
        student: profileStudent,
        profile,
        payload,
      });
      setCheckIns((current) => [createdCheckIn, ...current]);
      await loadStudents();
    } catch (error) {
      setCheckInError(translateCheckInError(error));
      throw error;
    } finally {
      setCheckInSaving(false);
    }
  };

  const handleReviewCheckIn = async (checkIn: StudentCheckIn, payload: ReviewCheckInPayload) => {
    if (!isSupabaseConfigured) {
      setCheckInError('Configure o Supabase para revisar check-ins.');
      return;
    }

    setCheckInSaving(true);
    setCheckInError(null);

    try {
      const updatedCheckIn = await reviewStudentCheckIn(checkIn, payload);
      setCheckIns((current) => current.map((item) => (item.id === updatedCheckIn.id ? updatedCheckIn : item)));
      await loadStudents();
    } catch (error) {
      setCheckInError(translateCheckInError(error));
      throw error;
    } finally {
      setCheckInSaving(false);
    }
  };

  const loadChatMessages = async (student: Student | null) => {
    if (!student) {
      setChatMessages([]);
      setChatError(null);
      return;
    }

    if (isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured) {
      setChatMessages([]);
      setChatError('Configure o Supabase para carregar e enviar mensagens.');
      return;
    }

    setChatLoading(true);
    setChatError(null);

    try {
      const currentMessages = await fetchStudentChatMessages(student);
      setChatMessages(currentMessages);
    } catch (error) {
      setChatMessages([]);
      setChatError(translateChatError(error));
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    void loadChatMessages(profileStudent);
  }, [profileStudent?.id, isTrainer]);

  const handleSendChatMessage = async (payload: SendChatMessagePayload) => {
    if (!profileStudent) {
      setChatError('Abra o perfil de um aluno antes de enviar mensagem.');
      return;
    }

    if (!isSupabaseConfigured) {
      setChatError('Configure o Supabase para enviar mensagens.');
      return;
    }

    setChatSending(true);
    setChatError(null);

    try {
      const sentMessage = await sendStudentChatMessage({
        student: profileStudent,
        profile,
        payload,
      });
      setChatMessages((current) => [...current, sentMessage]);
    } catch (error) {
      setChatError(translateChatError(error));
      throw error;
    } finally {
      setChatSending(false);
    }
  };

  const handleToggleChatMessageStar = async (message: ChatMessage) => {
    if (!isSupabaseConfigured) {
      setChatError('Configure o Supabase para marcar mensagens.');
      return;
    }

    setChatError(null);

    try {
      const updatedMessage = await toggleStudentChatMessageStar(message);
      setChatMessages((current) =>
        current.map((item) => (item.id === updatedMessage.id ? updatedMessage : item)),
      );
    } catch (error) {
      setChatError(translateChatError(error));
      throw error;
    }
  };

  const handleActionPress = (section: WorkspaceSection) => {
    setActiveSection(section);
    setShowMoreTabs(false);
    setShowStudentMoreTabs(false);
  };

  const handleClearNotifications = () => {
    setStudents((current) =>
      current.map((student) =>
        (student.notifications_count ?? 0) > 0 ? { ...student, notifications_count: 0 } : student,
      ),
    );
    setSelectedStudent((current) =>
      current ? { ...current, notifications_count: 0 } : current,
    );
    setOwnStudent((current) => (current ? { ...current, notifications_count: 0 } : current));
  };

  const handleResetPaymentConfig = () => {
    setPaymentConfig({ ...defaultPaymentConfig });
  };

  const handleBottomTabPress = (tab: BottomTab) => {
    if (tab.id === 'more') {
      setShowMoreTabs((currentValue) => !currentValue);
      return;
    }

    handleActionPress(tab.section ?? tab.id);
  };

  const handleOpenStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentProfileTab('summary');
    setActiveSection('students');
    setShowMoreTabs(false);
    setShowStudentMoreTabs(false);
  };

  const handleStudentTabSelect = (tab: StudentProfileTab) => {
    setStudentProfileTab(tab);
    setShowStudentMoreTabs(false);
  };

  const handleStudentBottomTabPress = (tab: StudentBottomTab) => {
    if (tab.id === 'more') {
      setShowStudentMoreTabs((currentValue) => !currentValue);
      return;
    }

    handleStudentTabSelect(tab.tab ?? tab.id);
  };

  const handleCreateStudent = async (payload: StudentFormPayload) => {
    if (!consultancy) {
      setStudentError('Crie sua consultoria antes de cadastrar alunos.');
      return;
    }

    setStudentSaving(true);
    setStudentError(null);

    try {
      const createdStudent = await createStudentRecord(consultancy.id, payload);
      setStudents((current) => [{ ...createdStudent, notifications_count: 0 }, ...current]);
      setSelectedStudent({ ...createdStudent, notifications_count: 0 });
      setStudentProfileTab('summary');
      setActiveSection('students');
      setShowStudentMoreTabs(false);
      setFormMode(null);
    } catch (error) {
      setStudentError(translateStudentError(error));
    } finally {
      setStudentSaving(false);
    }
  };

  const handleUpdateStudent = async (payload: StudentFormPayload) => {
    if (!selectedStudent) {
      return;
    }

    setStudentSaving(true);
    setStudentError(null);

    try {
      const updatedStudent = await updateStudentRecord(selectedStudent.id, payload);
      const nextStudent = {
        ...updatedStudent,
        notifications_count: selectedStudent.notifications_count ?? 0,
      };
      setStudents((current) =>
        current.map((student) => (student.id === selectedStudent.id ? nextStudent : student)),
      );
      setSelectedStudent(nextStudent);
      setFormMode(null);
    } catch (error) {
      setStudentError(translateStudentError(error));
    } finally {
      setStudentSaving(false);
    }
  };

  const handleSaveStudentProfile = async (payload: StudentProfilePayload): Promise<void> => {
    const targetStudent = selectedStudent ?? ownStudent;

    if (!targetStudent) {
      setStudentError('Abra um perfil de aluno antes de salvar o perfil.');
      return;
    }

    setStudentSaving(true);
    setStudentError(null);

    try {
      if (!isSupabaseConfigured) {
        const nextStudent: Student = {
          ...targetStudent,
          display_name: payload.displayName.trim() || targetStudent.full_name,
          username: payload.username.trim().replace(/^@+/, '').toLowerCase() || null,
          headline: payload.headline.trim() || null,
          bio: payload.bio.trim() || null,
          location: payload.location.trim() || null,
          instagram_url: payload.instagramUrl.trim() || null,
          website_url: payload.websiteUrl.trim() || null,
          avatar_url: payload.avatarAsset?.uri ?? targetStudent.avatar_url ?? null,
          cover_url: payload.coverAsset?.uri ?? targetStudent.cover_url ?? null,
        };

        setStudents((current) => current.map((student) => (student.id === nextStudent.id ? nextStudent : student)));

        if (selectedStudent?.id === nextStudent.id) {
          setSelectedStudent(nextStudent);
        }

        if (ownStudent?.id === nextStudent.id) {
          setOwnStudent(nextStudent);
        }

        return;
      }

      const updatedStudent = await updateStudentProfileRecord(targetStudent.id, payload);
      setStudents((current) => current.map((student) => (student.id === updatedStudent.id ? updatedStudent : student)));

      if (selectedStudent?.id === updatedStudent.id) {
        setSelectedStudent(updatedStudent);
      }

      if (ownStudent?.id === updatedStudent.id) {
        setOwnStudent(updatedStudent);
      }

      return;
    } catch (error) {
      setStudentError(translateStudentError(error));
      throw error;
    } finally {
      setStudentSaving(false);
    }
  };

  const renderOverview = () => (
    <View style={styles.pageStack}>
      <View style={styles.heroGrid}>
        <View style={styles.heroCard}>
          {consultancy?.banner_url ? (
            <ImageBackground source={{ uri: consultancy.banner_url }} resizeMode="cover" style={styles.banner}>
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.02)', 'rgba(3, 7, 3, 0.9)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.bannerShade}
              />
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={['rgba(177, 255, 42, 0.18)', 'rgba(88, 233, 118, 0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            />
          )}

          <View style={styles.heroContent}>
            <View style={styles.logoShell}>
              {consultancy?.image_url ? (
                <Image source={{ uri: consultancy.image_url }} style={styles.logoImage} />
              ) : (
                <MaterialCommunityIcons name="dumbbell" size={32} color="#9CF02E" />
              )}
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.roleBadge}>
                <MaterialCommunityIcons
                  name={isTrainer ? 'account-tie-outline' : 'account-outline'}
                  size={14}
                  color="#9CF02E"
                />
                <Text style={styles.roleBadgeText}>{isTrainer ? 'Painel do treinador' : 'Painel do aluno'}</Text>
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {displayName}, sua consultoria está pronta para ganhar operação: alunos,
                notificações, pagamentos e análise inteligente em um só painel.
              </Text>
            </View>
          </View>
        </View>

      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(8, 12, 8, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.commandCard}
        >
          <Text style={styles.commandEyebrow}>Operacao do dia</Text>
          <Text style={styles.commandTitle}>Ative o fluxo de clientes.</Text>
          <Text style={styles.commandText}>
            A area de clientes esta conectada ao Supabase e pronta para organizar alunos,
            pendências e cobrança.
          </Text>

          <Pressable
            onPress={() => handleActionPress('students')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Feather name="users" size={17} color="#061007" />
            <Text style={styles.primaryButtonText}>Abrir central de alunos</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionKicker}>Atalhos</Text>
          <Text style={styles.sectionTitle}>Acesso rápido do treinador</Text>
          <Text style={styles.sectionHint}>
            Abra as áreas mais usadas sem depender da barra inferior.
          </Text>
        </View>
      </View>

      <View style={styles.quickGrid}>
        {allWorkspaceTabs
          .filter((item) => item.id !== 'overview')
          .map((action) => (
            <QuickActionButton
              key={action.id}
              action={action}
              active={activeSection === action.id}
              onPress={() => handleActionPress(action.id)}
            />
          ))}
      </View>

      {consultancy ? (
        <View style={styles.contactRow}>
          <ContactButton icon="phone" label="WhatsApp" url={whatsappUrl} />
          <ContactButton icon="instagram" label="Instagram" url={consultancy.instagram_url} />
          <ContactButton icon="globe" label="Site" url={consultancy.website_url} />
        </View>
      ) : null}

      {studentError ? <ErrorNotice message={studentError} /> : null}

      <View style={styles.metricsGrid}>
        <DashboardMetric
          icon="account-group-outline"
          label="Alunos ativos"
          value={String(activeStudents)}
          helper="Contas reais cadastradas"
        />
        <DashboardMetric
          icon="bell-outline"
          label="Notificações"
          value={String(unreadNotifications)}
          helper="Pendências dos alunos"
        />
        <DashboardMetric
          icon="calculator-variant-outline"
          label="Com cálculo"
          value={String(students.filter((student) => calculateStudentMetrics(student).bmr !== null).length)}
          helper="IMC, TMB e calorias"
        />
        <DashboardMetric
          icon="clipboard-check-outline"
          label="Check-ins"
          value="0"
          helper="Módulo preparado"
        />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={styles.mainColumn}>
          <NotificationsPanel
            entries={notificationEntries}
            loading={studentsLoading}
            onClearAll={handleClearNotifications}
            onOpenStudent={handleOpenStudent}
          />
        </View>

        <View style={styles.sideColumn}>
          <PaymentSummaryCard
            config={paymentConfig}
            onOpenPayments={() => handleActionPress('payments')}
          />
        </View>
      </View>
    </View>
  );

  const renderTrainerContent = () => {
    if (activeSection === 'notifications') {
      return (
        <NotificationsPage
          entries={notificationEntries}
          loading={studentsLoading}
          onClearAll={handleClearNotifications}
          onOpenStudent={handleOpenStudent}
        />
      );
    }

    if (activeSection === 'payments') {
      return (
        <PaymentsPage
          config={paymentConfig}
          onChange={setPaymentConfig}
          onReset={handleResetPaymentConfig}
        />
      );
    }

    if (activeSection === 'ia') {
      return (
        <CoachIAPage
          studentCount={students.length}
          notificationCount={unreadNotifications}
          onNavigate={handleActionPress}
        />
      );
    }

    if (activeSection === 'students' && selectedStudent) {
      return (
        <StudentProfilePage
          student={selectedStudent}
          tab={studentProfileTab}
          isTrainerView
          canEdit
          studentSaving={studentSaving}
          trainingPlan={trainingPlan}
          trainingLoading={trainingLoading}
          trainingSaving={trainingSaving}
          trainingError={trainingError}
          workoutSessions={workoutSessions}
          workoutSessionsLoading={workoutSessionsLoading}
          workoutSessionSaving={workoutSessionSaving}
          workoutSessionError={workoutSessionError}
          cardioLogs={cardioLogs}
          cardioLogsLoading={cardioLogsLoading}
          cardioLogSaving={cardioLogSaving}
          cardioLogError={cardioLogError}
          anamnesis={anamnesis}
          anamnesisLoading={anamnesisLoading}
          anamnesisSaving={anamnesisSaving}
          anamnesisError={anamnesisError}
          nutritionPlan={nutritionPlan}
          nutritionLibrary={nutritionLibrary}
          nutritionLoading={nutritionLoading}
          nutritionSaving={nutritionSaving}
          nutritionLibrarySaving={nutritionLibrarySaving}
          nutritionError={nutritionError}
          nutritionLibraryError={nutritionLibraryError}
          mealLogs={mealLogs}
          mealLogsLoading={mealLogsLoading}
          mealLogSaving={mealLogSaving}
          mealLogError={mealLogError}
          mealLogDate={mealLogDate}
          checkIns={checkIns}
          checkInsLoading={checkInsLoading}
          checkInSaving={checkInSaving}
          checkInError={checkInError}
          chatMessages={chatMessages}
          chatLoading={chatLoading}
          chatSending={chatSending}
          chatError={chatError}
          onBack={() => {
            setSelectedStudent(null);
            setShowStudentMoreTabs(false);
          }}
          onEdit={() => setFormMode('edit')}
          onCloseEditor={() => {
            setStudentProfileTab('summary');
            requestAnimationFrame(() => {
              dashboardScrollRef.current?.scrollTo({ y: 0, animated: true });
            });
          }}
          onChangeTab={handleStudentTabSelect}
          onSaveTrainingPlan={handleSaveTrainingPlan}
          onStartWorkoutSession={handleStartWorkoutSession}
          onSaveWorkoutSession={handleSaveWorkoutSession}
          onFinishWorkoutSession={handleFinishWorkoutSession}
          onRefreshWorkoutSessions={() => loadWorkoutSessions(profileStudent)}
          onSaveCardioLog={handleSaveCardioLog}
          onRefreshCardioLogs={() => loadCardioLogs(profileStudent)}
          onSaveAnamnesis={handleSaveAnamnesis}
          onSaveNutritionPlan={handleSaveNutritionPlan}
          onSaveNutritionLibrary={handleSaveNutritionLibrary}
          onChangeMealLogDate={handleChangeMealLogDate}
          onSaveMealLog={handleSaveMealLog}
          onRefreshMealLogs={() => loadMealLogs(profileStudent, mealLogDate)}
          onSubmitCheckIn={handleSubmitCheckIn}
          onReviewCheckIn={handleReviewCheckIn}
          onRefreshCheckIns={() => loadCheckIns(profileStudent)}
          onSendChatMessage={handleSendChatMessage}
          onToggleChatMessageStar={handleToggleChatMessageStar}
          onRefreshChat={() => loadChatMessages(profileStudent)}
          onSaveStudentProfile={handleSaveStudentProfile}
          profile={profile}
        />
      );
    }

    if (activeSection === 'students') {
      return (
        <StudentsPage
          students={students}
          loading={studentsLoading}
          errorMessage={studentError}
          onRefresh={() => void loadStudents()}
          onCreate={() => {
            setStudentError(null);
            setFormMode('create');
          }}
          onOpenStudent={handleOpenStudent}
        />
      );
    }

    return renderOverview();
  };

  const renderStudentContent = () => {
    if (studentsLoading) {
      return (
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color="#9CF02E" />
          <Text style={styles.loadingText}>Sincronizando sua operacao...</Text>
        </View>
      );
    }

    if (!ownStudent) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="account-alert-outline" size={28} color="#061007" />
          </View>
          <Text style={styles.emptyTitle}>Cadastro de aluno não encontrado</Text>
          <Text style={styles.emptyText}>
            Peça ao seu treinador para criar seu acesso e vincular seus dados iniciais.
          </Text>
          {studentError ? <ErrorNotice message={studentError} /> : null}
        </View>
      );
    }

    return (
      <StudentProfilePage
        student={ownStudent}
        tab={studentProfileTab}
        isTrainerView={false}
        canEdit={profile.role === 'trainer' || ownStudent?.auth_user_id === profile.id}
        studentSaving={studentSaving}
        trainingPlan={trainingPlan}
        trainingLoading={trainingLoading}
        trainingSaving={trainingSaving}
        trainingError={trainingError}
        workoutSessions={workoutSessions}
        workoutSessionsLoading={workoutSessionsLoading}
        workoutSessionSaving={workoutSessionSaving}
        workoutSessionError={workoutSessionError}
        cardioLogs={cardioLogs}
        cardioLogsLoading={cardioLogsLoading}
        cardioLogSaving={cardioLogSaving}
        cardioLogError={cardioLogError}
        anamnesis={anamnesis}
        anamnesisLoading={anamnesisLoading}
        anamnesisSaving={anamnesisSaving}
        anamnesisError={anamnesisError}
        nutritionPlan={nutritionPlan}
        nutritionLibrary={nutritionLibrary}
        nutritionLoading={nutritionLoading}
        nutritionSaving={nutritionSaving}
        nutritionLibrarySaving={nutritionLibrarySaving}
        nutritionError={nutritionError}
        nutritionLibraryError={nutritionLibraryError}
        mealLogs={mealLogs}
        mealLogsLoading={mealLogsLoading}
        mealLogSaving={mealLogSaving}
        mealLogError={mealLogError}
        mealLogDate={mealLogDate}
        checkIns={checkIns}
        checkInsLoading={checkInsLoading}
        checkInSaving={checkInSaving}
        checkInError={checkInError}
        chatMessages={chatMessages}
        chatLoading={chatLoading}
        chatSending={chatSending}
        chatError={chatError}
        onCloseEditor={() => {
          setStudentProfileTab('summary');
          requestAnimationFrame(() => {
            dashboardScrollRef.current?.scrollTo({ y: 0, animated: true });
          });
        }}
        onChangeTab={handleStudentTabSelect}
        onSaveTrainingPlan={handleSaveTrainingPlan}
        onStartWorkoutSession={handleStartWorkoutSession}
        onSaveWorkoutSession={handleSaveWorkoutSession}
        onFinishWorkoutSession={handleFinishWorkoutSession}
        onRefreshWorkoutSessions={() => loadWorkoutSessions(profileStudent)}
        onSaveCardioLog={handleSaveCardioLog}
        onRefreshCardioLogs={() => loadCardioLogs(profileStudent)}
        onSaveAnamnesis={handleSaveAnamnesis}
        onSaveNutritionPlan={handleSaveNutritionPlan}
        onSaveNutritionLibrary={handleSaveNutritionLibrary}
        onChangeMealLogDate={handleChangeMealLogDate}
        onSaveMealLog={handleSaveMealLog}
        onRefreshMealLogs={() => loadMealLogs(profileStudent, mealLogDate)}
        onSubmitCheckIn={handleSubmitCheckIn}
        onReviewCheckIn={handleReviewCheckIn}
        onRefreshCheckIns={() => loadCheckIns(profileStudent)}
        onSendChatMessage={handleSendChatMessage}
        onToggleChatMessageStar={handleToggleChatMessageStar}
        onRefreshChat={() => loadChatMessages(profileStudent)}
        onSaveStudentProfile={handleSaveStudentProfile}
        profile={profile}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AuthBackground />

      <ScrollView
        ref={dashboardScrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[
            styles.shell,
            isDesktopLayout && styles.shellDesktop,
            isInsideStudentProfile && !isDesktopLayout && styles.shellStudentProfile,
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.brandCluster}>
              <View style={styles.brandMark}>
                <MaterialCommunityIcons name="arm-flex-outline" size={18} color="#061007" />
              </View>
              <View>
                <Text style={styles.brandName}>Aplicativo-Consultoria</Text>
                <Text style={styles.brandSubline}>{isTrainer ? 'Central do treinador' : 'Área do aluno'}</Text>
              </View>
            </View>

            <Pressable
              onPress={loading ? undefined : onLogout}
              disabled={loading}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
                loading && styles.disabledButton,
              ]}
            >
              <Feather name="log-out" size={15} color="#DCF4C8" />
              <Text style={styles.logoutText}>{loading ? 'Saindo...' : 'Sair'}</Text>
            </Pressable>
          </View>

          {isTrainer && isDesktopLayout ? (
            <View style={styles.desktopWorkspace}>
              <View
                style={[
                  styles.desktopRail,
                  isDesktopLayout && Platform.OS === 'web' ? ({ position: 'sticky', top: 24 } as any) : null,
                ]}
              >
                <View style={styles.desktopRailHeader}>
                  <Text style={styles.desktopRailKicker}>Experiência desktop</Text>
                  <Text style={styles.desktopRailTitle}>{desktopRailTitle}</Text>
                  <Text style={styles.desktopRailDescription}>{desktopRailDescription}</Text>
                </View>

                <View style={styles.desktopRailTabs}>
                  {desktopRailTabs.map((item) => (
                    <DesktopRailButton
                      key={item.id}
                      item={item}
                      active={desktopRailActiveId === item.id}
                      onPress={() => {
                        if (isInsideStudentProfile) {
                          handleStudentTabSelect(item.id as StudentProfileTab);
                        } else {
                          handleActionPress(item.id as WorkspaceSection);
                        }
                      }}
                    />
                  ))}
                </View>

                <View style={styles.desktopRailFooter}>
                  <Text style={styles.desktopRailFooterLabel}>Modo visualização ampla</Text>
                  <Text style={styles.desktopRailFooterText}>
                    Tudo fica disponível numa coluna fixa para operar alunos, notificações, pagamento e IA com mais fluidez.
                  </Text>
                </View>
              </View>

              <View style={styles.desktopWorkspaceContent}>{renderTrainerContent()}</View>
            </View>
          ) : isTrainer ? (
            renderTrainerContent()
          ) : (
            renderStudentContent()
          )}
        </View>
      </ScrollView>

      {isTrainer && !isDesktopLayout && !isInsideStudentProfile && showMoreTabs ? (
        <MoreTabsSheet
          activeSection={activeSection}
          onClose={() => setShowMoreTabs(false)}
          onSelect={handleActionPress}
        />
      ) : null}

      {isInsideStudentProfile && !isDesktopLayout && showStudentMoreTabs ? (
        <StudentMoreTabsSheet
          activeTab={studentProfileTab}
          tabs={isTrainer ? studentMoreTabsForTrainer : studentMoreTabsForStudent}
          onClose={() => setShowStudentMoreTabs(false)}
          onSelect={handleStudentTabSelect}
        />
      ) : null}

      {formMode ? (
        <StudentFormSheet
          mode={formMode}
          student={formMode === 'edit' ? selectedStudent : null}
          loading={studentSaving}
          errorMessage={studentError}
          onCancel={() => {
            if (!studentSaving) {
              setFormMode(null);
              setStudentError(null);
            }
          }}
          onSubmit={formMode === 'create' ? handleCreateStudent : handleUpdateStudent}
        />
      ) : null}

      {showAnamnesisPrompt && ownStudent ? (
        <View style={styles.anamnesisPromptOverlay}>
          <ScrollView
            contentContainerStyle={styles.anamnesisPromptScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.anamnesisPromptSheet}>
              <StudentAnamnesisPanel
                student={ownStudent}
                profile={profile}
                anamnesis={anamnesis}
                loading={anamnesisLoading}
                saving={anamnesisSaving}
                errorMessage={null}
                canEdit
                prompt
                onSave={handleSaveAnamnesis}
                onClosePrompt={() => {
                  setAnamnesisPromptClosed(true);
                  setShowAnamnesisPrompt(false);
                }}
                onDismissPrompt={() => {
                  setAnamnesisPromptClosed(true);
                  setShowAnamnesisPrompt(false);
                }}
              />
            </View>
          </ScrollView>
        </View>
      ) : null}

      {isInsideStudentProfile && !isDesktopLayout ? (
        <View style={styles.bottomNavWrap} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(20, 28, 17, 0.98)', 'rgba(4, 6, 4, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bottomNav}
          >
            {primaryStudentTabs.map((tab) => (
              <StudentBottomTabButton
                key={tab.id}
                tab={tab}
                active={tab.id === 'more' ? showStudentMoreTabs || isStudentTabInMore : studentProfileTab === tab.tab}
                onPress={() => handleStudentBottomTabPress(tab)}
              />
            ))}
          </LinearGradient>
        </View>
      ) : isTrainer && !isDesktopLayout ? (
        <View style={styles.bottomNavWrap} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(20, 28, 17, 0.98)', 'rgba(4, 6, 4, 0.96)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bottomNav}
          >
            {bottomTabs.map((tab) => (
              <BottomTabButton
                key={tab.id}
                tab={tab}
                active={tab.id === 'more' ? showMoreTabs : activeSection === tab.section}
                onPress={() => handleBottomTabPress(tab)}
              />
            ))}
          </LinearGradient>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function RoadmapItem({ title, text, done }: { title: string; text: string; done: boolean }) {
  return (
    <View style={styles.roadmapItem}>
      <View style={[styles.roadmapBullet, done && styles.roadmapBulletDone]}>
        <MaterialCommunityIcons
          name={done ? 'check' : 'circle-outline'}
          size={done ? 14 : 10}
          color={done ? '#061007' : '#9CF02E'}
        />
      </View>
      <View style={styles.roadmapCopy}>
        <Text style={styles.roadmapTitle}>{title}</Text>
        <Text style={styles.roadmapText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030402',
  },
  scrollContent: {
    flexGrow: 1,
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 132,
    gap: 16,
  },
  shellStudentProfile: {
    paddingBottom: 112,
    gap: 14,
  },
  shellDesktop: {
    maxWidth: 1600,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 20,
  },
  anamnesisPromptOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  anamnesisPromptScroll: {
    minHeight: '100%',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 34,
    justifyContent: 'center',
  },
  anamnesisPromptSheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(4, 8, 5, 0.96)',
    padding: 12,
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55)',
  },
  pageStack: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
    boxShadow: '0 12px 32px rgba(156, 240, 46, 0.28)',
  },
  brandName: {
    color: '#F4F8F0',
    fontSize: 16,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.3,
  },
  brandSubline: {
    color: 'rgba(207, 226, 196, 0.62)',
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
    marginTop: 2,
  },
  logoutButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(22, 26, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  logoutText: {
    color: '#EAF8E4',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  heroCard: {
    flex: 1,
    minWidth: 320,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 11, 8, 0.86)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.58)',
    shadowColor: '#000',
    shadowOpacity: 0.58,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  banner: {
    height: 210,
    justifyContent: 'flex-end',
  },
  bannerShade: {
    flex: 1,
  },
  heroContent: {
    marginTop: -58,
    paddingHorizontal: 20,
    paddingBottom: 22,
    gap: 15,
  },
  logoShell: {
    width: 104,
    height: 104,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#111611',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.3)',
    boxShadow: '0 16px 35px rgba(0, 0, 0, 0.44)',
  },
  logoImage: {
    width: 104,
    height: 104,
  },
  heroCopy: {
    gap: 11,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  roleBadgeText: {
    color: '#C9E9B0',
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.7,
  },
  subtitle: {
    maxWidth: 650,
    color: '#C1CABA',
    fontSize: 14,
    lineHeight: 23,
    fontFamily: 'Sora_400Regular',
  },
  commandCard: {
    width: 330,
    minWidth: 300,
    flexGrow: 1,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    justifyContent: 'space-between',
    gap: 16,
    overflow: 'hidden',
  },
  commandEyebrow: {
    color: '#9CF02E',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  commandTitle: {
    color: '#F3F7EF',
    fontSize: 22,
    lineHeight: 29,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  commandText: {
    color: 'rgba(222, 236, 214, 0.76)',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  contactText: {
    color: '#EEF4E7',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    minHeight: 126,
    justifyContent: 'space-between',
    gap: 8,
    padding: 15,
    borderRadius: 22,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  metricValue: {
    color: '#F3F7EF',
    fontSize: 29,
    fontFamily: 'Sora_800ExtraBold',
  },
  metricLabel: {
    color: '#EEF4E7',
    fontSize: 13,
    fontFamily: 'Sora_700Bold',
  },
  metricHelper: {
    color: 'rgba(193, 202, 186, 0.68)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'flex-start',
  },
  desktopWorkspace: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  desktopRail: {
    width: 300,
    gap: 14,
    padding: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(8, 12, 8, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.42)',
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  desktopRailHeader: {
    gap: 8,
    padding: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  desktopRailKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  desktopRailTitle: {
    color: '#F3F7EF',
    fontSize: 20,
    lineHeight: 25,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  desktopRailDescription: {
    color: 'rgba(222, 236, 214, 0.7)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  desktopRailTabs: {
    gap: 10,
  },
  desktopRailButton: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  desktopRailButtonActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    borderColor: 'rgba(156, 240, 46, 0.34)',
  },
  desktopRailButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  desktopRailButtonIconActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  desktopRailButtonCopy: {
    flex: 1,
    gap: 3,
  },
  desktopRailButtonTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  desktopRailButtonTitleActive: {
    color: '#061007',
  },
  desktopRailButtonText: {
    color: 'rgba(222, 236, 214, 0.66)',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Sora_400Regular',
  },
  desktopRailFooter: {
    gap: 7,
    padding: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  desktopRailFooterLabel: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  desktopRailFooterText: {
    color: 'rgba(222, 236, 214, 0.7)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  desktopWorkspaceContent: {
    flex: 1,
    minWidth: 0,
  },
  mainColumn: {
    flex: 1,
    minWidth: 320,
    gap: 14,
  },
  sideColumn: {
    width: 350,
    maxWidth: '100%',
    flexGrow: 1,
    gap: 14,
  },
  pageHero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  pageHeroIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  pageHeroCopy: {
    flex: 1,
    minWidth: 240,
    gap: 6,
  },
  pageKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: '#F3F7EF',
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: 'rgba(222, 236, 214, 0.74)',
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Sora_400Regular',
  },
  panel: {
    gap: 14,
    padding: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  sectionTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.35,
  },
  sectionHint: {
    color: 'rgba(224, 238, 216, 0.58)',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  notificationList: {
    gap: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  notificationItemCopy: {
    flex: 1,
    gap: 3,
  },
  notificationItemTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  notificationItemText: {
    color: 'rgba(222, 236, 214, 0.66)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  notificationItemBadge: {
    minWidth: 32,
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
  },
  notificationItemBadgeText: {
    color: '#9CF02E',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  paymentSummaryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  paymentSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  paymentSummaryCopy: {
    flex: 1,
    gap: 3,
  },
  paymentSummaryStatus: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paymentSummaryValue: {
    color: '#F3F7EF',
    fontSize: 24,
    fontFamily: 'Sora_800ExtraBold',
  },
  paymentSummaryText: {
    color: 'rgba(222, 236, 214, 0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  paymentSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentSummaryItem: {
    flexGrow: 1,
    flexBasis: 92,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  paymentSummaryItemLabel: {
    color: 'rgba(222, 236, 214, 0.62)',
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  paymentSummaryItemValue: {
    color: '#F3F7EF',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  paymentPreviewCard: {
    gap: 6,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  paymentPreviewLabel: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paymentPreviewValue: {
    color: '#F3F7EF',
    fontSize: 18,
    fontFamily: 'Sora_800ExtraBold',
  },
  paymentPreviewText: {
    color: 'rgba(222, 236, 214, 0.74)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  paymentPreviewHint: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: 250,
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  quickActionActive: {
    borderColor: 'rgba(156, 240, 46, 0.42)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  quickIconActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  quickCopy: {
    flex: 1,
    gap: 4,
  },
  quickTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  quickDescription: {
    color: 'rgba(193, 202, 186, 0.68)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  studentsList: {
    gap: 10,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  studentAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
  },
  studentInitial: {
    color: '#DFFFBA',
    fontSize: 16,
    fontFamily: 'Sora_800ExtraBold',
  },
  studentBody: {
    flex: 1,
    gap: 7,
  },
  studentHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  studentName: {
    color: '#F3F7EF',
    fontSize: 15,
    fontFamily: 'Sora_800ExtraBold',
  },
  studentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
  },
  studentStatusText: {
    color: '#9CF02E',
    fontSize: 9,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  studentGoal: {
    color: 'rgba(222, 236, 214, 0.72)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  studentFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  studentMetaText: {
    color: 'rgba(224, 238, 216, 0.68)',
    fontSize: 10,
    fontFamily: 'Sora_600SemiBold',
  },
  studentRightRail: {
    alignItems: 'center',
    gap: 8,
  },
  notificationBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  notificationBadgeText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  noNotificationBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  openStudent: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  studentProfileHero: {
    gap: 14,
    padding: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  notificationPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  notificationPillText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 78,
    height: 78,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
  },
  profileInitials: {
    color: '#DFFFBA',
    fontSize: 22,
    fontFamily: 'Sora_800ExtraBold',
  },
  profileCopy: {
    flex: 1,
    gap: 5,
  },
  profileMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  profileContextIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  profileContextCopy: {
    flex: 1,
    gap: 4,
  },
  profileContextTitle: {
    color: '#F3F7EF',
    fontSize: 16,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.25,
  },
  profileContextText: {
    color: 'rgba(222, 236, 214, 0.64)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  profileTabPanel: {
    gap: 12,
  },
  profileTabStack: {
    gap: 14,
  },
  planPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  planPreviewCard: {
    flexGrow: 1,
    flexBasis: 260,
    gap: 10,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 12, 8, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  planPreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planPreviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  planPreviewEyebrow: {
    flex: 1,
    color: '#DFFFBA',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  planPreviewTitle: {
    color: '#F3F7EF',
    fontSize: 16,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.25,
  },
  planPreviewSubtitle: {
    color: 'rgba(222, 236, 214, 0.7)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  planPreviewStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planPreviewStatPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  planPreviewStatText: {
    color: '#DFFFBA',
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
  },
  planPreviewNotes: {
    gap: 8,
  },
  planPreviewNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  planPreviewDot: {
    width: 6,
    height: 6,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  planPreviewNoteText: {
    flex: 1,
    color: 'rgba(222, 236, 214, 0.66)',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  planPreviewButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  planPreviewButtonText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoTile: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  infoTileCopy: {
    flex: 1,
    gap: 3,
  },
  infoTileValue: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  infoTileLabel: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 10,
    fontFamily: 'Sora_500Medium',
  },
  notePanel: {
    gap: 6,
    padding: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  noteTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  noteText: {
    color: 'rgba(222, 236, 214, 0.72)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  summaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  summaryAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  summaryActionText: {
    color: '#DFFFBA',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  studentModule: {
    gap: 12,
  },
  moduleHero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  moduleHeroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  placeholderIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  placeholderTitle: {
    color: '#F3F7EF',
    fontSize: 19,
    fontFamily: 'Sora_800ExtraBold',
  },
  placeholderText: {
    maxWidth: 520,
    color: 'rgba(222, 236, 214, 0.72)',
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Sora_400Regular',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    flexGrow: 1,
    flexBasis: 230,
    minHeight: 150,
    gap: 10,
    padding: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  moduleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  moduleCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  moduleTag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  moduleTagText: {
    color: '#9CF02E',
    fontSize: 9,
    fontFamily: 'Sora_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  moduleCardTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_800ExtraBold',
  },
  moduleCardText: {
    color: 'rgba(222, 236, 214, 0.64)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  relatedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  relatedAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  relatedActionText: {
    color: '#DFFFBA',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  placeholderPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  placeholderPillText: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  miniMetric: {
    flexGrow: 1,
    flexBasis: 128,
    gap: 5,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  miniMetricValue: {
    color: '#F3F7EF',
    fontSize: 15,
    fontFamily: 'Sora_800ExtraBold',
  },
  miniMetricLabel: {
    color: 'rgba(222, 236, 214, 0.58)',
    fontSize: 10,
    fontFamily: 'Sora_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  emptyTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
  },
  emptyText: {
    maxWidth: 420,
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
  },
  loadingPanel: {
    minHeight: 200,
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
  sidePanel: {
    gap: 13,
    padding: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 12, 8, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  roadmapList: {
    gap: 13,
  },
  roadmapItem: {
    flexDirection: 'row',
    gap: 11,
  },
  roadmapBullet: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    marginTop: 2,
  },
  roadmapBulletDone: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  roadmapCopy: {
    flex: 1,
    gap: 4,
  },
  roadmapTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  roadmapText: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#9CF02E',
    boxShadow: '0 16px 36px rgba(156, 240, 46, 0.28)',
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  secondaryButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryButtonText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontFamily: 'Sora_800ExtraBold',
  },
  primarySmallButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  primarySmallButtonText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  smallGhostButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  smallGhostButtonText: {
    color: '#9CF02E',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
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
  formLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  formScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  formSheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  formSheet: {
    width: '100%',
    maxWidth: 820,
    maxHeight: 760,
    gap: 14,
    padding: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.68)',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  formHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  formTitle: {
    color: '#F3F7EF',
    fontSize: 21,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  formSubtitle: {
    color: 'rgba(222, 236, 214, 0.64)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  formContent: {
    gap: 12,
    paddingBottom: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldWrap: {
    flex: 1,
    gap: 7,
  },
  fieldLabel: {
    color: '#EAF8E4',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  input: {
    minHeight: 50,
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_500Medium',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  inputDisabled: {
    opacity: 0.62,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  twoColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentOption: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentOptionActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  segmentText: {
    color: '#DCF4C8',
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
  },
  segmentTextActive: {
    color: '#061007',
  },
  formMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    zIndex: 20,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bottomNav: {
    width: '100%',
    maxWidth: 620,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    boxShadow: '0 20px 46px rgba(0, 0, 0, 0.62)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  bottomTab: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 24,
  },
  bottomTabActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  bottomTabIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIconActive: {
    backgroundColor: '#9CF02E',
    boxShadow: '0 10px 24px rgba(156, 240, 46, 0.26)',
  },
  bottomTabText: {
    color: 'rgba(220, 244, 200, 0.72)',
    fontSize: 9,
    fontFamily: 'Sora_700Bold',
  },
  bottomTabTextActive: {
    color: '#F3F7EF',
  },
  bottomTabIndicator: {
    width: 18,
    height: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  bottomTabIndicatorActive: {
    backgroundColor: '#9CF02E',
    opacity: 1,
  },
  bottomTabIndicatorInactive: {
    backgroundColor: 'rgba(220, 244, 200, 0.12)',
    opacity: 0.8,
  },
  moreLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 18,
  },
  moreScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
  },
  moreSheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 94,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  moreSheet: {
    width: '100%',
    maxWidth: 720,
    maxHeight: 520,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.68)',
  },
  moreHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(220, 244, 200, 0.28)',
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  moreHeaderCopy: {
    flex: 1,
    gap: 3,
    paddingRight: 12,
  },
  moreKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  moreTitle: {
    color: '#F3F7EF',
    fontSize: 20,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  moreSubtitle: {
    color: 'rgba(222, 236, 214, 0.68)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Sora_400Regular',
  },
  moreClose: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  moreTabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  moreTab: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  moreTabActive: {
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    borderColor: 'rgba(156, 240, 46, 0.36)',
  },
  moreTabIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  moreTabIconActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  moreTabCopy: {
    flex: 1,
    gap: 4,
  },
  moreTabTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_800ExtraBold',
  },
  moreTabText: {
    color: 'rgba(222, 236, 214, 0.66)',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Sora_400Regular',
  },
  pressed: {
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.7,
  },
});

