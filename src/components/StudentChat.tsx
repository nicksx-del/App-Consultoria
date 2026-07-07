import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import type { Profile } from '../types/auth';
import type { ChatMessage, SendChatMessagePayload } from '../types/chat';
import type { Student } from '../types/student';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StudentChatProps = {
  student: Student;
  profile: Profile;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  errorMessage?: string | null;
  canSend: boolean;
  onSend: (payload: SendChatMessagePayload) => Promise<void> | void;
  onToggleStar: (message: ChatMessage) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

const quickEmojis = ['💪', '🔥', '✅', '👏', '🥗', '📸', '🚀', '🙏'];

const stickerOptions = [
  { label: 'Bora', value: '💪 Bora pra cima!' },
  { label: 'Fechado', value: '✅ Fechado, combinado.' },
  { label: 'Parabéns', value: '👏 Evolução muito boa!' },
  { label: 'Foco', value: '🔥 Mantém o foco hoje.' },
  { label: 'Dieta', value: '🥗 Plano alinhado.' },
  { label: 'Check', value: '📸 Me manda o check-in.' },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;

  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function whatsappUrl(whatsapp: string | null) {
  const digits = whatsapp?.replace(/\D/g, '') ?? '';
  return digits ? `https://wa.me/${digits}` : null;
}

function messagePreview(message?: ChatMessage | null) {
  if (!message) {
    return 'Mensagem indisponível';
  }

  if (message.messageType === 'image') {
    return message.body || 'Foto';
  }

  if (message.messageType === 'audio') {
    return `Áudio ${formatDuration(message.audioDurationSeconds)}`;
  }

  if (message.messageType === 'sticker' && message.mediaPath) {
    return message.body || 'Figurinha';
  }

  return message.body?.slice(0, 90) || 'Mensagem';
}

function messageAuthorLabel(message?: ChatMessage | null) {
  if (!message) {
    return 'Mensagem';
  }

  return message.senderRole === 'trainer' ? 'Treinador' : 'Aluno';
}

function ComposerButton({
  icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.composerButton,
        active && styles.activeComposerButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={17} color={active ? '#061007' : '#9CF02E'} />
      <Text style={[styles.composerButtonText, active && styles.activeComposerButtonText]}>{label}</Text>
    </Pressable>
  );
}

function AudioBubble({ message, own }: { message: ChatMessage; own: boolean }) {
  const player = useAudioPlayer(message.mediaUrl ? { uri: message.mediaUrl } : null);
  const status = useAudioPlayerStatus(player);

  const handlePlay = () => {
    if (!message.mediaUrl) {
      return;
    }

    if (status.playing) {
      player.pause();
      return;
    }

    player.play();
  };

  return (
    <Pressable onPress={handlePlay} style={({ pressed }) => [styles.audioBubble, pressed && styles.pressed]}>
      <View style={[styles.audioPlay, own && styles.ownAudioPlay]}>
        <Feather name={status.playing ? 'pause' : 'play'} size={14} color={own ? '#061007' : '#9CF02E'} />
      </View>
      <View style={styles.audioWave}>
        {Array.from({ length: 18 }).map((_, index) => (
          <View
            key={`${message.id}-${index}`}
            style={[
              styles.waveBar,
              own && styles.ownWaveBar,
              { height: 8 + ((index * 7) % 22) },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.audioDuration, own && styles.ownMessageText]}>
        {formatDuration(message.audioDurationSeconds || status.duration)}
      </Text>
    </Pressable>
  );
}

function QuotePreview({
  message,
  own,
  compact,
}: {
  message?: ChatMessage | null;
  own?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.quoteBox, own && styles.ownQuoteBox, compact && styles.compactQuoteBox]}>
      <View style={[styles.quoteStripe, own && styles.ownQuoteStripe]} />
      <View style={styles.quoteCopy}>
        <Text style={[styles.quoteAuthor, own && styles.ownQuoteText]}>{messageAuthorLabel(message)}</Text>
        <Text style={[styles.quoteText, own && styles.ownQuoteText]} numberOfLines={compact ? 1 : 2}>
          {messagePreview(message)}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  replyTo,
  currentUserId,
  selected,
  onSelect,
}: {
  message: ChatMessage;
  replyTo?: ChatMessage | null;
  currentUserId: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  const own = message.senderId === currentUserId;
  const senderLabel = message.senderRole === 'trainer' ? 'Treinador' : 'Aluno';
  const isStickerImage = message.messageType === 'sticker' && Boolean(message.mediaUrl);

  return (
    <View style={[styles.messageRow, own && styles.ownMessageRow]}>
      <Pressable
        onPress={onSelect}
        onLongPress={onSelect}
        style={[styles.messageBubble, own && styles.ownMessageBubble, selected && styles.selectedMessageBubble]}
      >
        <View style={styles.messageMetaRow}>
          <Text style={[styles.senderLabel, own && styles.ownSenderLabel]}>{senderLabel}</Text>
          {message.isStarred ? (
            <MaterialCommunityIcons name="star" size={13} color={own ? '#061007' : '#FBBF24'} />
          ) : null}
        </View>

        {replyTo ? <QuotePreview message={replyTo} own={own} compact /> : null}

        {message.messageType === 'image' && message.mediaUrl ? (
          <Image source={{ uri: message.mediaUrl }} resizeMode="cover" style={styles.messageImage as ImageStyle} />
        ) : null}

        {isStickerImage && message.mediaUrl ? (
          <View style={styles.stickerImageFrame}>
            <Image source={{ uri: message.mediaUrl }} resizeMode="cover" style={styles.stickerImage as ImageStyle} />
          </View>
        ) : null}

        {message.messageType === 'audio' ? <AudioBubble message={message} own={own} /> : null}

        {message.body ? (
          <Text style={[message.messageType === 'sticker' ? styles.stickerText : styles.messageText, own && styles.ownMessageText]}>
            {message.body}
          </Text>
        ) : null}

        <Text style={[styles.messageTime, own && styles.ownMessageTime]}>{formatMessageTime(message.createdAt)}</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  children,
  onPress,
}: {
  icon: IconName;
  label?: string;
  children?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={16} color="#9CF02E" />
      {children ?? <Text style={styles.actionButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function StudentChat({
  student,
  profile,
  messages,
  loading,
  sending,
  errorMessage,
  canSend,
  onSend,
  onToggleStar,
  onRefresh,
}: StudentChatProps) {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const canInteract = canSend && !sending;
  const externalWhatsappUrl = useMemo(() => whatsappUrl(student.whatsapp), [student.whatsapp]);
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;
  const replyToMessage = messages.find((message) => message.id === replyToMessageId) ?? null;
  const messageCount = messages.length;

  const sendPayload = async (payload: SendChatMessagePayload) => {
    setLocalError(null);
    await onSend(replyToMessageId ? { ...payload, replyToMessageId } : payload);
    setReplyToMessageId(null);
    setSelectedMessageId(null);
  };

  const handleSendText = async () => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    await sendPayload({ type: 'text', body: trimmed });
    setText('');
    setShowStickers(false);
  };

  const handlePickImage = async ({ asSticker = false }: { asSticker?: boolean } = {}) => {
    setLocalError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Permita acesso à galeria para enviar fotos no chat.');
      return;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: asSticker,
      quality: asSticker ? 0.9 : 0.82,
    };

    if (asSticker) {
      pickerOptions.aspect = [1, 1];
    }

    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets[0]) {
      return;
    }

    if (asSticker) {
      await sendPayload({ type: 'sticker', asset: result.assets[0] });
      setShowStickers(false);
      return;
    }

    await sendPayload({ type: 'image', asset: result.assets[0] });
  };

  const handleAudioPress = async () => {
    setLocalError(null);

    if (recorderState.isRecording) {
      const durationSeconds = recorderState.durationMillis / 1000;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      const audioUri = recorder.uri || recorderState.url;

      if (!audioUri) {
        setLocalError('Não consegui localizar o áudio gravado.');
        return;
      }

      await sendPayload({ type: 'audio', uri: audioUri, durationSeconds, mimeType: 'audio/m4a' });
      return;
    }

    const permission = await requestRecordingPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Permita acesso ao microfone para gravar áudio.');
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const handleSticker = async (value: string) => {
    await sendPayload({ type: 'sticker', body: value });
    setShowStickers(false);
  };

  const openWhatsapp = async () => {
    if (!externalWhatsappUrl) {
      setLocalError('Este aluno ainda não tem WhatsApp cadastrado.');
      return;
    }

    await Linking.openURL(externalWhatsappUrl);
  };

  const startReply = () => {
    if (!selectedMessage) {
      return;
    }

    setReplyToMessageId(selectedMessage.id);
    setSelectedMessageId(null);
  };

  const toggleStar = async () => {
    if (!selectedMessage) {
      return;
    }

    await onToggleStar(selectedMessage);
    setSelectedMessageId(null);
  };

  return (
    <View style={styles.container} testID="student-chat">
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.2)', 'rgba(5, 11, 6, 0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chatHeader}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(student.full_name) || 'A'}</Text>
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Canal direto</Text>
          <Text style={styles.headerTitle}>{student.full_name}</Text>
          <Text style={styles.headerText}>Mensagens, fotos, ?udio e figurinhas no acompanhamento do aluno.</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{messageCount}</Text>
            <Text style={styles.headerStatLabel}>mensagens</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{selectedMessage ? '1' : '0'}</Text>
            <Text style={styles.headerStatLabel}>selecionada</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{externalWhatsappUrl ? 'On' : 'Off'}</Text>
            <Text style={styles.headerStatLabel}>whatsapp</Text>
          </View>
        </View>
        <View style={styles.headerActions}>

          <Pressable onPress={() => void onRefresh()} disabled={loading} style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>
            {loading ? <ActivityIndicator size="small" color="#9CF02E" /> : <Feather name="refresh-cw" size={15} color="#9CF02E" />}
          </Pressable>
          <Pressable onPress={() => void openWhatsapp()} style={({ pressed }) => [styles.whatsappButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="whatsapp" size={17} color="#061007" />
            <Text style={styles.whatsappText}>WhatsApp</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {errorMessage || localError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={15} color="#FCA5A5" />
          <Text style={styles.errorText}>{localError || errorMessage}</Text>
        </View>
      ) : null}

      {selectedMessage ? (
        <View style={styles.messageActions}>
          <View style={styles.messageActionsCopy}>
            <Text style={styles.actionKicker}>Mensagem selecionada</Text>
            <Text style={styles.actionPreview} numberOfLines={1}>{messagePreview(selectedMessage)}</Text>
          </View>
          <ActionButton icon="reply-outline" label="Responder" onPress={startReply} />
          <ActionButton icon={selectedMessage.isStarred ? 'star-off-outline' : 'star-outline'} onPress={() => void toggleStar()}>
            <Text style={styles.actionButtonText}>{selectedMessage.isStarred ? 'Desmarcar' : 'Favoritar'}</Text>
          </ActionButton>
          <ActionButton icon="close" label="Limpar" onPress={() => setSelectedMessageId(null)} />
        </View>
      ) : null}

      <View style={styles.messagesPanel}>
        {loading && !messages.length ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#9CF02E" />
            <Text style={styles.mutedText}>Abrindo conversa...</Text>
          </View>
        ) : messages.length ? (
          <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                replyTo={messages.find((item) => item.id === message.replyToMessageId) ?? null}
                currentUserId={profile.id}
                selected={selectedMessageId === message.id}
                onSelect={() => setSelectedMessageId((current) => (current === message.id ? null : message.id))}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyChat}>
            <MaterialCommunityIcons name="message-text-outline" size={32} color="#9CF02E" />
            <Text style={styles.emptyTitle}>Sem mensagens por enquanto</Text>
            <Text style={styles.emptyText}>Envie uma orientação rápida, foto, figurinha ou áudio para iniciar.</Text>
          </View>
        )}
      </View>

      <View style={styles.composer}>
        {replyToMessage ? (
          <View style={styles.replyComposer}>
            <QuotePreview message={replyToMessage} compact />
            <Pressable onPress={() => setReplyToMessageId(null)} style={({ pressed }) => [styles.cancelReplyButton, pressed && styles.pressed]}>
              <Feather name="x" size={16} color="#9CF02E" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          {quickEmojis.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setText((current) => `${current}${emoji}`)}
              disabled={!canInteract}
              style={({ pressed }) => [styles.emojiChip, !canInteract && styles.disabled, pressed && canInteract && styles.pressed]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {showStickers ? (
          <View style={styles.stickerTray}>
            <Pressable
              onPress={() => void handlePickImage({ asSticker: true })}
              disabled={!canInteract}
              style={({ pressed }) => [styles.photoStickerButton, !canInteract && styles.disabled, pressed && canInteract && styles.pressed]}
            >
              <MaterialCommunityIcons name="image-plus" size={18} color="#061007" />
              <View style={styles.photoStickerCopy}>
                <Text style={styles.photoStickerTitle}>Gerar figurinha com foto</Text>
                <Text style={styles.photoStickerText}>Selecione uma imagem e ajuste o recorte quadrado.</Text>
              </View>
            </Pressable>

            {stickerOptions.map((sticker) => (
              <Pressable
                key={sticker.value}
                onPress={() => void handleSticker(sticker.value)}
                disabled={!canInteract}
                style={({ pressed }) => [styles.stickerChip, pressed && canInteract && styles.pressed, !canInteract && styles.disabled]}
              >
                <Text style={styles.stickerChipText}>{sticker.value}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.composerInputRow}>
          <ComposerButton
            icon="sticker-emoji"
            label="Figurinha"
            active={showStickers}
            disabled={!canInteract}
            onPress={() => setShowStickers((current) => !current)}
          />
          <ComposerButton icon="image-outline" label="Imagem" disabled={!canInteract} onPress={() => void handlePickImage()} />

          <TextInput
            value={text}
            placeholder="Escreva uma mensagem"
            placeholderTextColor="rgba(220, 244, 200, 0.38)"
            multiline
            editable={canInteract}
            onChangeText={setText}
            style={[styles.messageInput, !canInteract && styles.disabledInput]}
          />

          {text.trim() ? (
            <Pressable
              onPress={() => void handleSendText()}
              disabled={!canInteract}
              style={({ pressed }) => [styles.sendButton, !canInteract && styles.disabled, pressed && canInteract && styles.pressed]}
            >
              {sending ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="send" size={17} color="#061007" />}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleAudioPress()}
              disabled={!canInteract && !recorderState.isRecording}
              style={({ pressed }) => [
                styles.audioButton,
                recorderState.isRecording && styles.recordingButton,
                (!canInteract && !recorderState.isRecording) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name={recorderState.isRecording ? 'stop' : 'microphone'} size={19} color={recorderState.isRecording ? '#061007' : '#9CF02E'} />
            </Pressable>
          )}
        </View>

        {recorderState.isRecording ? (
          <View style={styles.recordingNotice}>
            <View style={styles.recordDot} />
            <Text style={styles.recordingText}>Gravando áudio. Toque no botão para parar e enviar. {formatDuration(recorderState.durationMillis / 1000)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 14,
    overflow: 'hidden',
  },
  chatHeader: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F4FFE8',
    fontSize: 18,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
    minWidth: 180,
  },
  headerStats: {
    gap: 8,
    minWidth: 120,
  },
  headerStat: {
    minWidth: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 15, 8, 0.76)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerStatValue: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  headerStatLabel: {
    marginTop: 2,
    color: 'rgba(220, 244, 200, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 5,
    color: '#F4FFE8',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  headerText: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.62)',
    fontSize: 12,
    lineHeight: 17,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundAction: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(8, 15, 8, 0.7)',
  },
  whatsappButton: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#9CF02E',
  },
  whatsappText: {
    color: '#061007',
    fontSize: 12,
    fontWeight: '900',
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
  messageActions: {
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(9, 16, 9, 0.94)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  messageActionsCopy: {
    flex: 1,
    minWidth: 155,
  },
  actionKicker: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionPreview: {
    marginTop: 3,
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(14, 22, 14, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    color: '#DCF4C8',
    fontSize: 11,
    fontWeight: '900',
  },
  messagesPanel: {
    minHeight: 360,
    maxHeight: 560,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(5, 10, 5, 0.72)',
    overflow: 'hidden',
  },
  messagesList: {
    padding: 13,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    padding: 11,
    backgroundColor: 'rgba(18, 27, 19, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    gap: 7,
  },
  ownMessageBubble: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  selectedMessageBubble: {
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderLabel: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  ownSenderLabel: {
    color: 'rgba(6, 16, 7, 0.7)',
  },
  quoteBox: {
    borderRadius: 13,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    padding: 9,
    flexDirection: 'row',
    gap: 8,
  },
  ownQuoteBox: {
    backgroundColor: 'rgba(6, 16, 7, 0.12)',
    borderColor: 'rgba(6, 16, 7, 0.14)',
  },
  compactQuoteBox: {
    padding: 8,
  },
  quoteStripe: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  ownQuoteStripe: {
    backgroundColor: '#061007',
  },
  quoteCopy: {
    flex: 1,
  },
  quoteAuthor: {
    color: '#9CF02E',
    fontSize: 10,
    fontWeight: '900',
  },
  quoteText: {
    marginTop: 2,
    color: 'rgba(220, 244, 200, 0.7)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  ownQuoteText: {
    color: '#061007',
  },
  messageText: {
    color: '#F4FFE8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  ownMessageText: {
    color: '#061007',
  },
  stickerText: {
    color: '#F4FFE8',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
  },
  messageTime: {
    alignSelf: 'flex-end',
    color: 'rgba(220, 244, 200, 0.44)',
    fontSize: 10,
    fontWeight: '700',
  },
  ownMessageTime: {
    color: 'rgba(6, 16, 7, 0.55)',
  },
  messageImage: {
    width: 210,
    height: 150,
    maxWidth: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(6, 16, 7, 0.2)',
  },
  stickerImageFrame: {
    width: 178,
    height: 178,
    maxWidth: '100%',
    borderRadius: 22,
    padding: 6,
    backgroundColor: 'rgba(244, 255, 232, 0.08)',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  audioBubble: {
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  audioPlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  ownAudioPlay: {
    backgroundColor: 'rgba(6, 16, 7, 0.14)',
    borderColor: 'rgba(6, 16, 7, 0.2)',
  },
  audioWave: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    opacity: 0.75,
  },
  ownWaveBar: {
    backgroundColor: '#061007',
    opacity: 0.45,
  },
  audioDuration: {
    color: '#DCF4C8',
    fontSize: 11,
    fontWeight: '800',
  },
  loadingBox: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mutedText: {
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyChat: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#F4FFE8',
    fontSize: 17,
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
  composer: {
    borderRadius: 26,
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(8, 14, 8, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cancelReplyButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  emojiChip: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  emojiText: {
    fontSize: 17,
  },
  stickerTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  photoStickerButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 18,
    padding: 11,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoStickerCopy: {
    flex: 1,
  },
  photoStickerTitle: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  photoStickerText: {
    marginTop: 2,
    color: 'rgba(6, 16, 7, 0.68)',
    fontSize: 11,
    fontWeight: '700',
  },
  stickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 20, 12, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  stickerChipText: {
    color: '#F4FFE8',
    fontSize: 12,
    fontWeight: '800',
  },
  composerInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerButton: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(14, 22, 14, 0.86)',
    gap: 2,
  },
  activeComposerButton: {
    backgroundColor: '#9CF02E',
  },
  composerButtonText: {
    color: '#DCF4C8',
    fontSize: 10,
    fontWeight: '900',
  },
  activeComposerButtonText: {
    color: '#061007',
  },
  messageInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 104,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: 'rgba(18, 25, 18, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledInput: {
    opacity: 0.58,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
  },
  audioButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 22, 14, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  recordingButton: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  recordingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F87171',
  },
  recordingText: {
    flex: 1,
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.48,
  },
});
