import { useEffect, useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import type { Profile } from '../types/auth';
import type {
  CheckInPhotoDraft,
  CheckInPhotoLabel,
  CheckInStatus,
  CheckInVideoDraft,
  CheckInVideoLabel,
  ReviewCheckInPayload,
  StudentCheckIn,
  SubmitCheckInPayload,
} from '../types/checkin';
import type { Student } from '../types/student';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type CheckInPanelProps = {
  student: Student;
  profile: Profile;
  checkIns: StudentCheckIn[];
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  canSubmit: boolean;
  canReview: boolean;
  onSubmit: (payload: SubmitCheckInPayload) => Promise<void> | void;
  onReview: (checkIn: StudentCheckIn, payload: ReviewCheckInPayload) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

type DraftState = Omit<SubmitCheckInPayload, 'photos' | 'videos'> & {
  photos: CheckInPhotoDraft[];
  videos: CheckInVideoDraft[];
};

const photoLabelOptions: Array<{ value: CheckInPhotoLabel; label: string; icon: IconName }> = [
  { value: 'front', label: 'Frente', icon: 'human' },
  { value: 'back', label: 'Costas', icon: 'human' },
  { value: 'left', label: 'Lado esq.', icon: 'arrow-left-bold-outline' },
  { value: 'right', label: 'Lado dir.', icon: 'arrow-right-bold-outline' },
  { value: 'relaxed', label: 'Relaxado', icon: 'camera-outline' },
  { value: 'other', label: 'Extra', icon: 'image-plus' },
];

const videoLabelOptions: Array<{ value: CheckInVideoLabel; label: string; icon: IconName }> = [
  { value: 'last_set', label: 'Ultima serie', icon: 'video-outline' },
  { value: 'posing', label: 'Posing', icon: 'human-handsup' },
  { value: 'cardio', label: 'Cardio', icon: 'run-fast' },
  { value: 'other', label: 'Extra', icon: 'video-plus-outline' },
];

const statusMeta: Record<CheckInStatus, { label: string; icon: IconName; color: string; background: string }> = {
  pending: {
    label: 'Aguardando revisão',
    icon: 'clock-outline',
    color: '#FDE68A',
    background: 'rgba(253, 230, 138, 0.12)',
  },
  reviewed: {
    label: 'Revisado',
    icon: 'check-circle-outline',
    color: '#9CF02E',
    background: 'rgba(156, 240, 46, 0.14)',
  },
  adjusted: {
    label: 'Ajuste enviado',
    icon: 'tune-variant',
    color: '#86EFAC',
    background: 'rgba(134, 239, 172, 0.12)',
  },
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(student: Student): DraftState {
  return {
    checkinDate: todayIsoDate(),
    weightKg: student.weight_kg ? String(student.weight_kg).replace('.', ',') : '',
    waistCm: '',
    abdomenCm: '',
    hipCm: '',
    chestCm: '',
    armCm: '',
    thighCm: '',
    dietAdherence: '90',
    trainingAdherence: '90',
    cardioAdherence: '80',
    sleepQuality: '4',
    stressLevel: '2',
    energyLevel: '4',
    studentNotes: '',
    photos: [],
    videos: [],
  };
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null, suffix = '') {
  if (value === null) {
    return 'Sem dado';
  }

  return `${value.toLocaleString('pt-BR')}${suffix}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function average(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => typeof value === 'number');

  if (!validValues.length) {
    return null;
  }

  return Math.round(validValues.reduce((total, value) => total + value, 0) / validValues.length);
}

function getPhotoLabel(label: CheckInPhotoLabel) {
  return photoLabelOptions.find((item) => item.value === label)?.label ?? 'Foto';
}

function getVideoLabel(label: CheckInVideoLabel) {
  return videoLabelOptions.find((item) => item.value === label)?.label ?? 'Video';
}

function createDraftPhotoId(label: CheckInPhotoLabel) {
  return `${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftVideoId(label: CheckInVideoLabel) {
  return `video_${label}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function Field({
  label,
  value,
  placeholder,
  suffix,
  multiline,
  keyboardType = 'default',
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  suffix?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={[styles.field, multiline && styles.fieldFull]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor="rgba(220, 244, 200, 0.35)"
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          style={[styles.input, multiline && styles.textArea]}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function ScalePicker({
  label,
  value,
  lowLabel,
  highLabel,
  onChange,
}: {
  label: string;
  value: string;
  lowLabel: string;
  highLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.scaleBlock}>
      <View style={styles.scaleHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.scaleHint}>
          {lowLabel} / {highLabel}
        </Text>
      </View>
      <View style={styles.scaleOptions}>
        {[1, 2, 3, 4, 5].map((item) => {
          const active = value === String(item);

          return (
            <Pressable
              key={item}
              onPress={() => onChange(String(item))}
              style={({ pressed }) => [
                styles.scaleOption,
                active && styles.scaleOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.scaleOptionText, active && styles.scaleOptionTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MetricCard({ icon, label, value, helper }: { icon: IconName; label: string; value: string; helper: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} size={18} color="#061007" />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: CheckInStatus }) {
  const meta = statusMeta[status];

  return (
    <View style={[styles.statusPill, { backgroundColor: meta.background, borderColor: meta.color }]}>
      <MaterialCommunityIcons name={meta.icon} size={13} color={meta.color} />
      <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function CheckInCard({
  checkIn,
  selected,
  onPress,
}: {
  checkIn: StudentCheckIn;
  selected: boolean;
  onPress: () => void;
}) {
  const adherence = average([checkIn.dietAdherence, checkIn.trainingAdherence, checkIn.cardioAdherence]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.checkInCard, selected && styles.checkInCardActive, pressed && styles.pressed]}
    >
      <View style={styles.checkInCardTop}>
        <View>
          <Text style={styles.checkInDate}>{formatDate(checkIn.checkinDate)}</Text>
          <Text style={styles.checkInSubline}>
            {formatNumber(checkIn.weightKg, ' kg')} • {checkIn.photos.length} fotos • {checkIn.videos.length} vídeos
          </Text>
        </View>
        <StatusPill status={checkIn.status} />
      </View>

      <View style={styles.checkInStats}>
        <View style={styles.checkInStat}>
          <Text style={styles.checkInStatValue}>{adherence === null ? '--' : `${adherence}%`}</Text>
          <Text style={styles.checkInStatLabel}>Aderência</Text>
        </View>
        <View style={styles.checkInStat}>
          <Text style={styles.checkInStatValue}>{checkIn.sleepQuality ?? '--'}/5</Text>
          <Text style={styles.checkInStatLabel}>Sono</Text>
        </View>
        <View style={styles.checkInStat}>
          <Text style={styles.checkInStatValue}>{checkIn.energyLevel ?? '--'}/5</Text>
          <Text style={styles.checkInStatLabel}>Energia</Text>
        </View>
      </View>

      {checkIn.studentNotes ? <Text style={styles.checkInNote} numberOfLines={2}>{checkIn.studentNotes}</Text> : null}
    </Pressable>
  );
}

export function CheckInPanel({
  student,
  profile,
  checkIns,
  loading,
  saving,
  errorMessage,
  canSubmit,
  canReview,
  onSubmit,
  onReview,
  onRefresh,
}: CheckInPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft(student));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<CheckInStatus>('reviewed');
  const [coachFeedback, setCoachFeedback] = useState('');
  const [coachPrivateNotes, setCoachPrivateNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedCheckIn = checkIns.find((checkIn) => checkIn.id === selectedId) ?? checkIns[0] ?? null;
  const latestCheckIn = checkIns[0] ?? null;
  const previousCheckIn = checkIns[1] ?? null;
  const pendingCount = checkIns.filter((checkIn) => checkIn.status === 'pending').length;
  const latestAdherence = latestCheckIn
    ? average([latestCheckIn.dietAdherence, latestCheckIn.trainingAdherence, latestCheckIn.cardioAdherence])
    : null;
  const weightDelta = useMemo(() => {
    if (!latestCheckIn?.weightKg || !previousCheckIn?.weightKg) {
      return null;
    }

    return Math.round((latestCheckIn.weightKg - previousCheckIn.weightKg) * 10) / 10;
  }, [latestCheckIn?.id, previousCheckIn?.id]);

  useEffect(() => {
    setDraft(emptyDraft(student));
  }, [student.id]);

  useEffect(() => {
    if (!selectedCheckIn) {
      setReviewStatus('reviewed');
      setCoachFeedback('');
      setCoachPrivateNotes('');
      return;
    }

    setReviewStatus(selectedCheckIn.status === 'pending' ? 'reviewed' : selectedCheckIn.status);
    setCoachFeedback(selectedCheckIn.coachFeedback ?? '');
    setCoachPrivateNotes(selectedCheckIn.coachPrivateNotes ?? '');
  }, [selectedCheckIn?.id]);

  const updateDraft = (key: keyof DraftState, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handlePickPhoto = async (label: CheckInPhotoLabel) => {
    setLocalError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Permita acesso à galeria para adicionar fotos do check-in.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.84,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setDraft((current) => {
      const nextPhoto: CheckInPhotoDraft = {
        id: createDraftPhotoId(label),
        label,
        asset: result.assets[0],
      };

      if (label === 'other') {
        return { ...current, photos: [...current.photos, nextPhoto] };
      }

      return {
        ...current,
        photos: [...current.photos.filter((photo) => photo.label !== label), nextPhoto],
      };
    });
  };

  const handleRemovePhoto = (id: string) => {
    setDraft((current) => ({ ...current, photos: current.photos.filter((photo) => photo.id !== id) }));
  };

  const handlePickVideo = async (label: CheckInVideoLabel) => {
    setLocalError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError('Permita acesso à galeria para adicionar vídeos do check-in.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setDraft((current) => {
      const nextVideo: CheckInVideoDraft = {
        id: createDraftVideoId(label),
        label,
        asset: result.assets[0],
      };

      if (label === 'other') {
        return { ...current, videos: [...current.videos, nextVideo] };
      }

      return {
        ...current,
        videos: [...current.videos.filter((video) => video.label !== label), nextVideo],
      };
    });
  };

  const handleRemoveVideo = (id: string) => {
    setDraft((current) => ({ ...current, videos: current.videos.filter((video) => video.id !== id) }));
  };

  const handleSubmit = async () => {
    setLocalError(null);

    if (!parseNumber(draft.weightKg)) {
      setLocalError('Informe o peso do check-in para manter o histórico útil.');
      return;
    }

    await onSubmit(draft);
    setDraft(emptyDraft(student));
    setShowForm(false);
  };

  const handleReview = async (status: CheckInStatus) => {
    if (!selectedCheckIn) {
      return;
    }

    await onReview(selectedCheckIn, {
      status,
      coachFeedback,
      coachPrivateNotes,
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(156, 240, 46, 0.22)', 'rgba(5, 11, 6, 0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#061007" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>Check-in semanal</Text>
          <Text style={styles.title}>{student.full_name}</Text>
          <Text style={styles.subtitle}>Fotos, peso, medidas, ader?ncia e feedback do coach no mesmo fluxo.</Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{latestAdherence === null ? '--' : `${latestAdherence}%`}</Text>
            <Text style={styles.heroStatLabel}>ader?ncia</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{pendingCount}</Text>
            <Text style={styles.heroStatLabel}>pend?ncias</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{latestCheckIn ? formatDate(latestCheckIn.checkinDate) : 'Hoje'}</Text>
            <Text style={styles.heroStatLabel}>?ltimo envio</Text>
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

      <View style={styles.metricsGrid}>
        <MetricCard
          icon="scale-bathroom"
          label="Último peso"
          value={latestCheckIn ? formatNumber(latestCheckIn.weightKg, ' kg') : 'Sem check-in'}
          helper={weightDelta === null ? 'Aguardando base' : `${weightDelta > 0 ? '+' : ''}${weightDelta} kg vs anterior`}
        />
        <MetricCard
          icon="chart-timeline-variant"
          label="Aderência"
          value={latestAdherence === null ? '--' : `${latestAdherence}%`}
          helper="Dieta, treino e cardio"
        />
        <MetricCard
          icon="camera-outline"
          label="Fotos"
          value={latestCheckIn ? String(latestCheckIn.photos.length) : '0'}
          helper={latestCheckIn ? `${latestCheckIn.videos.length} vídeos enviados` : 'Frente, costas e laterais'}
        />
        <MetricCard
          icon="bell-outline"
          label="Pendências"
          value={String(pendingCount)}
          helper="Aguardando revisão"
        />
      </View>

      {canSubmit ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => setShowForm((current) => !current)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Feather name={showForm ? 'x' : 'plus'} size={16} color="#061007" />
            <Text style={styles.primaryButtonText}>{showForm ? 'Fechar formulário' : 'Registrar check-in'}</Text>
          </Pressable>
          <Text style={styles.actionHint}>{profile.role === 'trainer' ? 'Registro manual ou revisão rápida do coach.' : 'Envie sua atualização para o treinador.'}</Text>
        </View>
      ) : null}

      {showForm ? (
        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Novo envio</Text>
              <Text style={styles.sectionTitle}>Dados do registro</Text>
            </View>
            {saving ? <ActivityIndicator color="#9CF02E" /> : null}
          </View>

          <View style={styles.fieldGrid}>
            <Field label="Data" value={draft.checkinDate} placeholder="2026-06-05" onChangeText={(value) => updateDraft('checkinDate', value)} />
            <Field label="Peso" value={draft.weightKg} suffix="kg" keyboardType="numeric" onChangeText={(value) => updateDraft('weightKg', value)} />
            <Field label="Cintura" value={draft.waistCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('waistCm', value)} />
            <Field label="Abdômen" value={draft.abdomenCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('abdomenCm', value)} />
            <Field label="Quadril" value={draft.hipCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('hipCm', value)} />
            <Field label="Peitoral" value={draft.chestCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('chestCm', value)} />
            <Field label="Braço" value={draft.armCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('armCm', value)} />
            <Field label="Coxa" value={draft.thighCm} suffix="cm" keyboardType="numeric" onChangeText={(value) => updateDraft('thighCm', value)} />
            <Field label="Dieta" value={draft.dietAdherence} suffix="%" keyboardType="numeric" onChangeText={(value) => updateDraft('dietAdherence', value)} />
            <Field label="Treino" value={draft.trainingAdherence} suffix="%" keyboardType="numeric" onChangeText={(value) => updateDraft('trainingAdherence', value)} />
            <Field label="Cardio" value={draft.cardioAdherence} suffix="%" keyboardType="numeric" onChangeText={(value) => updateDraft('cardioAdherence', value)} />
          </View>

          <View style={styles.scaleGrid}>
            <ScalePicker label="Sono" value={draft.sleepQuality} lowLabel="ruim" highLabel="ótimo" onChange={(value) => updateDraft('sleepQuality', value)} />
            <ScalePicker label="Estresse" value={draft.stressLevel} lowLabel="baixo" highLabel="alto" onChange={(value) => updateDraft('stressLevel', value)} />
            <ScalePicker label="Energia" value={draft.energyLevel} lowLabel="baixa" highLabel="alta" onChange={(value) => updateDraft('energyLevel', value)} />
          </View>

          <Field
            label="Relato do aluno"
            value={draft.studentNotes}
            placeholder="Como foi a semana? Fome, treino, cardio, dificuldades, sinais importantes..."
            multiline
            onChangeText={(value) => updateDraft('studentNotes', value)}
          />

          <View style={styles.photoSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>Fotos do shape</Text>
                <Text style={styles.sectionTitle}>Selecionar fotos</Text>
              </View>
              <Text style={styles.photoCounter}>{draft.photos.length} fotos</Text>
            </View>

            <View style={styles.photoPickerGrid}>
              {photoLabelOptions.map((option) => {
                const selected = draft.photos.some((photo) => photo.label === option.value);

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => void handlePickPhoto(option.value)}
                    style={({ pressed }) => [styles.photoPicker, selected && styles.photoPickerActive, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name={option.icon} size={18} color={selected ? '#061007' : '#9CF02E'} />
                    <Text style={[styles.photoPickerText, selected && styles.photoPickerTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {draft.photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoPreviewRow}>
                {draft.photos.map((photo) => (
                  <View key={photo.id} style={styles.photoPreview}>
                    <Image source={{ uri: photo.asset.uri }} resizeMode="cover" style={styles.photoPreviewImage as ImageStyle} />
                    <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.72)']} style={styles.photoPreviewOverlay}>
                      <Text style={styles.photoPreviewLabel}>{getPhotoLabel(photo.label)}</Text>
                    </LinearGradient>
                    <Pressable onPress={() => handleRemovePhoto(photo.id)} style={({ pressed }) => [styles.removePhotoButton, pressed && styles.pressed]}>
                      <Feather name="x" size={13} color="#F4FFE8" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.photoSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>Vídeos de execução</Text>
                <Text style={styles.sectionTitle}>Selecionar vídeos</Text>
              </View>
              <Text style={styles.photoCounter}>{draft.videos.length} vÃ­deos</Text>
            </View>

            <View style={styles.photoPickerGrid}>
              {videoLabelOptions.map((option) => {
                const selected = draft.videos.some((video) => video.label === option.value);

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => void handlePickVideo(option.value)}
                    style={({ pressed }) => [styles.photoPicker, selected && styles.photoPickerActive, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name={option.icon} size={18} color={selected ? '#061007' : '#9CF02E'} />
                    <Text style={[styles.photoPickerText, selected && styles.photoPickerTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {draft.videos.length ? (
              <View style={styles.videoPreviewList}>
                {draft.videos.map((video) => (
                  <View key={video.id} style={styles.videoPreview}>
                    <View style={styles.videoPreviewIcon}>
                      <MaterialCommunityIcons name="play-circle-outline" size={22} color="#061007" />
                    </View>
                    <View style={styles.videoPreviewCopy}>
                      <Text style={styles.videoPreviewTitle}>{getVideoLabel(video.label)}</Text>
                      <Text style={styles.videoPreviewText} numberOfLines={1}>
                        {video.asset.fileName || 'Video selecionado'}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemoveVideo(video.id)} style={({ pressed }) => [styles.removeVideoButton, pressed && styles.pressed]}>
                      <Feather name="x" size={14} color="#F4FFE8" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={saving}
            style={({ pressed }) => [styles.submitButton, saving && styles.disabled, pressed && !saving && styles.pressed]}
          >
            {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="send" size={16} color="#061007" />}
            <Text style={styles.submitButtonText}>Registrar check-in</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.contentGrid}>
        <View style={styles.historyColumn}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.kicker}>Histórico</Text>
              <Text style={styles.sectionTitle}>Histórico de check-ins</Text>
            </View>
            {loading ? <ActivityIndicator color="#9CF02E" /> : null}
          </View>

          {checkIns.length ? (
            <View style={styles.checkInList}>
              {checkIns.map((checkIn) => (
                <CheckInCard
                  key={checkIn.id}
                  checkIn={checkIn}
                  selected={selectedCheckIn?.id === checkIn.id}
                  onPress={() => setSelectedId(checkIn.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-plus-outline" size={32} color="#9CF02E" />
              <Text style={styles.emptyTitle}>Sem check-ins registrados</Text>
              <Text style={styles.emptyText}>Quando houver envios, o histórico aparece aqui.</Text>
            </View>
          )}
        </View>

        <View style={styles.detailColumn}>
          {selectedCheckIn ? (
            <>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.kicker}>Análise do check-in</Text>
                  <Text style={styles.sectionTitle}>{formatDate(selectedCheckIn.checkinDate)}</Text>
                </View>
                <StatusPill status={selectedCheckIn.status} />
              </View>

              <View style={styles.detailStats}>
                <MetricCard icon="scale-bathroom" label="Peso" value={formatNumber(selectedCheckIn.weightKg, ' kg')} helper="Registro semanal" />
                <MetricCard icon="tape-measure" label="Cintura" value={formatNumber(selectedCheckIn.waistCm, ' cm')} helper="Medida base" />
                <MetricCard icon="sleep" label="Sono" value={`${selectedCheckIn.sleepQuality ?? '--'}/5`} helper="Qualidade percebida" />
              </View>

              <View style={styles.adherencePanel}>
                <Text style={styles.panelTitle}>Aderência da semana</Text>
                <View style={styles.adherenceRows}>
                  <AdherenceRow label="Dieta" value={selectedCheckIn.dietAdherence} />
                  <AdherenceRow label="Treino" value={selectedCheckIn.trainingAdherence} />
                  <AdherenceRow label="Cardio" value={selectedCheckIn.cardioAdherence} />
                </View>
              </View>

              {selectedCheckIn.photos.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedPhotosRow}>
                  {selectedCheckIn.photos.map((photo) => (
                    <View key={photo.id} style={styles.savedPhoto}>
                      {photo.url ? (
                        <Image source={{ uri: photo.url }} resizeMode="cover" style={styles.savedPhotoImage as ImageStyle} />
                      ) : (
                        <View style={styles.savedPhotoFallback}>
                          <Feather name="image" size={22} color="#9CF02E" />
                        </View>
                      )}
                      <Text style={styles.savedPhotoLabel}>{getPhotoLabel(photo.label)}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {selectedCheckIn.videos.length ? (
                <View style={styles.savedVideosPanel}>
                  <Text style={styles.panelTitle}>Vídeos enviados</Text>
                  <View style={styles.savedVideosList}>
                    {selectedCheckIn.videos.map((video) => (
                      <View key={video.id} style={styles.savedVideo}>
                        <View style={styles.videoPreviewIcon}>
                          <MaterialCommunityIcons name="play-circle-outline" size={20} color="#061007" />
                        </View>
                        <View style={styles.videoPreviewCopy}>
                          <Text style={styles.videoPreviewTitle}>{getVideoLabel(video.label)}</Text>
                          <Text style={styles.videoPreviewText}>
                            {video.duration ? `${Math.round(video.duration / 1000)}s` : 'Vídeo do check-in'}
                          </Text>
                        </View>
                        {video.url ? (
                          <Pressable onPress={() => void Linking.openURL(video.url!)} style={({ pressed }) => [styles.openVideoButton, pressed && styles.pressed]}>
                            <Feather name="external-link" size={13} color="#9CF02E" />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.notePanel}>
                <Text style={styles.panelTitle}>Observações do aluno</Text>
                <Text style={styles.noteText}>{selectedCheckIn.studentNotes || 'Nenhuma observação enviada.'}</Text>
              </View>

              {selectedCheckIn.coachFeedback ? (
                <View style={styles.coachFeedbackBox}>
                  <Text style={styles.panelTitle}>Resposta do coach</Text>
                  <Text style={styles.noteText}>{selectedCheckIn.coachFeedback}</Text>
                </View>
              ) : null}

              {canReview ? (
                <View style={styles.reviewCard}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.kicker}>Revisão do coach</Text>
                      <Text style={styles.sectionTitle}>Enviar resposta</Text>
                    </View>
                  </View>

                  <View style={styles.reviewStatusRow}>
                    {(['reviewed', 'adjusted'] as CheckInStatus[]).map((status) => {
                      const active = reviewStatus === status;
                      const meta = statusMeta[status];

                      return (
                        <Pressable
                          key={status}
                          onPress={() => setReviewStatus(status)}
                          style={({ pressed }) => [styles.reviewStatusButton, active && styles.reviewStatusButtonActive, pressed && styles.pressed]}
                        >
                          <MaterialCommunityIcons name={meta.icon} size={16} color={active ? '#061007' : meta.color} />
                          <Text style={[styles.reviewStatusText, active && styles.reviewStatusTextActive]}>{meta.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Field
                    label="Feedback para o aluno"
                    value={coachFeedback}
                    placeholder="Ex.: Boa evolução. Vamos ajustar cardio, manter proteína e subir carga no treino A."
                    multiline
                    onChangeText={setCoachFeedback}
                  />
                  <Field
                    label="Notas privadas"
                    value={coachPrivateNotes}
                    placeholder="Notas internas do treinador, sem aparecer para o aluno."
                    multiline
                    onChangeText={setCoachPrivateNotes}
                  />

                  <Pressable
                    onPress={() => void handleReview(reviewStatus)}
                    disabled={saving}
                    style={({ pressed }) => [styles.submitButton, saving && styles.disabled, pressed && !saving && styles.pressed]}
                  >
                    {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="check" size={16} color="#061007" />}
                    <Text style={styles.submitButtonText}>Salvar resposta</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-search-outline" size={32} color="#9CF02E" />
              <Text style={styles.emptyTitle}>Abra um check-in</Text>
              <Text style={styles.emptyText}>A análise detalhada, fotos e feedback aparecem aqui.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function AdherenceRow({ label, value }: { label: string; value: number | null }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0));

  return (
    <View style={styles.adherenceRow}>
      <View style={styles.adherenceRowTop}>
        <Text style={styles.adherenceLabel}>{label}</Text>
        <Text style={styles.adherenceValue}>{value === null ? '--' : `${value}%`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${safeValue}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 14,
  },
  hero: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  heroCopy: {
    flex: 1,
    minWidth: 190,
  },
  heroStats: {
    gap: 8,
    minWidth: 120,
  },
  heroStat: {
    minWidth: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 15, 8, 0.76)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  heroStatValue: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  heroStatLabel: {
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
  title: {
    marginTop: 5,
    color: '#F4FFE8',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.64)',
    fontSize: 12,
    lineHeight: 17,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(8, 15, 8, 0.7)',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 130,
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    color: '#F4FFE8',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  metricLabel: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.78)',
    fontSize: 12,
    fontWeight: '800',
  },
  metricHelper: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.48)',
    fontSize: 11,
    lineHeight: 15,
  },
  actionRow: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 15, 8, 0.78)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: '#9CF02E',
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
  actionHint: {
    flex: 1,
    minWidth: 160,
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 12,
    lineHeight: 17,
  },
  formCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(5, 10, 5, 0.86)',
    padding: 14,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    marginTop: 4,
    color: '#F4FFE8',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flex: 1,
    minWidth: 128,
    gap: 7,
  },
  fieldFull: {
    width: '100%',
    minWidth: '100%',
  },
  fieldLabel: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  inputShell: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(15, 22, 15, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputSuffix: {
    paddingRight: 12,
    color: 'rgba(220, 244, 200, 0.48)',
    fontSize: 12,
    fontWeight: '900',
  },
  scaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scaleBlock: {
    flex: 1,
    minWidth: 185,
    borderRadius: 18,
    padding: 11,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.68)',
    gap: 10,
  },
  scaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scaleHint: {
    color: 'rgba(220, 244, 200, 0.42)',
    fontSize: 10,
    fontWeight: '800',
  },
  scaleOptions: {
    flexDirection: 'row',
    gap: 7,
  },
  scaleOption: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 22, 15, 0.8)',
  },
  scaleOptionActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  scaleOptionText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  scaleOptionTextActive: {
    color: '#061007',
  },
  photoSection: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.68)',
    padding: 12,
    gap: 12,
  },
  photoCounter: {
    color: 'rgba(220, 244, 200, 0.52)',
    fontSize: 12,
    fontWeight: '800',
  },
  photoPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoPicker: {
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  photoPickerActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  photoPickerText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  photoPickerTextActive: {
    color: '#061007',
  },
  photoPreviewRow: {
    gap: 10,
    paddingVertical: 2,
  },
  photoPreview: {
    width: 108,
    height: 138,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    backgroundColor: 'rgba(15, 22, 15, 0.9)',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoPreviewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 9,
  },
  photoPreviewLabel: {
    color: '#F4FFE8',
    fontSize: 11,
    fontWeight: '900',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  videoPreviewList: {
    gap: 9,
  },
  videoPreview: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoPreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewCopy: {
    flex: 1,
    gap: 2,
  },
  videoPreviewTitle: {
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  videoPreviewText: {
    color: 'rgba(220, 244, 200, 0.54)',
    fontSize: 11,
    fontWeight: '700',
  },
  removeVideoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#9CF02E',
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  submitButtonText: {
    color: '#061007',
    fontSize: 14,
    fontWeight: '900',
  },
  contentGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
  },
  historyColumn: {
    flex: 1,
    minWidth: 270,
    gap: 12,
  },
  detailColumn: {
    flex: 1.35,
    minWidth: 300,
    gap: 12,
  },
  checkInList: {
    gap: 10,
  },
  checkInCard: {
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    gap: 12,
  },
  checkInCardActive: {
    borderColor: 'rgba(156, 240, 46, 0.5)',
    backgroundColor: 'rgba(35, 62, 20, 0.42)',
  },
  checkInCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkInDate: {
    color: '#F4FFE8',
    fontSize: 15,
    fontWeight: '900',
  },
  checkInSubline: {
    marginTop: 4,
    color: 'rgba(220, 244, 200, 0.56)',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  checkInStats: {
    flexDirection: 'row',
    gap: 8,
  },
  checkInStat: {
    flex: 1,
    borderRadius: 15,
    padding: 9,
    backgroundColor: 'rgba(15, 22, 15, 0.78)',
  },
  checkInStatValue: {
    color: '#F4FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  checkInStatLabel: {
    marginTop: 3,
    color: 'rgba(220, 244, 200, 0.48)',
    fontSize: 10,
    fontWeight: '800',
  },
  checkInNote: {
    color: 'rgba(220, 244, 200, 0.64)',
    fontSize: 12,
    lineHeight: 17,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  adherencePanel: {
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    gap: 12,
  },
  panelTitle: {
    color: '#F4FFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  adherenceRows: {
    gap: 12,
  },
  adherenceRow: {
    gap: 7,
  },
  adherenceRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adherenceLabel: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  adherenceValue: {
    color: '#9CF02E',
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  savedPhotosRow: {
    gap: 10,
    paddingVertical: 2,
  },
  savedPhoto: {
    width: 132,
    gap: 7,
  },
  savedPhotoImage: {
    width: 132,
    height: 168,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
  },
  savedPhotoFallback: {
    width: 132,
    height: 168,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPhotoLabel: {
    color: 'rgba(220, 244, 200, 0.72)',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  savedVideosPanel: {
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    gap: 10,
  },
  savedVideosList: {
    gap: 9,
  },
  savedVideo: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(15, 22, 15, 0.78)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  openVideoButton: {
    width: 32,
    height: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notePanel: {
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
    gap: 8,
  },
  noteText: {
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  coachFeedbackBox: {
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(35, 62, 20, 0.34)',
    gap: 8,
  },
  reviewCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(5, 10, 5, 0.86)',
    padding: 13,
    gap: 12,
  },
  reviewStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewStatusButton: {
    minHeight: 40,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(15, 22, 15, 0.86)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reviewStatusButtonActive: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  reviewStatusText: {
    color: '#DCF4C8',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewStatusTextActive: {
    color: '#061007',
  },
  emptyState: {
    minHeight: 230,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 15, 8, 0.72)',
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
    marginTop: 7,
    color: 'rgba(220, 244, 200, 0.58)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
