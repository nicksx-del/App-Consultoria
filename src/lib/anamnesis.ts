import { supabase } from './supabase';
import { activityLevelLabels, goalLabels, sexLabels } from './studentCalculations';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '../types/auth';
import type {
  AnamnesisAnswers,
  AnamnesisProgress,
  AnamnesisSection,
  SaveAnamnesisPayload,
  StudentAnamnesis,
} from '../types/anamnesis';
import type { Student } from '../types/student';

const ANAMNESIS_SELECT =
  'id, student_id, trainer_id, consultancy_id, status, answers, dismissed_at, completed_at, created_at, updated_at';

export const anamnesisSections: AnamnesisSection[] = [
  {
    id: 'personal',
    title: 'Dados pessoais',
    description: 'Base inicial para calculos, objetivo e individualizacao do plano.',
    questions: [
      { id: 'full_name', label: 'Nome completo', placeholder: 'Como voce prefere ser chamado?' },
      { id: 'age', label: 'Idade (anos)', placeholder: '18', keyboardType: 'number-pad' },
      { id: 'current_weight', label: 'Peso atual (kg)', placeholder: '65', keyboardType: 'decimal-pad' },
      { id: 'height_cm', label: 'Altura (cm)', placeholder: '180', keyboardType: 'number-pad' },
      { id: 'biological_sex', label: 'Sexo biologico', placeholder: 'Masculino, feminino ou outro' },
      { id: 'main_goal', label: 'Qual e seu objetivo principal?', placeholder: 'Hipertrofia, perda de gordura, saude...' },
    ],
  },
  {
    id: 'routine',
    title: 'Rotina diaria',
    description: 'Horarios, trabalho, estudo e gasto de energia fora do treino.',
    questions: [
      { id: 'wake_time', label: 'Que horas voce acorda?', placeholder: 'Ex.: 06:30' },
      { id: 'sleep_time', label: 'Que horas voce dorme?', placeholder: 'Ex.: 23:00' },
      { id: 'works', label: 'Voce trabalha?', placeholder: 'Sim/nao e funcao' },
      { id: 'work_hours', label: 'Quantas horas por dia voce trabalha?', placeholder: 'Ex.: 8 horas' },
      { id: 'work_type', label: 'Seu trabalho e sentado, em pe, andando ou pesado?', placeholder: 'Descreva o nivel de movimento' },
      { id: 'study_hours', label: 'Voce estuda? Quantas horas por dia?', placeholder: 'Ex.: faculdade 4h/noite' },
      { id: 'commute', label: 'Como vai ao trabalho/escola?', placeholder: 'Carro, a pe, bike, onibus...' },
      { id: 'domestic_tasks', label: 'Faz tarefas domesticas?', placeholder: 'Lavar, cozinhar, limpar, cuidar de alguem...', multiline: true },
    ],
  },
  {
    id: 'training',
    title: 'Atividade fisica',
    description: 'Historico, disponibilidade, cardio e esportes.',
    questions: [
      { id: 'trains', label: 'Voce treina atualmente?', placeholder: 'Sim/nao' },
      { id: 'training_type', label: 'Tipo de treino', placeholder: 'Musculacao, funcional, crossfit...' },
      { id: 'training_frequency', label: 'Quantas vezes por semana voce treina?', placeholder: 'Ex.: 5x/semana' },
      { id: 'training_duration', label: 'Duracao media de cada treino', placeholder: 'Ex.: 60 minutos' },
      { id: 'cardio_routine', label: 'Faz cardio separado?', placeholder: 'Qual, quantas vezes/semana e duracao', multiline: true },
      { id: 'sports', label: 'Pratica algum esporte?', placeholder: 'Qual e quantas vezes/semana' },
    ],
  },
  {
    id: 'health',
    title: 'Saude',
    description: 'Pontos de atencao para seguranca, recuperacao e aderencia.',
    questions: [
      { id: 'diagnosed_conditions', label: 'Tem alguma doenca diagnosticada?', placeholder: 'Ex.: hipertensao, diabetes, ansiedade...', multiline: true },
      { id: 'medications', label: 'Usa medicamentos?', placeholder: 'Quais e dose, se souber', multiline: true },
      { id: 'injuries', label: 'Tem lesoes ou limitacoes fisicas?', placeholder: 'Ombro, joelho, lombar, cirurgia...', multiline: true },
      { id: 'water_liters', label: 'Quantos litros de agua bebe por dia?', placeholder: 'Ex.: 2,5L', keyboardType: 'decimal-pad' },
      { id: 'sleep_hours', label: 'Quantas horas de sono por noite?', placeholder: 'Ex.: 7h' },
      { id: 'stress_level', label: 'Nivel de estresse diario (1 a 10)', placeholder: 'Ex.: 6', keyboardType: 'number-pad' },
    ],
  },
  {
    id: 'nutrition',
    title: 'Alimentacao',
    description: 'Preferencias, restricoes e recursos para montar uma dieta possivel.',
    questions: [
      { id: 'meals_per_day', label: 'Quantas refeicoes faz por dia?', placeholder: 'Ex.: 4 refeicoes' },
      { id: 'food_restrictions', label: 'Tem restricoes alimentares ou alergias?', placeholder: 'Lactose, gluten, vegetariano...', multiline: true },
      { id: 'supplements', label: 'Usa suplementos?', placeholder: 'Whey, creatina, cafeina...', multiline: true },
    ],
  },
  {
    id: 'notes',
    title: 'Observacoes',
    description: 'Informacoes livres que ajudam o coach a entender o contexto real.',
    questions: [
      { id: 'extra_notes', label: 'Algo mais que queira compartilhar com o coach?', placeholder: 'Rotina dificil, medos, preferencias, historico...', multiline: true },
    ],
  },
];

export const anamnesisQuestions = anamnesisSections.flatMap((section) => section.questions);

function normalizeAnswers(value: unknown): AnamnesisAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<AnamnesisAnswers>((answers, [key, item]) => {
    answers[key] = typeof item === 'string' ? item : item == null ? '' : String(item);
    return answers;
  }, {});
}

function mapAnamnesisRow(row: any): StudentAnamnesis {
  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    status: row.status === 'completed' ? 'completed' : 'draft',
    answers: normalizeAnswers(row.answers),
    dismissedAt: row.dismissed_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAnamnesisProgress(answers: AnamnesisAnswers): AnamnesisProgress {
  const total = anamnesisQuestions.length;
  const answered = anamnesisQuestions.filter((question) => answers[question.id]?.trim()).length;

  return {
    answered,
    total,
    percent: total ? Math.round((answered / total) * 100) : 0,
    completed: total > 0 && answered >= total,
  };
}

export function createPrefilledAnamnesisAnswers(student: Student, answers: AnamnesisAnswers = {}): AnamnesisAnswers {
  const prefilled: AnamnesisAnswers = {
    full_name: student.full_name,
    age: student.age ? String(student.age) : '',
    current_weight: student.weight_kg ? String(student.weight_kg) : '',
    height_cm: student.height_cm ? String(student.height_cm) : '',
    biological_sex: student.sex ? sexLabels[student.sex] : '',
    main_goal: goalLabels[student.goal],
    training_type: student.experience ? `Experiencia: ${student.experience}` : '',
    training_frequency: '',
    diagnosed_conditions: '',
    injuries: student.restrictions ?? '',
    stress_level: '',
    meals_per_day: '',
    food_restrictions: '',
    supplements: '',
    extra_notes: '',
    activity_level: activityLevelLabels[student.activity_level],
  };

  return {
    ...prefilled,
    ...answers,
  };
}

export function createLocalStudentAnamnesis(student: Student, payload: SaveAnamnesisPayload): StudentAnamnesis {
  const now = new Date().toISOString();

  return {
    id: `local-anamnesis-${student.id}`,
    studentId: student.id,
    trainerId: student.trainer_id,
    consultancyId: student.consultancy_id,
    status: payload.status,
    answers: payload.answers,
    dismissedAt: payload.dismissedAt,
    completedAt: payload.completedAt,
    createdAt: now,
    updatedAt: now,
  };
}

export async function fetchStudentAnamnesis(student: Student) {
  if (student.id.startsWith('local-student-')) {
    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-anamnesis:${student.id}`);
      return raw ? JSON.parse(raw) as StudentAnamnesis : null;
    } catch (e) {
      console.warn('Failed to load local anamnesis', e);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('student_anamneses')
    .select(ANAMNESIS_SELECT)
    .eq('student_id', student.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAnamnesisRow(data) : null;
}

export async function saveStudentAnamnesis({
  student,
  profile,
  anamnesis,
  payload,
}: {
  student: Student;
  profile: Profile;
  anamnesis: StudentAnamnesis | null;
  payload: SaveAnamnesisPayload;
}) {
  if (student.id.startsWith('local-student-') || anamnesis?.id?.startsWith('local-anamnesis-')) {
    try {
      const localAnamnesis = createLocalStudentAnamnesis(student, payload);
      await AsyncStorage.setItem(`@consultoria:local-anamnesis:${student.id}`, JSON.stringify(localAnamnesis));
      return localAnamnesis;
    } catch (e) {
      console.warn('Failed to save local anamnesis', e);
      return createLocalStudentAnamnesis(student, payload);
    }
  }

  if (anamnesis?.id && !anamnesis.id.startsWith('local-anamnesis-')) {
    const { data, error } = await supabase
      .from('student_anamneses')
      .update({
        answers: payload.answers,
        status: payload.status,
        dismissed_at: payload.dismissedAt,
        completed_at: payload.completedAt,
      })
      .eq('id', anamnesis.id)
      .select(ANAMNESIS_SELECT)
      .single();

    if (error) {
      throw error;
    }

    return mapAnamnesisRow(data);
  }

  const { data, error } = await supabase
    .from('student_anamneses')
    .insert({
      student_id: student.id,
      trainer_id: student.trainer_id,
      consultancy_id: student.consultancy_id,
      status: payload.status,
      answers: payload.answers,
      dismissed_at: payload.dismissedAt,
      completed_at: payload.completedAt,
      created_by: profile.id,
    })
    .select(ANAMNESIS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapAnamnesisRow(data);
}
