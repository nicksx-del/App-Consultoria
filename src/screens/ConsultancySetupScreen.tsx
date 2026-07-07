import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthBackground } from '../components/AuthBackground';
import { BrandMark } from '../components/BrandMark';
import type { ConsultancySetupPayload } from '../types/consultancy';
import type { Profile } from '../types/auth';

type ConsultancySetupScreenProps = {
  profile: Profile;
  loading?: boolean;
  errorMessage?: string | null;
  onLogout: () => void;
  onSubmit: (payload: ConsultancySetupPayload) => void;
};

type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: ComponentProps<typeof Feather>['name'];
  required?: boolean;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
};

type SetupStep = 1 | 2;

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  required = false,
  keyboardType,
  autoCapitalize = 'sentences',
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}>*</Text> : null}
      </Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Feather name={icon} size={17} color="rgba(220, 244, 200, 0.58)" />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="rgba(193, 202, 186, 0.28)"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          selectionColor="#9CF02E"
          style={[
            styles.input,
            Platform.OS === 'web'
              ? ({ appearance: 'none', WebkitAppearance: 'none', outline: 'none' } as any)
              : null,
          ]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorNotice}>
      <Feather name="alert-circle" size={16} color="#FFB3A8" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function StepBadge({ step }: { step: SetupStep }) {
  const label = step === 1 ? 'Identidade da consultoria' : 'Contato e presença digital';

  return (
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeText}>{label}</Text>
    </View>
  );
}

export function ConsultancySetupScreen({
  profile,
  loading = false,
  errorMessage,
  onLogout,
  onSubmit,
}: ConsultancySetupScreenProps) {
  const [step, setStep] = useState<SetupStep>(1);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [bannerAsset, setBannerAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const displayName = profile.full_name?.trim() || 'Treinador';

  const progressLabel = useMemo(
    () => (step === 1 ? 'Etapa 1 de 2' : 'Etapa 2 de 2'),
    [step],
  );

  const statusMessage = stepError || pickerError || errorMessage;

  const clearStepError = () => {
    setStepError(null);
  };

  const handleNameChange = (value: string) => {
    clearStepError();
    setName(value);
  };

  const handleWhatsappChange = (value: string) => {
    clearStepError();
    setWhatsapp(value);
  };

  const handleInstagramChange = (value: string) => {
    clearStepError();
    setInstagramUrl(value);
  };

  const handleWebsiteChange = (value: string) => {
    clearStepError();
    setWebsiteUrl(value);
  };

  const pickImage = async (kind: 'banner' | 'image') => {
    setPickerError(null);
    clearStepError();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPickerError('Permita acesso à galeria para selecionar suas imagens.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'banner' ? [16, 7] : [1, 1],
      quality: 0.86,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    if (kind === 'banner') {
      setBannerAsset(result.assets[0]);
      return;
    }

    setImageAsset(result.assets[0]);
  };

  const validateIdentityStep = () => {
    const normalizedName = name.trim();

    if (normalizedName.length < 2) {
      setStepError('Informe o nome da consultoria.');
      return false;
    }

    if (!bannerAsset) {
      setStepError('Adicione um banner para a consultoria.');
      return false;
    }

    if (!imageAsset) {
      setStepError('Adicione uma imagem principal.');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (!validateIdentityStep()) {
      return;
    }

    setStepError(null);
    setStep(2);
  };

  const handleSubmit = () => {
    if (!validateIdentityStep()) {
      setStep(1);
      return;
    }

    onSubmit({
      name,
      whatsapp,
      instagramUrl,
      websiteUrl,
      bannerAsset,
      imageAsset,
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AuthBackground />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.centerWrap}>
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <View style={styles.topRow}>
                  <View style={styles.badge}>
                    <MaterialCommunityIcons name="creation" size={15} color="#9CF02E" />
                    <Text style={styles.badgeText}>Primeira configuração</Text>
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
                    <Text style={styles.logoutText}>Sair</Text>
                  </Pressable>
                </View>

                <View style={styles.heroBlock}>
                  <BrandMark
                    size="md"
                    subtitle="Primeiro acesso do treinador"
                    titleStyle={styles.brandTitle}
                    subtitleStyle={styles.brandSubtitle}
                    containerStyle={styles.brandWrap}
                    logoShellStyle={styles.brandLogoShell}
                  />

                  <Text style={styles.eyebrow}>Olá, {displayName}</Text>
                  <Text style={styles.title}>Crie sua consultoria</Text>
                  <Text style={styles.subtitle}>
                    Vamos montar a identidade inicial do seu painel em duas etapas rápidas.
                  </Text>
                </View>

                <View style={styles.progressRow}>
                  <View style={styles.progressTextRow}>
                    <StepBadge step={step} />
                    <Text style={styles.progressLabel}>{progressLabel}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: step === 1 ? '50%' : '100%',
                        },
                      ]}
                    />
                  </View>
                </View>

                {step === 1 ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Identidade visual</Text>
                    <Text style={styles.sectionSubtitle}>
                      Defina nome, banner e imagem principal para aparecer no dashboard.
                    </Text>

                    <Pressable
                      onPress={() => pickImage('banner')}
                      style={({ pressed }) => [styles.bannerPicker, pressed && styles.pressed]}
                    >
                      {bannerAsset ? (
                        <Image source={{ uri: bannerAsset.uri }} style={styles.bannerImage} />
                      ) : (
                        <LinearGradient
                          colors={['rgba(177, 255, 42, 0.18)', 'rgba(88, 233, 118, 0.04)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.emptyBanner}
                        >
                          <MaterialCommunityIcons name="image-plus" size={30} color="#9CF02E" />
                          <Text style={styles.mediaTitle}>Adicionar banner</Text>
                          <Text style={styles.mediaHint}>Imagem larga para o topo da consultoria</Text>
                        </LinearGradient>
                      )}
                      <View style={styles.mediaOverlay}>
                        <Feather name="upload-cloud" size={15} color="#07110B" />
                        <Text style={styles.mediaOverlayText}>
                          {bannerAsset ? 'Trocar banner' : 'Escolher banner'}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.identityRow}>
                      <Pressable
                        onPress={() => pickImage('image')}
                        style={({ pressed }) => [styles.logoPicker, pressed && styles.pressed]}
                      >
                        {imageAsset ? (
                          <Image source={{ uri: imageAsset.uri }} style={styles.logoImage} />
                        ) : (
                          <View style={styles.emptyLogo}>
                            <MaterialCommunityIcons
                              name="account-box-outline"
                              size={32}
                              color="#9CF02E"
                            />
                            <Text style={styles.logoHint}>Imagem</Text>
                          </View>
                        )}
                      </Pressable>

                      <View style={styles.identityCopy}>
                        <Text style={styles.identityTitle}>Imagem principal</Text>
                        <Text style={styles.identityText}>
                          Pode ser sua foto, logo ou marca da consultoria.
                        </Text>
                      </View>
                    </View>

                    <Field
                      label="Nome da consultoria"
                      placeholder="Ex: Strong Life Coaching"
                      value={name}
                      onChangeText={handleNameChange}
                      icon="briefcase"
                      required
                    />
                  </View>
                ) : (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>Contato e presença digital</Text>
                    <Text style={styles.sectionSubtitle}>
                      Esses dados ajudam a completar a apresentação da sua consultoria.
                    </Text>

                    <Field
                      label="WhatsApp"
                      placeholder="Ex: 11 99999-9999"
                      value={whatsapp}
                      onChangeText={handleWhatsappChange}
                      icon="phone"
                      keyboardType="phone-pad"
                    />

                    <Field
                      label="Instagram"
                      placeholder="https://instagram.com/sua_consultoria"
                      value={instagramUrl}
                      onChangeText={handleInstagramChange}
                      icon="instagram"
                      keyboardType="url"
                      autoCapitalize="none"
                    />

                    <Field
                      label="Site ou rede social"
                      placeholder="https://..."
                      value={websiteUrl}
                      onChangeText={handleWebsiteChange}
                      icon="link"
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                  </View>
                )}

                {statusMessage ? <ErrorNotice message={statusMessage} /> : null}

                <View style={styles.actions}>
                  {step === 1 ? (
                    <Pressable
                      onPress={loading ? undefined : handleNextStep}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.primaryShell,
                        pressed && styles.pressed,
                        loading && styles.disabledButton,
                      ]}
                    >
                      <LinearGradient
                        colors={['#B1FF2A', '#58E976']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.primaryButton}
                      >
                        <Feather name="arrow-right" size={18} color="#07110B" />
                        <Text style={styles.primaryText}>Continuar</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <View style={styles.stepActions}>
                      <Pressable
                        onPress={loading ? undefined : () => setStep(1)}
                        disabled={loading}
                        style={({ pressed }) => [
                          styles.secondaryShell,
                          pressed && styles.pressed,
                          loading && styles.disabledButton,
                        ]}
                      >
                        <View style={styles.secondaryButton}>
                          <Feather name="arrow-left" size={18} color="#DCF4C8" />
                          <Text style={styles.secondaryText}>Voltar</Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={loading ? undefined : handleSubmit}
                        disabled={loading}
                        style={({ pressed }) => [
                          styles.primaryShell,
                          pressed && styles.pressed,
                          loading && styles.disabledButton,
                        ]}
                      >
                        <LinearGradient
                          colors={['#B1FF2A', '#58E976']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.primaryButton}
                        >
                          <Feather name="check-circle" size={18} color="#07110B" />
                          <Text style={styles.primaryText}>
                            {loading ? 'Criando consultoria...' : 'Criar consultoria'}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030402',
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.12)',
    backgroundColor: 'rgba(8, 11, 8, 0.86)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
    overflow: 'hidden',
  },
  cardInner: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  badgeText: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  logoutButton: {
    minHeight: 38,
    paddingHorizontal: 13,
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
    fontFamily: 'Sora_600SemiBold',
  },
  heroBlock: {
    gap: 10,
  },
  brandWrap: {
    gap: 10,
  },
  brandLogoShell: {
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  brandTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontFamily: 'Sora_500Medium',
    fontSize: 11,
  },
  eyebrow: {
    color: '#9CF02E',
    fontSize: 12,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#C1CABA',
    fontSize: 14,
    lineHeight: 23,
    fontFamily: 'Sora_400Regular',
  },
  progressRow: {
    gap: 10,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  stepBadgeText: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressLabel: {
    flex: 1,
    textAlign: 'right',
    color: '#C1CABA',
    fontSize: 12,
    fontFamily: 'Sora_500Medium',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  sectionBlock: {
    gap: 14,
  },
  sectionTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    fontFamily: 'Sora_700Bold',
  },
  sectionSubtitle: {
    color: 'rgba(193, 202, 186, 0.8)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
  },
  bannerPicker: {
    minHeight: 178,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  bannerImage: {
    width: '100%',
    height: 178,
    objectFit: 'cover',
  },
  emptyBanner: {
    minHeight: 178,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  mediaTitle: {
    color: '#F3F7EF',
    fontSize: 17,
    fontFamily: 'Sora_700Bold',
  },
  mediaHint: {
    color: 'rgba(193, 202, 186, 0.74)',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
  },
  mediaOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  mediaOverlayText: {
    color: '#07110B',
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoPicker: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  logoImage: {
    width: 96,
    height: 96,
    objectFit: 'cover',
  },
  emptyLogo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  logoHint: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  identityTitle: {
    color: '#F3F7EF',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  identityText: {
    color: 'rgba(193, 202, 186, 0.76)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  fieldBlock: {
    gap: 9,
  },
  fieldLabel: {
    color: '#D7D8D4',
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
  },
  required: {
    color: '#2AD04D',
  },
  inputWrap: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151815',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputWrapFocused: {
    borderColor: 'rgba(64, 228, 94, 0.55)',
    boxShadow: '0 0 0 1px rgba(64, 228, 94, 0.2)',
  },
  input: {
    flex: 1,
    color: '#EEF1EC',
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
    fontFamily: 'Sora_400Regular',
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    textAlignVertical: 'center',
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
  actions: {
    gap: 12,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryShell: {
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(156, 240, 46, 0.32)',
  },
  secondaryShell: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(22, 26, 18, 0.88)',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {
    color: '#07110B',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  secondaryText: {
    color: '#EAF8E4',
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  pressed: {
    opacity: 0.92,
  },
  disabledButton: {
    opacity: 0.7,
  },
});
