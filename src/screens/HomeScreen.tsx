import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthBackground } from '../components/AuthBackground';
import { BrandMark } from '../components/BrandMark';

const APK_DOWNLOAD_URL = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL?.trim() ?? '';
const FITTO_BANNER = require('../../assets/readme/fitto-banner.png');
const FITTO_MOBILE_HERO = require('../../assets/readme/fitto-mobile-hero.png');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type LoginRole = 'trainer' | 'student';

type HomeScreenProps = {
  onLoginPress: (role: LoginRole) => void;
  onSignupPress: (role: LoginRole) => void;
};

const speechMessages = [
  'Bora evoluir hoje?',
  'Disciplina vence motivação.',
  'Pronto para um novo recorde?',
  'Seu futuro começa agora.',
];

function useIntroMotion() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 560,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [opacity, translateY]);

  return { opacity, translateY };
}

function useHoverScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 16,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return { scale, animateTo };
}

function useSpeechRotation() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % speechMessages.length);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  return speechMessages[index] ?? speechMessages[0];
}

function ActionButton({
  label,
  icon,
  variant,
  onPress,
}: {
  label: string;
  icon: IconName;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}) {
  const { scale, animateTo } = useHoverScale();
function RolePill({ label, helper, icon, onPress }: RolePillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rolePill, pressed && styles.pressedSoft]}
    >
      <View style={styles.roleIconShell}>
        <MaterialCommunityIcons name={icon} size={18} color="#9CF02E" />
      </View>
      <View style={styles.roleCopy}>
        <Text style={styles.roleLabel}>{label}</Text>
        <Text style={styles.roleHelper}>{helper}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="rgba(243, 247, 239, 0.7)" />
    </Pressable>
  );
}

function ActionButton({ label, icon, variant, onPress }: ActionButtonProps) {
  const { scale, animateTo } = useAnimatedScale();
  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={[styles.actionShell, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.03)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [
          styles.actionPressable,
          isPrimary ? styles.primaryAction : styles.secondaryAction,
          pressed && styles.pressedSoft,
        ]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={['#B1FF2A', '#58E976']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryFill}
          >
            <MaterialCommunityIcons name={icon} size={18} color="#07110B" />
            <Text style={styles.primaryActionText}>{label}</Text>
            <Feather name="arrow-right" size={16} color="#07110B" />
          </LinearGradient>
        ) : (
          <View style={styles.secondaryFill}>
            <MaterialCommunityIcons name={icon} size={18} color="#EAF8E4" />
            <Text style={styles.secondaryActionText}>{label}</Text>
            <Feather name="arrow-right" size={16} color="rgba(243, 247, 239, 0.72)" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function PortalCard({
  title,
  description,
  icon,
  bullets,
  onPress,
  onHoverState,
  active,
}: {
  title: string;
  description: string;
  icon: IconName;
  bullets: string[];
  onPress: () => void;
  onHoverState: (state: 'neutral' | 'trainer' | 'student') => void;
  active: boolean;
}) {
  const { scale, animateTo } = useHoverScale();
  const isTrainerCard = title === 'Sou treinador';
  const hoverState = isTrainerCard ? 'trainer' : 'student';

  return (
    <Animated.View style={[styles.portalShell, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.02 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => {
          animateTo(1.03);
          onHoverState(hoverState);
        }}
        onHoverOut={() => {
          animateTo(1);
          onHoverState('neutral');
        }}
        style={({ pressed }) => [styles.portalCard, active && styles.portalCardActive, pressed && styles.pressedSoft]}
      >
        <LinearGradient
          colors={['rgba(156, 240, 46, 0.16)', 'rgba(156, 240, 46, 0.04)', 'rgba(8, 10, 8, 0.92)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.portalGlow}
        />
        <View style={styles.portalTopRow}>
          <View style={styles.portalIcon}>
            <MaterialCommunityIcons name={icon} size={22} color="#07110B" />
          </View>
          <View style={styles.portalArrow}>
            <Feather name="arrow-up-right" size={18} color="#9CF02E" />
          </View>
        </View>
        <Text style={styles.portalTitle}>{title}</Text>
        <Text style={styles.portalDescription}>{description}</Text>
        <View style={styles.portalList}>
          {bullets.map((bullet) => (
            <View key={bullet} style={styles.portalListItem}>
              <View style={styles.portalBullet} />
              <Text style={styles.portalListText}>{bullet}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function BenefitChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.benefitChip}>
      <MaterialCommunityIcons name={icon} size={18} color="#9CF02E" />
      <Text style={styles.benefitChipText}>{label}</Text>
    </View>
  );
}

function FittoHero({ message, compact }: { message: string; compact: boolean }) {
  const floatY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -8,
          duration: 2600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();
  }, [floatY, glow, pulse]);

  return (
    <View style={[styles.heroArtWrap, compact && styles.heroArtWrapCompact]}>
      <Animated.View
        style={[
          styles.heroAura,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.45, 0.8],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1.08],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heroOrbitOne,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.18, 0.34],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heroOrbitTwo,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.12, 0.24],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.heroMascotWrap,
          {
            transform: [
              {
                translateY: floatY,
              },
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.985, 1.01],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={compact ? FITTO_MOBILE_HERO : FITTO_BANNER}
          style={[styles.heroMascot, compact && styles.heroMascotCompact]}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.speechBubble,
          compact && styles.speechBubbleCompact,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.94, 1],
            }),
          },
        ]}
      >
        <View style={styles.speechBubbleTail} />
        <Text style={styles.speechBubbleTitle}>Fala, campeão!</Text>
        <Text style={styles.speechBubbleText}>{message}</Text>
      </Animated.View>
      <View style={styles.heroSparkOne} />
      <View style={styles.heroSparkTwo} />
      <View style={styles.heroSparkThree} />
    </View>
  );
}

export function HomeScreen({ onLoginPress, onSignupPress }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const compact = !isWide;
  const { opacity, translateY } = useIntroMotion();
  const speechMessage = useSpeechRotation();
  const [fittoMood, setFittoMood] = useState<'neutral' | 'trainer' | 'student'>('neutral');
  const fittoCaption =
    fittoMood === 'trainer'
      ? 'Treinador: vamos montar a melhor sessão.'
      : fittoMood === 'student'
        ? 'Aluno: foco na execução e no progresso.'
        : speechMessage;

  return (
    <SafeAreaView style={styles.screen}>
      <AuthBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View
          style={[
            styles.page,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.shell, isWide && styles.shellWide]}>
            <View style={styles.topBar}>
              <BrandMark
                size="md"
                align="left"
                subtitle="Seu mentor fitness"
                titleStyle={styles.brandTitle}
                subtitleStyle={styles.brandSubtitle}
                containerStyle={styles.brandWrap}
                logoShellStyle={styles.brandLogoShell}
              />

              <View style={styles.heroCopy}>
                <View style={styles.badge}>
                  <Feather name="zap" size={12} color="#9CF02E" />
                  <Text style={styles.badgeText}>Experiência premium para treinador e aluno</Text>
                </View>

                <Text style={styles.title}>Treino, dieta e acompanhamento em um só lugar.</Text>
                <Text style={styles.subtitle}>
                  Escolha seu perfil e siga direto para uma experiência feita para uso diário,
                  clara e profissional.
                </Text>
              </View>

              <View style={styles.rolesRow}>
                <RolePill
                  label="Sou treinador"
                  helper="Criar treinos, dieta e acompanhar alunos"
                  icon="account-tie-outline"
                  onPress={() => onLoginPress('trainer')}
                />
                <RolePill
                  label="Sou aluno"
                  helper="Ver treino, dieta e check-ins do dia"
                  icon="account-outline"
                  onPress={() => onLoginPress('student')}
                />
              </View>

              <View style={styles.featureList}>
                {features.map((item) => (
                  <FeatureCard
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    description={item.description}
                  />
                ))}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <ActionButton
                label="Entrar como treinador"
                icon="account-tie-outline"
                variant="primary"
                onPress={() => onLoginPress('trainer')}
              />
              <ActionButton
                label="Entrar como aluno"
                icon="account-outline"
                variant="secondary"
                onPress={() => onLoginPress('student')}
              />
            </View>

            <View style={styles.linksRow}>
              <Text style={styles.linksLabel}>Acesso rápido</Text>
              <View style={styles.linksWrap}>
                <TextLink label="Criar conta" icon="account-plus-outline" onPress={() => onSignupPress('trainer')} />
                <TextLink
                  label="Baixar APK"
                  icon="download-outline"
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.location.href = APK_DOWNLOAD_URL || '/?page=download';
                      return;
                    }

                    if (APK_DOWNLOAD_URL) {
                      void Linking.openURL(APK_DOWNLOAD_URL);
                    }
                  }}
                />
                <TextLink label="Ajuda" icon="help-circle-outline" onPress={() => onLoginPress('trainer')} />
                <TextLink label="Termos" icon="file-document-outline" onPress={() => onLoginPress('trainer')} />
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextLink({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const { scale, animateTo } = useHoverScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.03 : 0.985)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.03)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.textLink, pressed && styles.pressedSoft]}
      >
        <MaterialCommunityIcons name={icon} size={14} color="#9CF02E" />
        <Text style={styles.textLinkText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020302',
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  shell: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    gap: 18,
  },
  shellWide: {
    maxWidth: 1120,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandWrap: {
    gap: 8,
  },
  brandLogoShell: {
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  brandTitle: {
    color: '#F3F7EF',
    fontSize: 18,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    color: 'rgba(193, 202, 186, 0.78)',
    fontSize: 11,
    fontFamily: 'Sora_500Medium',
  },
  heroCopyBlock: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  heroTitle: {
    color: '#F3F7EF',
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.9,
    maxWidth: 720,
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 34,
    maxWidth: 360,
  },
  heroAccent: {
    color: '#9CF02E',
  },
  heroSubtitle: {
    color: 'rgba(193, 202, 186, 0.82)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
    maxWidth: 560,
  },
  heroSubtitleCompact: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
  },
  heroArtWrap: {
    position: 'relative',
    alignSelf: 'center',
    width: '100%',
    minHeight: 380,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(7, 10, 8, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroArtWrapCompact: {
    minHeight: 480,
  },
  heroAura: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 420,
    backgroundColor: 'rgba(156, 240, 46, 0.16)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.3,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  heroOrbitOne: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 520,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
  },
  heroOrbitTwo: {
    position: 'absolute',
    width: 650,
    height: 650,
    borderRadius: 650,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.08)',
  },
  heroMascotWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMascot: {
    width: '100%',
    maxWidth: 880,
    height: 420,
    marginTop: 8,
  },
  heroMascotCompact: {
    maxWidth: 360,
    height: 440,
    marginTop: -6,
  },
  speechBubble: {
    position: 'absolute',
    right: 18,
    top: '36%',
    maxWidth: 240,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 16, 12, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.55)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  speechBubbleCompact: {
    right: 12,
    top: 28,
    maxWidth: 174,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  speechBubbleTail: {
    position: 'absolute',
    left: -8,
    top: 46,
    width: 16,
    height: 16,
    backgroundColor: 'rgba(12, 16, 12, 0.9)',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.55)',
    transform: [{ rotate: '45deg' }],
  },
  speechBubbleTitle: {
    color: '#9CF02E',
    fontSize: 18,
    fontFamily: 'Sora_800ExtraBold',
  },
  speechBubbleText: {
    marginTop: 6,
    color: '#F3F7EF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_500Medium',
  },
  heroSparkOne: {
    position: 'absolute',
    left: '8%',
    top: '28%',
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  heroSparkTwo: {
    position: 'absolute',
    right: '12%',
    top: '22%',
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  heroSparkThree: {
    position: 'absolute',
    left: '14%',
    bottom: '18%',
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  portalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  portalShell: {
    flexGrow: 1,
    flexBasis: 340,
    minWidth: 0,
  },
  portalCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 248,
    padding: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(12, 15, 12, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    gap: 14,
  },
  portalCardActive: {
    borderColor: 'rgba(177, 255, 42, 0.55)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  portalGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.92,
  },
  portalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  portalIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  portalArrow: {
    width: 42,
    height: 42,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  portalTitle: {
    color: '#F3F7EF',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
  },
  portalDescription: {
    color: 'rgba(193, 202, 186, 0.82)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Sora_400Regular',
    maxWidth: 420,
  },
  portalList: {
    gap: 10,
    paddingTop: 4,
  rolesRow: {
    width: '100%',
    gap: 10,
  },
  rolePill: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(22, 26, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(146, 255, 68, 0.16)',
  },
  roleIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  roleCopy: {
    flex: 1,
    gap: 2,
  },
  roleLabel: {
    color: '#F3F7EF',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  roleHelper: {
    color: 'rgba(193, 202, 186, 0.74)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Sora_400Regular',
  },
  featureList: {
    gap: 12,
  },
  portalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  portalBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  portalListText: {
    color: '#EAF8E4',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_600SemiBold',
  },
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  benefitChipText: {
    color: '#EAF8E4',
    fontSize: 12,
    fontFamily: 'Sora_600SemiBold',
  },
  footerCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerQuote: {
    color: '#F3F7EF',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
  },
  footerText: {
    color: 'rgba(193, 202, 186, 0.8)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
  },
  footerHeart: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  actionsRow: {
    gap: 12,
  },
  actionShell: {
    borderRadius: 18,
  },
  actionPressable: {
    borderRadius: 18,
  },
  primaryAction: {
    shadowColor: '#9CF02E',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  secondaryAction: {
    backgroundColor: 'rgba(18, 21, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  primaryFill: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryActionText: {
    color: '#07110B',
    fontSize: 15,
    fontFamily: 'Sora_800ExtraBold',
  },
  secondaryFill: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryActionText: {
    color: '#EEF4E7',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
  linksRow: {
    gap: 10,
    paddingBottom: 4,
  },
  linksLabel: {
    color: 'rgba(201, 233, 176, 0.72)',
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    alignSelf: 'center',
  },
  linksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  textLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  textLinkText: {
    color: 'rgba(234, 248, 228, 0.82)',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
  },
  pressedSoft: {
    opacity: 0.94,
  },
});
