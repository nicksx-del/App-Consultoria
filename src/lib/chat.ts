import { supabase } from './supabase';
import type { Profile } from '../types/auth';
import type { Student } from '../types/student';
import type { ChatMessage, ChatMessageType, SendChatMessagePayload } from '../types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';


const CHAT_MEDIA_BUCKET = 'chat-media';
const CHAT_MESSAGE_SELECT =
  'id, student_id, trainer_id, consultancy_id, sender_id, sender_role, message_type, body, media_path, media_mime_type, media_size, audio_duration_seconds, reply_to_message_id, is_starred, created_at';

function getExtensionFromMime(mimeType: string | null | undefined, fallback: string) {
  if (!mimeType) {
    return fallback;
  }

  const subtype = mimeType.split('/')[1]?.split(';')[0]?.split('+')[0];

  if (!subtype) {
    return fallback;
  }

  if (subtype === 'jpeg') {
    return 'jpg';
  }

  if (subtype === 'mpeg') {
    return 'mp3';
  }

  return subtype;
}

function getImageMimeType(assetMime?: string | null) {
  if (assetMime === 'image/png' || assetMime === 'image/webp' || assetMime === 'image/gif') {
    return assetMime;
  }

  return 'image/jpeg';
}

function getAudioMimeType(mimeType?: string | null) {
  if (mimeType?.startsWith('audio/')) {
    return mimeType;
  }

  return 'audio/m4a';
}

function senderRole(profile: Profile) {
  return profile.role === 'student' ? 'student' : 'trainer';
}

function mediaFolder(student: Student, profile: Profile) {
  return `${student.id}/${profile.id}`;
}

async function createSignedUrl(path: string | null) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

async function mapChatRow(row: any): Promise<ChatMessage> {
  const mediaPath = row.media_path as string | null;

  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    consultancyId: row.consultancy_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    messageType: row.message_type,
    body: row.body,
    mediaPath,
    mediaUrl: await createSignedUrl(mediaPath),
    mediaMimeType: row.media_mime_type,
    mediaSize: row.media_size,
    audioDurationSeconds: row.audio_duration_seconds,
    replyToMessageId: row.reply_to_message_id,
    isStarred: Boolean(row.is_starred),
    createdAt: row.created_at,
  };
}

async function uploadMedia({
  student,
  profile,
  uri,
  mimeType,
  kind,
}: {
  student: Student;
  profile: Profile;
  uri: string;
  mimeType: string;
  kind: 'image' | 'audio' | 'sticker';
}) {
  const response = await fetch(uri);
  const fileBody = await response.arrayBuffer();
  const extension = getExtensionFromMime(mimeType, kind === 'image' ? 'jpg' : 'm4a');
  const filePath = `${mediaFolder(student, profile)}/${kind}-${Date.now()}.${extension}`;

  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(filePath, fileBody, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return {
    path: data.path,
    size: fileBody.byteLength,
  };
}

export async function fetchStudentChatMessages(student: Student) {
  if (student.id.startsWith('local-student-')) {
    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-chat:${student.id}`);
      return raw ? JSON.parse(raw) as ChatMessage[] : [];
    } catch (e) {
      console.warn('Failed to load local chat messages', e);
      return [];
    }
  }

  const { data, error } = await supabase
    .from('student_chat_messages')
    .select(CHAT_MESSAGE_SELECT)
    .eq('student_id', student.id)
    .order('created_at', { ascending: true })
    .limit(80);

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map(mapChatRow));
}

export async function sendStudentChatMessage({
  student,
  profile,
  payload,
}: {
  student: Student;
  profile: Profile;
  payload: SendChatMessagePayload;
}) {
  if (student.id.startsWith('local-student-')) {
    const message: ChatMessage = {
      id: `local-msg-${Date.now()}`,
      studentId: student.id,
      trainerId: student.trainer_id,
      consultancyId: student.consultancy_id,
      senderId: profile.id,
      senderRole: senderRole(profile),
      messageType: payload.type,
      body: payload.type === 'text' ? payload.body : null,
      mediaPath: null,
      mediaUrl: null,
      mediaMimeType: null,
      mediaSize: null,
      audioDurationSeconds: null,
      replyToMessageId: payload.replyToMessageId ?? null,
      isStarred: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-chat:${student.id}`);
      const messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
      messages.push(message);
      await AsyncStorage.setItem(`@consultoria:local-chat:${student.id}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save local chat message', e);
    }

    return message;
  }

  const messageType: ChatMessageType = payload.type;
  let body: string | null = null;
  let mediaPath: string | null = null;
  let mediaMimeType: string | null = null;
  let mediaSize: number | null = null;
  let audioDurationSeconds: number | null = null;

  if (payload.type === 'text') {
    body = payload.body.trim();
  }

  if (payload.type === 'sticker') {
    body = payload.body?.trim() ?? null;
  }

  if (payload.type === 'image' || payload.type === 'sticker') {
    body = payload.body?.trim() ?? null;
  }

  if (payload.type === 'text' && !body) {
    throw new Error('Escreva uma mensagem antes de enviar.');
  }

  if (payload.type === 'sticker' && !body && !payload.asset) {
    throw new Error('Escolha uma figurinha antes de enviar.');
  }

  if (payload.type === 'image') {
    mediaMimeType = getImageMimeType(payload.asset.mimeType);
    const media = await uploadMedia({
      student,
      profile,
      uri: payload.asset.uri,
      mimeType: mediaMimeType,
      kind: 'image',
    });
    mediaPath = media.path;
    mediaSize = media.size;
  }

  if (payload.type === 'sticker' && payload.asset) {
    mediaMimeType = getImageMimeType(payload.asset.mimeType);
    const media = await uploadMedia({
      student,
      profile,
      uri: payload.asset.uri,
      mimeType: mediaMimeType,
      kind: 'sticker',
    });
    mediaPath = media.path;
    mediaSize = media.size;
  }

  if (payload.type === 'audio') {
    mediaMimeType = getAudioMimeType(payload.mimeType);
    const media = await uploadMedia({
      student,
      profile,
      uri: payload.uri,
      mimeType: mediaMimeType,
      kind: 'audio',
    });
    mediaPath = media.path;
    mediaSize = media.size;
    audioDurationSeconds = payload.durationSeconds ? Math.round(payload.durationSeconds) : null;
  }

  const { data, error } = await supabase
    .from('student_chat_messages')
    .insert({
      student_id: student.id,
      trainer_id: student.trainer_id,
      consultancy_id: student.consultancy_id,
      sender_id: profile.id,
      sender_role: senderRole(profile),
      message_type: messageType,
      body,
      media_path: mediaPath,
      media_mime_type: mediaMimeType,
      media_size: mediaSize,
      audio_duration_seconds: audioDurationSeconds,
      reply_to_message_id: payload.replyToMessageId ?? null,
    })
    .select(CHAT_MESSAGE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapChatRow(data);
}

export async function toggleStudentChatMessageStar(message: ChatMessage) {
  if (message.studentId.startsWith('local-student-')) {
    try {
      const raw = await AsyncStorage.getItem(`@consultoria:local-chat:${message.studentId}`);
      let messages: ChatMessage[] = raw ? JSON.parse(raw) : [];
      const updated = { ...message, isStarred: !message.isStarred };
      messages = messages.map(msg => msg.id === message.id ? updated : msg);
      await AsyncStorage.setItem(`@consultoria:local-chat:${message.studentId}`, JSON.stringify(messages));
      return updated;
    } catch (e) {
      console.warn('Failed to star local message', e);
      return message;
    }
  }

  const { data, error } = await supabase
    .from('student_chat_messages')
    .update({ is_starred: !message.isStarred })
    .eq('id', message.id)
    .select(CHAT_MESSAGE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapChatRow(data);
}
