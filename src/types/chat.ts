import type { ImagePickerAsset } from 'expo-image-picker';

export type ChatSenderRole = 'trainer' | 'student';
export type ChatMessageType = 'text' | 'image' | 'audio' | 'sticker';

export type ChatMessage = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  messageType: ChatMessageType;
  body: string | null;
  mediaPath: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaSize: number | null;
  audioDurationSeconds: number | null;
  replyToMessageId: string | null;
  isStarred: boolean;
  createdAt: string;
};

type ReplyPayload = {
  replyToMessageId?: string | null;
};

export type SendChatMessagePayload =
  | ({
      type: 'text';
      body: string;
    } & ReplyPayload)
  | ({
      type: 'sticker';
      body?: string;
      asset?: ImagePickerAsset;
    } & ReplyPayload)
  | ({
      type: 'image';
      asset: ImagePickerAsset;
      body?: string;
    } & ReplyPayload)
  | ({
      type: 'audio';
      uri: string;
      durationSeconds?: number;
      mimeType?: string;
    } & ReplyPayload);
