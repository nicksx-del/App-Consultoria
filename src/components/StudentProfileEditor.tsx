import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { Student, StudentProfilePayload } from '../types/student';

type StudentProfileEditorProps = {
  student: Student;
  canEdit: boolean;
  loading?: boolean;
  saving?: boolean;
  errorMessage?: string | null;
  onSave: (payload: StudentProfilePayload) => Promise<void> | void;
  onEditLater?: () => void;
};

type ProfileFormState = {
  displayName: string;
  username: string;
  headline: string;
  bio: string;
  location: string;
  instagramUrl: string;
  websiteUrl: string;
};

function pickText(value: string | null | undefined, fallback = '') {
  return value?.trim() || fallback;
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return initials || 'AL';
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._]/g, '');
}

function normalizeLinkValue(value: string) {
  return value.trim();
}

function makeInitialState(student: Student): ProfileFormState {
  return {
    displayName: pickText(student.display_name, student.full_name),
    username: normalizeUsername(pickText(student.username)),
    headline: pickText(student.headline),
    bio: pickText(student.bio),
    location: pickText(student.location),
    instagramUrl: pickText(student.instagram_url),
    websiteUrl: pickText(student.website_url),
  };
}

async function pickImage(kind: 'avatar' | 'cover') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Permita o acesso à galeria para escolher a imagem do perfil.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: kind === 'avatar' ? [1, 1] : [16, 9],
    quality: 0.92,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  helperText,
  multiline = false,
  editable = true,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  helperText?: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(230, 244, 218, 0.34)"
        onChangeText={onChangeText}
        multiline={multiline}
        editable={editable}
        style={[styles.input, multiline && styles.textArea, !editable && styles.inputDisabled]}
      />
      {helperText ? <Text style={styles.fieldHint}>{helperText}</Text> : null}
    </View>
  );
}

export function StudentProfileEditor({
  student,
  canEdit,
  loading = false,
  saving = false,
  errorMessage,
  onSave,
  onEditLater,
}: StudentProfileEditorProps) {
  const [form, setForm] = useState<ProfileFormState>(() => makeInitialState(student));
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [pickingCover, setPickingCover] = useState(false);

  useEffect(() => {
    setForm(makeInitialState(student));
    setAvatarAsset(null);
    setCoverAsset(null);
    setLocalError(null);
  }, [student.id]);

  const publicName = form.displayName.trim() || student.full_name;
  const avatarSource = avatarAsset?.uri || student.avatar_url || null;
  const coverSource = coverAsset?.uri || student.cover_url || null;

  const profileCompleteness = useMemo(() => {
    const filled = [
      publicName,
      form.username,
      form.headline,
      form.bio,
      form.location,
      form.instagramUrl,
      form.websiteUrl,
      avatarSource,
      coverSource,
    ].filter((value) => Boolean(String(value).trim())).length;

    return clampPercent((filled / 9) * 100);
  }, [
    avatarSource,
    coverSource,
    form.bio,
    form.headline,
    form.instagramUrl,
    form.location,
    form.username,
    form.websiteUrl,
    publicName,
  ]);

  const updateField = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handlePickAvatar = async () => {
    if (!canEdit || pickingAvatar || saving) {
      return;
    }

    setPickingAvatar(true);
    setLocalError(null);

    try {
      const asset = await pickImage('avatar');
      if (asset) {
        setAvatarAsset(asset);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível escolher a imagem.');
    } finally {
      setPickingAvatar(false);
    }
  };

  const handlePickCover = async () => {
    if (!canEdit || pickingCover || saving) {
      return;
    }

    setPickingCover(true);
    setLocalError(null);

    try {
      const asset = await pickImage('cover');
      if (asset) {
        setCoverAsset(asset);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível escolher a imagem.');
    } finally {
      setPickingCover(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit || saving) {
      return;
    }

    setLocalError(null);

    const displayName = form.displayName.trim();
    if (displayName.length < 2) {
      setLocalError('Informe um nome de exibição com pelo menos 2 caracteres.');
      return;
    }

    const normalizedUsername = normalizeUsername(form.username);
    if (normalizedUsername && normalizedUsername.length < 3) {
      setLocalError('O usuário precisa ter pelo menos 3 caracteres válidos.');
      return;
    }

    try {
      await onSave({
        displayName,
        username: normalizedUsername,
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        instagramUrl: normalizeLinkValue(form.instagramUrl),
        websiteUrl: normalizeLinkValue(form.websiteUrl),
        avatarAsset,
        coverAsset,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível salvar o perfil agora.');
    }
  };

  const message = errorMessage || localError;
  const usernameLabel = form.username.trim() ? `@${normalizeUsername(form.username)}` : '@seuusuario';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.shell}>
        <LinearGradient
          colors={['rgba(156, 240, 46, 0.18)', 'rgba(8, 12, 8, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.kickerPill}>
              <MaterialCommunityIcons name="account-edit-outline" size={14} color="#061007" />
              <Text style={styles.kickerPillText}>{canEdit ? 'Editar perfil p?blico' : 'Perfil p?blico'}</Text>
            </View>
            
            <View style={styles.heroActions}>
              <View style={styles.statePill}>
                <Feather name={student.avatar_url || avatarAsset ? 'check' : 'image'} size={13} color="#DFF7C9" />
                <Text style={styles.statePillText}>
                  {student.avatar_url || avatarAsset ? 'Foto pronta' : 'Foto pendente'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Crie um perfil que pareça uma vitrine.</Text>
            <Text style={styles.heroSubtitle}>
              Em um só lugar o aluno monta nome, foto, capa, bio e links para já testar uma experiência próxima de rede social.
            </Text>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Perfil montado</Text>
              <Text style={styles.progressValue}>{Math.round(profileCompleteness)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profileCompleteness}%` }]} />
            </View>
          </View>
          <View style={styles.coverCompactCard}>
            <View style={styles.coverPreview}>
              {coverSource ? (
                <ImageBackground source={{ uri: coverSource }} resizeMode="cover" style={styles.coverPreviewImage}>
                  <View style={styles.coverPreviewShade} />
                </ImageBackground>
              ) : (
                <View style={styles.coverPreviewPlaceholder}>
                  <Feather name="image" size={20} color="#9CF02E" />
                </View>
              )}
            </View>

            <View style={styles.coverCompactCopy}>
              <Text style={styles.coverCompactTitle}>{coverSource ? 'Capa definida' : 'Adicionar capa'}</Text>
              <Text style={styles.coverCompactText}>
                {coverSource ? 'Toque para trocar a imagem.' : 'Opcional, mas deixa o perfil mais bonito.'}
              </Text>
            </View>

            <Pressable
              disabled={!canEdit || loading || saving}
              onPress={() => void handlePickCover()}
              style={({ pressed }) => [
                styles.coverCompactButton,
                pressed && styles.pressed,
                (!canEdit || loading || saving) && styles.disabledButton,
              ]}
            >
              <Feather name="image" size={14} color="#061007" />
              <Text style={styles.coverCompactButtonText}>{coverSource ? 'Trocar' : 'Adicionar'}</Text>
            </Pressable>
          </View>

          <View style={styles.identityRow}>
            <Pressable
              disabled={!canEdit || loading || saving}
              onPress={() => void handlePickAvatar()}
              style={({ pressed }) => [styles.avatarShell, pressed && styles.pressed, !canEdit && styles.disabled]}
            >
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{getInitials(publicName)}</Text>
                </View>
              )}
              {canEdit ? (
                <View style={styles.avatarBadge}>
                  <Feather name="camera" size={12} color="#061007" />
                </View>
              ) : null}
            </Pressable>

            <View style={styles.identityCopy}>
              <Text style={styles.identityTitle}>{publicName}</Text>
              <Text style={styles.identitySubtitle}>
                {form.headline.trim() || 'Escreva uma frase curta para apresentar o aluno.'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Feather name="at-sign" size={12} color="#9CF02E" />
                  <Text style={styles.metaChipText}>{usernameLabel}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Feather name="map-pin" size={12} color="#9CF02E" />
                  <Text style={styles.metaChipText}>{form.location.trim() || 'sem localização'}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.previewPanel}>
          <Text style={styles.sectionKicker}>Prévia pública</Text>
          <Text style={styles.sectionTitle}>Como o perfil vai aparecer</Text>

          <View style={styles.previewCard}>
            {coverSource ? (
              <View style={styles.previewBanner}>
                <ImageBackground source={{ uri: coverSource }} resizeMode="cover" style={styles.previewCoverImage}>
                  <View style={styles.previewCoverShade} />
                </ImageBackground>
              </View>
            ) : (
              <View style={styles.previewEmptyRow}>
                <View style={styles.previewEmptyIcon}>
                  <Feather name="image" size={16} color="#9CF02E" />
                </View>
                <View style={styles.previewEmptyCopy}>
                  <Text style={styles.previewEmptyTitle}>Sem capa ainda</Text>
                  <Text style={styles.previewEmptyText}>Você pode deixar para depois sem perder o resto do perfil.</Text>
                </View>
              </View>
            )}

            <View style={styles.previewIdentityRow}>
              <View style={styles.previewAvatarShell}>
                {avatarSource ? (
                  <Image source={{ uri: avatarSource }} style={styles.previewAvatarImage} />
                ) : (
                  <View style={styles.previewAvatarFallback}>
                    <Text style={styles.previewAvatarInitials}>{getInitials(publicName)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.previewIdentityCopy}>
                <Text style={styles.previewName}>{publicName}</Text>
                <Text style={styles.previewUsername}>{usernameLabel}</Text>
                <Text style={styles.previewHeadline}>
                  {form.headline.trim() || 'Escreva uma frase de apresentação para o perfil.'}
                </Text>
              </View>
            </View>

            <View style={styles.previewMetaRow}>
              <View style={styles.previewMetaChip}>
                <Feather name="map-pin" size={12} color="#9CF02E" />
                <Text style={styles.previewMetaText}>{form.location.trim() || 'Sem localização'}</Text>
              </View>
              <View style={styles.previewMetaChip}>
                <Feather name="instagram" size={12} color="#9CF02E" />
                <Text style={styles.previewMetaText}>
                  {form.instagramUrl.trim() ? 'Instagram pronto' : 'Instagram opcional'}
                </Text>
              </View>
            </View>

            <Text style={styles.previewBio}>
              {form.bio.trim() || 'A bio aparece aqui enquanto o aluno for preenchendo o perfil.'}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Identidade</Text>
          <Text style={styles.sectionTitle}>Como o aluno vai aparecer</Text>
          <Text style={styles.sectionText}>
            Este perfil já prepara a base para uma vitrine pública: nome de exibição, usuário, bio e imagens.
          </Text>

          <Field
            label="Nome de exibição"
            value={form.displayName}
            placeholder="Ex: Fitto Silva"
            onChangeText={(value) => updateField('displayName', value)}
            helperText="Esse é o nome que aparece publicamente no card do aluno."
            editable={canEdit && !saving && !loading}
          />

          <Field
            label="Usuário"
            value={form.username}
            placeholder="Ex: fitto.silva"
            onChangeText={(value) => updateField('username', normalizeUsername(value))}
            helperText="Use letras, números, ponto e underline. Sem espaços."
            editable={canEdit && !saving && !loading}
          />

          <Field
            label="Frase de apresentação"
            value={form.headline}
            placeholder="Ex: Evoluindo um dia de cada vez"
            onChangeText={(value) => updateField('headline', value)}
            helperText="Uma frase curta para destacar a personalidade do aluno."
            editable={canEdit && !saving && !loading}
          />

          <Field
            label="Bio"
            value={form.bio}
            placeholder="Conte um pouco sobre o aluno"
            onChangeText={(value) => updateField('bio', value)}
            helperText="Uma descrição mais longa para o perfil."
            multiline
            editable={canEdit && !saving && !loading}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Conexões</Text>
          <Text style={styles.sectionTitle}>Links que vão aparecer no perfil</Text>

          <Field
            label="Localização"
            value={form.location}
            placeholder="Ex: São Paulo, SP"
            onChangeText={(value) => updateField('location', value)}
            helperText="Ajuda a dar contexto ao perfil do aluno."
            editable={canEdit && !saving && !loading}
          />

          <Field
            label="Instagram"
            value={form.instagramUrl}
            placeholder="Ex: @fitto"
            onChangeText={(value) => updateField('instagramUrl', value)}
            helperText="Pode digitar @usuário ou o link completo."
            editable={canEdit && !saving && !loading}
          />

          <Field
            label="Website"
            value={form.websiteUrl}
            placeholder="Ex: https://meusite.com"
            onChangeText={(value) => updateField('websiteUrl', value)}
            helperText="Use o site oficial, portfólio ou página pessoal."
            editable={canEdit && !saving && !loading}
          />
        </View>

        {message ? (
          <View style={styles.errorNotice}>
            <Feather name="alert-circle" size={16} color="#FFB3A8" />
            <Text style={styles.errorText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            disabled={!canEdit || loading || saving}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              (!canEdit || loading || saving) && styles.disabledButton,
            ]}
          >
            <LinearGradient
              colors={['#B1FF2A', '#58E976']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButtonFill}
            >
              <MaterialCommunityIcons name="content-save-outline" size={18} color="#07110B" />
              <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar perfil'}</Text>
            </LinearGradient>
          </Pressable>

          {onEditLater ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                if (!saving) {
                  onEditLater();
                }
              }}
              style={({ pressed }) => [
                styles.editLaterAction,
                pressed && styles.pressed,
                saving && styles.disabledButton,
              ]}
            >
              <Feather name="clock" size={14} color="#DCE8CE" />
              <Text style={styles.editLaterActionText}>Editar depois</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hintCard}>
          <Feather name="info" size={14} color="#9CF02E" />
          <Text style={styles.hintText}>
            {Platform.OS === 'web'
              ? 'Foto e capa ficam no Supabase para você testar a experiência visual já no navegador.'
              : 'Foto e capa ficam no Supabase para manter o perfil pronto no app.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
  },
  shell: {
    gap: 14,
  },
  hero: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#B1FF2A',
  },
  kickerPillText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(22, 26, 18, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  statePillText: {
    color: '#DFF7C9',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  heroCopy: {
    gap: 8,
  },
  heroTitle: {
    color: '#F3F7EF',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Sora_800ExtraBold',
  },
  heroSubtitle: {
    color: '#C1CABA',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
  },
  progressBlock: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#DCE8CE',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  progressValue: {
    color: '#B1FF2A',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#B1FF2A',
  },
  coverCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(18, 22, 16, 0.88)',
  },
  coverPreview: {
    width: 58,
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(177, 255, 42, 0.12)',
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  coverPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverCompactCopy: {
    flex: 1,
    gap: 3,
  },
  coverCompactTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_700Bold',
  },
  coverCompactText: {
    color: '#C1CABA',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  coverCompactButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  coverCompactButtonText: {
    color: '#061007',
    fontSize: 11,
    fontFamily: 'Sora_800ExtraBold',
  },
  identityRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatarShell: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    overflow: 'hidden',
    backgroundColor: 'rgba(22, 26, 18, 0.92)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(177, 255, 42, 0.12)',
  },
  avatarInitials: {
    color: '#F3F7EF',
    fontSize: 24,
    fontFamily: 'Sora_800ExtraBold',
  },
  avatarBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B1FF2A',
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  identityTitle: {
    color: '#F3F7EF',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'Sora_800ExtraBold',
  },
  identitySubtitle: {
    color: '#C1CABA',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(22, 26, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  metaChipText: {
    color: '#DDE8CF',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  previewPanel: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 11, 8, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.1)',
  },
  previewCard: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(6, 9, 6, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
  },
  previewBanner: {
    height: 74,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(177, 255, 42, 0.08)',
  },
  previewCoverImage: {
    flex: 1,
  },
  previewCoverShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  previewCoverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(177, 255, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  previewEmptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(177, 255, 42, 0.1)',
  },
  previewEmptyCopy: {
    flex: 1,
    gap: 2,
  },
  previewEmptyTitle: {
    color: '#F3F7EF',
    fontSize: 13,
    fontFamily: 'Sora_700Bold',
  },
  previewEmptyText: {
    color: '#C1CABA',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  previewIdentityRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewAvatarShell: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(22, 26, 18, 0.92)',
  },
  previewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  previewAvatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(177, 255, 42, 0.12)',
  },
  previewAvatarInitials: {
    color: '#F3F7EF',
    fontSize: 18,
    fontFamily: 'Sora_800ExtraBold',
  },
  previewIdentityCopy: {
    flex: 1,
    gap: 3,
  },
  previewName: {
    color: '#F3F7EF',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Sora_800ExtraBold',
  },
  previewUsername: {
    color: '#9CF02E',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  previewHeadline: {
    color: '#C1CABA',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  previewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(22, 26, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  previewMetaText: {
    color: '#DDE8CF',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  previewBio: {
    color: '#DEE7D4',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  panel: {
    gap: 12,
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(8, 11, 8, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.1)',
  },
  sectionKicker: {
    color: '#9CF02E',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Sora_700Bold',
  },
  sectionTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    fontFamily: 'Sora_700Bold',
  },
  sectionText: {
    color: '#C1CABA',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: '#EAF8E4',
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
  },
  fieldHint: {
    color: '#AAB69B',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Sora_400Regular',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#EEF4E7',
    backgroundColor: '#151815',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    fontSize: 15,
    fontFamily: 'Sora_400Regular',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.72,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 79, 79, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 168, 0.18)',
  },
  errorText: {
    flex: 1,
    color: '#FFD0CB',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_500Medium',
  },
  actionsRow: {
    marginTop: 2,
    gap: 10,
  },
  editLaterAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 16,
    backgroundColor: 'rgba(22, 26, 18, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  editLaterActionText: {
    color: '#DCE8CE',
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonFill: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
  },
  saveButtonText: {
    color: '#07110B',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(22, 26, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
  },
  hintText: {
    flex: 1,
    color: '#C1CABA',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.8,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
