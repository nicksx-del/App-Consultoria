import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Animated,
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthBackground } from '../components/AuthBackground';
import { BrandMark } from '../components/BrandMark';
import type { AuthRole, LoginPayload } from '../types/auth';

type LoginScreenProps = {
  role: AuthRole;
  loading?: boolean;
  errorMessage?: string | null;
  onBack: () => void;
  onSubmit: (payload: LoginPayload) => void;
  onSignUpPress: () => void;
};

type InputProps = {
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
  autoComplete?: ComponentProps<typeof TextInput>['autoComplete'];
  autoCorrect?: boolean;
  textContentType?: ComponentProps<typeof TextInput>['textContentType'];
};

type PrimaryButtonProps = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

function useAnimatedScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 15,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return { scale, animateTo };
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { scale, animateTo } = useAnimatedScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.03 : 0.98)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.03)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressedSoft]}
      >
        <Feather name="arrow-left" size={15} color="#DCF4C8" />
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>
    </Animated.View>
  );
}

function RoleChip({ role }: { role: AuthRole }) {
  const roleText = role === 'trainer' ? 'Treinador' : 'Aluno';
  const roleIcon = role === 'trainer' ? 'account-tie-outline' : 'account-outline';

  return (
    <View style={styles.roleChip}>
      <MaterialCommunityIcons name={roleIcon} size={14} color="#9CF02E" />
      <Text style={styles.roleChipText}>Acesso para {roleText}</Text>
    </View>
  );
}

function Field({
  label,
  placeholder,
  secureTextEntry,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  autoComplete,
  autoCorrect = false,
  textContentType,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label}
        <Text style={styles.required}>*</Text>
      </Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="rgba(193, 202, 186, 0.28)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry ? hidden : false}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          selectionColor="#9CF02E"
          caretHidden={false}
          style={[
            styles.input,
            Platform.OS === 'web'
              ? ({ appearance: 'none', WebkitAppearance: 'none', outline: 'none' } as any)
              : null,
          ]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((current) => !current)} hitSlop={10}>
            <MaterialCommunityIcons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="rgba(236, 236, 236, 0.42)"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PrimaryButton({ icon, label, disabled, onPress }: PrimaryButtonProps) {
  const { scale, animateTo } = useAnimatedScale();

  return (
    <Animated.View
      style={[
        styles.primaryShell,
        {
          transform: [
            {
              scale,
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.98)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.02)}
        onHoverOut={() => animateTo(1)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.primaryPressable,
          pressed && styles.pressedStrong,
          disabled && styles.disabledButton,
        ]}
      >
        <LinearGradient
          colors={['#B1FF2A', '#58E976']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryButton}
        >
          <View style={styles.primaryIconShell}>
            <Feather name={icon} size={18} color="#07110B" />
          </View>
          <Text style={styles.primaryButtonText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
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

function StudentSignupNotice() {
  return (
    <View style={styles.studentNotice}>
      <Feather name="lock" size={14} color="#9CF02E" />
      <Text style={styles.studentNoticeText}>
        A conta de aluno precisa ser criada pelo treinador antes do primeiro acesso.
      </Text>
    </View>
  );
}

function SecondaryLink({
  prefix,
  label,
  accent,
  onPress,
}: {
  prefix: string;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.secondaryText}>
        {prefix} <Text style={[styles.secondaryLink, { color: accent }]}>{label}</Text>
      </Text>
    </Pressable>
  );
}

export function LoginScreen({
  role,
  loading = false,
  errorMessage,
  onBack,
  onSubmit,
  onSignUpPress,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isTrainer = role === 'trainer';

  const handleSubmit = () => {
    onSubmit({
      email,
      password,
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
                <View style={styles.headerRow}>
                  <BackButton onPress={onBack} />
                </View>

                <View style={styles.heroBlock}>
                  <BrandMark
                    size="md"
                    subtitle="Acesso seguro"
                    titleStyle={styles.brandTitle}
                    subtitleStyle={styles.brandSubtitle}
                    containerStyle={styles.brandWrap}
                    logoShellStyle={styles.brandLogoShell}
                  />

                  <RoleChip role={role} />
                  <Text style={styles.title}>Bem-vindo de volta</Text>
                  <Text style={styles.subtitle}>Entre com sua conta para continuar.</Text>
                </View>

                <View style={styles.fieldList}>
                  <Field
                    label="E-mail"
                    placeholder="Digite seu e-mail"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    textContentType="emailAddress"
                  />

                  <Field
                    label="Senha"
                    placeholder="Digite sua senha"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    textContentType="password"
                  />
                </View>

                {errorMessage ? <ErrorNotice message={errorMessage} /> : null}

                <PrimaryButton
                  icon="arrow-right"
                  label={loading ? 'Entrando...' : 'Entrar'}
                  disabled={loading}
                  onPress={handleSubmit}
                />

                {isTrainer ? (
                  <SecondaryLink
                    prefix="Ainda não tem uma conta?"
                    label="Criar conta"
                    accent="#33d35c"
                    onPress={onSignUpPress}
                  />
                ) : (
                  <StudentSignupNotice />
                )}
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
    maxWidth: 588,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.12)',
    backgroundColor: 'rgba(8, 11, 8, 0.86)',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  cardInner: {
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backButton: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(22, 26, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    boxShadow: '0 10px 22px rgba(0, 0, 0, 0.28)',
  },
  backButtonText: {
    color: '#EAF8E4',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.4,
  },
  heroBlock: {
    gap: 12,
    alignItems: 'center',
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
  roleChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  roleChipText: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#C1CABA',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 500,
    fontFamily: 'Sora_400Regular',
  },
  fieldList: {
    gap: 14,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    color: '#D7D8D4',
    fontSize: 14,
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
    justifyContent: 'space-between',
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
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 0,
    fontFamily: 'Sora_400Regular',
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    textAlignVertical: 'center',
  },
  primaryShell: {
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(156, 240, 46, 0.32)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  primaryPressable: {
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.72,
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
  primaryIconShell: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#07110B',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.1,
  },
  pressedSoft: {
    opacity: 0.93,
  },
  pressedStrong: {
    opacity: 0.96,
  },
  secondaryText: {
    color: 'rgba(193, 202, 186, 0.72)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
  },
  secondaryLink: {
    color: '#33D35C',
    fontFamily: 'Sora_700Bold',
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
  studentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
  },
  studentNoticeText: {
    flex: 1,
    color: 'rgba(193, 202, 186, 0.74)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
  },
});
