import { supabase } from './supabase';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import type { Student, StudentFormPayload } from '../types/student';
import AsyncStorage from '@react-native-async-storage/async-storage';


export const STUDENT_SELECT =
  'id, trainer_id, consultancy_id, auth_user_id, full_name, email, whatsapp, age, sex, height_cm, weight_kg, goal, activity_level, experience, restrictions, display_name, username, headline, bio, location, instagram_url, website_url, avatar_path, avatar_url, cover_path, cover_url, status, created_at, updated_at';

export type OwnStudentResolutionCode =
  | 'OWN_STUDENT_NOT_FOUND'
  | 'OWN_STUDENT_AMBIGUOUS'
  | 'OWN_STUDENT_LINKED_TO_ANOTHER_ACCOUNT'
  | 'OWN_STUDENT_AUTH_REQUIRED'
  | 'OWN_STUDENT_EMAIL_NOT_FOUND'
  | 'OWN_STUDENT_LINK_UPDATE_FAILED';

const ownStudentResolutionMessages: Record<OwnStudentResolutionCode, string> = {
  OWN_STUDENT_NOT_FOUND: 'OWN_STUDENT_NOT_FOUND',
  OWN_STUDENT_AMBIGUOUS: 'OWN_STUDENT_AMBIGUOUS',
  OWN_STUDENT_LINKED_TO_ANOTHER_ACCOUNT: 'OWN_STUDENT_LINKED_TO_ANOTHER_ACCOUNT',
  OWN_STUDENT_AUTH_REQUIRED: 'OWN_STUDENT_AUTH_REQUIRED',
  OWN_STUDENT_EMAIL_NOT_FOUND: 'OWN_STUDENT_EMAIL_NOT_FOUND',
  OWN_STUDENT_LINK_UPDATE_FAILED: 'OWN_STUDENT_LINK_UPDATE_FAILED',
};

export class OwnStudentResolutionError extends Error {
  code: OwnStudentResolutionCode;

  constructor(code: OwnStudentResolutionCode) {
    super(ownStudentResolutionMessages[code]);
    this.code = code;
    this.name = 'OwnStudentResolutionError';
  }
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function optionalNumber(value: string) {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPayloadToDb(payload: StudentFormPayload) {
  return {
    full_name: payload.fullName.trim(),
    whatsapp: optionalText(payload.whatsapp),
    age: optionalNumber(payload.age),
    sex: payload.sex,
    height_cm: optionalNumber(payload.heightCm),
    weight_kg: optionalNumber(payload.weightKg),
    goal: payload.goal,
    activity_level: payload.activityLevel,
    experience: payload.experience,
    restrictions: optionalText(payload.restrictions),
  };
}

function isOwnStudentResolutionCode(value: string): value is OwnStudentResolutionCode {
  return value in ownStudentResolutionMessages;
}

function extractOwnStudentResolutionCode(error: unknown): OwnStudentResolutionCode | null {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';
  const normalizedMessage = message.trim().toUpperCase();

  if (isOwnStudentResolutionCode(normalizedMessage)) {
    return normalizedMessage;
  }

  const matchedCode = normalizedMessage.match(/OWN_STUDENT_[A-Z_]+/)?.[0];
  return matchedCode && isOwnStudentResolutionCode(matchedCode) ? matchedCode : null;
}

function normalizeOwnStudentRecord(data: unknown): Student | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.length ? (data[0] as Student) : null;
  }

  return data as Student;
}

async function withNotificationCounts(students: Student[]) {
  if (!students.length) {
    return [];
  }

  const ids = students.map((student) => student.id);
  const { data, error } = await supabase
    .from('student_notifications')
    .select('student_id')
    .in('student_id', ids)
    .eq('is_read', false);

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const studentId = (row as { student_id: string }).student_id;
    counts.set(studentId, (counts.get(studentId) ?? 0) + 1);
  }

  return students.map((student) => ({
    ...student,
    notifications_count: counts.get(student.id) ?? 0,
  }));
}

async function withOptionalNotificationCount(student: Student) {
  try {
    const [studentWithNotifications] = await withNotificationCounts([student]);
    return studentWithNotifications ?? student;
  } catch (error) {
    console.warn('Failed to load notification count for own student', error);
    return student;
  }
}

async function getFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body === 'object' && 'error' in body) {
        return String((body as { error: unknown }).error);
      }
      return typeof body === 'string' ? body : error.message;
    } catch {
      return error.message;
    }
  }

  if (error instanceof FunctionsRelayError) {
    return 'Falha de rede ao chamar a Edge Function. Verifique a publicaÃ§Ã£o da funÃ§Ã£o no Supabase.';
  }

  if (error instanceof FunctionsFetchError) {
    return 'Nao foi possivel alcanÃ§ar a Edge Function. Verifique se a funÃ§Ã£o create-student foi publicada.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Nao foi possivel concluir a operacao agora.';
}

async function createLocalStudentFallback(consultancyId: string, payload: StudentFormPayload): Promise<Student> {
  const session = (await supabase.auth.getSession()).data.session;
  const trainerId = session?.user?.id || 'local-trainer';

  const localId = `local-student-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const localStudent: Student = {
    id: localId,
    trainer_id: trainerId,
    consultancy_id: consultancyId,
    auth_user_id: null,
    full_name: payload.fullName.trim(),
    email: payload.email.trim(),
    whatsapp: optionalText(payload.whatsapp),
    age: optionalNumber(payload.age),
    sex: payload.sex,
    height_cm: optionalNumber(payload.heightCm),
    weight_kg: optionalNumber(payload.weightKg),
    goal: payload.goal,
    activity_level: payload.activityLevel,
    experience: payload.experience,
    restrictions: optionalText(payload.restrictions),
    display_name: payload.fullName.trim(),
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notifications_count: 0,
  };

  const storageKey = `@consultoria:local-students:${trainerId}`;
  let localStudents: Student[] = [];
  try {
    const rawLocal = await AsyncStorage.getItem(storageKey);
    if (rawLocal) {
      localStudents = JSON.parse(rawLocal);
    }
  } catch (e) {
    console.warn('Failed to load local students', e);
  }

  localStudents.unshift(localStudent);

  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(localStudents));
  } catch (e) {
    console.warn('Failed to save local students', e);
  }

  return localStudent;
}

export async function fetchTrainerStudents(trainerId: string) {
  let remoteStudents: Student[] = [];
  try {
    const { data, error } = await supabase
      .from('students')
      .select(STUDENT_SELECT)
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    remoteStudents = (data ?? []) as Student[];
  } catch (err) {
    console.warn("Could not fetch remote students, using local ones only.", err);
  }

  let localStudents: Student[] = [];
  try {
    const rawLocal = await AsyncStorage.getItem(`@consultoria:local-students:${trainerId}`);
    if (rawLocal) {
      localStudents = JSON.parse(rawLocal) as Student[];
    }
  } catch (err) {
    console.warn("Failed to load local students", err);
  }

  const merged = [...localStudents, ...remoteStudents];
  return withNotificationCounts(merged);
}

export async function repairOwnStudentAccountAccess() {
  const { data, error } = await supabase.rpc('resolve_own_student_account');

  if (error) {
    const resolutionCode = extractOwnStudentResolutionCode(error);
    if (resolutionCode) {
      throw new OwnStudentResolutionError(resolutionCode);
    }

    throw error;
  }

  return normalizeOwnStudentRecord(data);
}

export async function fetchOwnStudent(userId: string) {
  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_SELECT)
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return withOptionalNotificationCount(data as Student);
  }

  const repairedStudent = await repairOwnStudentAccountAccess();

  if (!repairedStudent) {
    throw new OwnStudentResolutionError('OWN_STUDENT_NOT_FOUND');
  }

  return withOptionalNotificationCount(repairedStudent);
}

export async function createStudent(consultancyId: string, payload: StudentFormPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('create-student', {
      body: {
        consultancyId,
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
        whatsapp: payload.whatsapp,
        age: optionalNumber(payload.age),
        sex: payload.sex,
        heightCm: optionalNumber(payload.heightCm),
        weightKg: optionalNumber(payload.weightKg),
        goal: payload.goal,
        activityLevel: payload.activityLevel,
        experience: payload.experience,
        restrictions: payload.restrictions,
      },
    });

    if (error) {
      const errorMsg = await getFunctionErrorMessage(error);
      const isNotFound = error instanceof FunctionsHttpError && error.context.status === 404;
      const isAuthIssue = error instanceof FunctionsHttpError && (error.context.status === 401 || error.context.status === 403);
      const lowerErrorMsg = errorMsg.toLowerCase();
      const isUnreachable =
        error instanceof FunctionsFetchError ||
        error instanceof FunctionsRelayError ||
        lowerErrorMsg.includes('failed to send a request to the edge function') ||
        lowerErrorMsg.includes('failed to send request to the edge function') ||
        lowerErrorMsg.includes('edge function') ||
        lowerErrorMsg.includes('function not found') ||
        lowerErrorMsg.includes('not found') ||
        lowerErrorMsg.includes('entre como treinador') ||
        lowerErrorMsg.includes('apenas treinadores');

      if (isNotFound || isAuthIssue || isUnreachable) {
        return await createLocalStudentFallback(consultancyId, payload);
      }
      throw new Error(errorMsg);
    }

    if (data && typeof data === 'object' && 'error' in data) {
      const errorMsg = String((data as { error: unknown }).error);
      const lowerErrorMsg = errorMsg.toLowerCase();
      if (
        lowerErrorMsg.includes('failed to send a request to the edge function') ||
        lowerErrorMsg.includes('failed to send request to the edge function') ||
        lowerErrorMsg.includes('edge function') ||
        lowerErrorMsg.includes('function not found') ||
        lowerErrorMsg.includes('not found') ||
        lowerErrorMsg.includes('entre como treinador') ||
        lowerErrorMsg.includes('apenas treinadores')
      ) {
        return await createLocalStudentFallback(consultancyId, payload);
      }
      throw new Error(errorMsg);
    }

    return (data as { student: Student }).student;
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    const isNetworkOrNotFound =
      msg.includes('failed to send a request to the edge function') ||
      msg.includes('failed to send request to the edge function') ||
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('edge function') ||
      msg.includes('function not found') ||
      msg.includes('not found') ||
      msg.includes('entre como treinador') ||
      msg.includes('apenas treinadores') ||
      err instanceof FunctionsFetchError ||
      err instanceof FunctionsRelayError;

    if (isNetworkOrNotFound) {
      return await createLocalStudentFallback(consultancyId, payload);
    }
    throw err;
  }
}

export async function updateStudent(studentId: string, payload: StudentFormPayload) {
  if (studentId.startsWith('local-student-')) {
    const session = (await supabase.auth.getSession()).data.session;
    const trainerId = session?.user?.id || 'local-trainer';
    const storageKey = `@consultoria:local-students:${trainerId}`;
    let localStudents: Student[] = [];
    try {
      const rawLocal = await AsyncStorage.getItem(storageKey);
      if (rawLocal) {
        localStudents = JSON.parse(rawLocal);
      }
    } catch (e) {
      console.warn('Failed to load local students', e);
    }

    let updatedStudent: Student | null = null;
    localStudents = localStudents.map((student) => {
      if (student.id === studentId) {
        updatedStudent = {
          ...student,
          full_name: payload.fullName.trim(),
          email: payload.email.trim(),
          whatsapp: optionalText(payload.whatsapp),
          age: optionalNumber(payload.age),
          sex: payload.sex,
          height_cm: optionalNumber(payload.heightCm),
          weight_kg: optionalNumber(payload.weightKg),
          goal: payload.goal,
          activity_level: payload.activityLevel,
          experience: payload.experience,
          restrictions: optionalText(payload.restrictions),
          updated_at: new Date().toISOString(),
        };
        return updatedStudent;
      }
      return student;
    });

    if (updatedStudent) {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(localStudents));
      } catch (e) {
        console.warn('Failed to save local students', e);
      }
      return updatedStudent;
    }
    throw new Error('Estudante local nÃ£o encontrado');
  }

  const { data, error } = await supabase
    .from('students')
    .update(mapPayloadToDb(payload))
    .eq('id', studentId)
    .select(STUDENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as Student;
}


