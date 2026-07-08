import { useRef } from 'react';
import type { ComponentProps } from 'react';
import {
  Animated,
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

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type LoginRole = 'trainer' | 'student';

type HomeScreenProps = {
  onLoginPress: (role: LoginRole) => void;
  onSignupPress: (role: LoginRole) => void;
};

type FeatureCardProps = {
  icon: IconName;
  title: string;
  description: string;
};

type ActionButtonProps = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  variant: 'primary' | 'secondary' | 'ghost';
  onPress: () => void;
};

const APK_DOWNLOAD_URL = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL?.trim() ?? '';

function useAnimatedScale() {
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

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconShell}>
        <MaterialCommunityIcons name={icon} size={18} color="#9CF02E" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, icon, variant, onPress }: ActionButtonProps) {
  const { scale, animateTo } = useAnimatedScale();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  const content = isPrimary ? (
    <LinearGradient
      colors={['#B1FF2A', '#58E976']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryFill}
    >
      <View style={styles.buttonIconShell}>
        <MaterialCommunityIcons name={icon} size={18} color="#07110B" />
      </View>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </LinearGradient>
  ) : (
    <View style={[styles.secondaryFill, isGhost && styles.ghostFill]}>
      <View style={styles.buttonIconShell}>
        <MaterialCommunityIcons name={icon} size={18} color={isGhost ? '#9CF02E' : '#EEF4E7'} />
      </View>
      <Text style={[styles.secondaryButtonText, isGhost && styles.ghostButtonText]}>{label}</Text>
    </View>
  );

  return (
    <Animated.View style={[styles.buttonShell, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(Platform.OS === 'web' ? 1.03 : 0.98)}
        onPressOut={() => animateTo(1)}
        onHoverIn={() => animateTo(1.03)}
        onHoverOut={() => animateTo(1)}
        style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressedSoft]}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

function FeatureStat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: IconName;
}) {
  return (
    <View style={styles.featureStat}>
      <View style={styles.featureStatIcon}>
        <MaterialCommunityIcons name={icon} size={15} color="#9CF02E" />
      </View>
      <Text style={styles.featureStatValue}>{value}</Text>
      <Text style={styles.featureStatLabel}>{label}</Text>
    </View>
  );
}

function PreviewMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.previewMetric}>
      <Text style={[styles.previewMetricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.previewMetricLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%` }]} />
    </View>
  );
}

function PreviewPanel() {
  return (
    <View style={styles.previewPanel}>
      <LinearGradient
        colors={['rgba(177, 255, 42, 0.12)', 'rgba(88, 233, 118, 0.04)', 'rgba(6, 8, 6, 0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.previewGlow}
      />

      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewEyebrow}>Visão da experiência</Text>
          <Text style={styles.previewTitle}>Tudo pronto para o treino do dia</Text>
        </View>
        <View style={styles.previewStatusPill}>
          <View style={styles.previewStatusDot} />
          <Text style={styles.previewStatusText}>Online</Text>
        </View>
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewCardTop}>
          <View style={styles.previewAvatar}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={18} color="#07110B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewCardLabel}>Sessão recomendada</Text>
            <Text style={styles.previewCardTitle}>Treino de força + mobilidade</Text>
          </View>
        </View>

        <View style={styles.previewChecks}>
          <View style={styles.previewCheckRow}>
            <Feather name="check-circle" size={14} color="#9CF02E" />
            <Text style={styles.previewCheckText}>Treino liberado</Text>
          </View>
          <View style={styles.previewCheckRow}>
            <Feather name="check-circle" size={14} color="#9CF02E" />
            <Text style={styles.previewCheckText}>Dieta sincronizada</Text>
          </View>
          <View style={styles.previewCheckRow}>
            <Feather name="check-circle" size={14} color="#9CF02E" />
            <Text style={styles.previewCheckText}>Progresso atualizado</Text>
          </View>
        </View>
      </View>

      <View style={styles.previewRow}>
        <PreviewMetric label="Aderência" value="94%" accent="#B1FF2A" />
        <PreviewMetric label="Check-ins" value="+18" accent="#58E976" />
        <PreviewMetric label="Hoje" value="7/7" accent="#EAF8E4" />
      </View>

      <View style={styles.previewInsight}>
        <View style={styles.previewInsightHeader}>
          <Text style={styles.previewInsightTitle}>Resumo rápido</Text>
          <Text style={styles.previewInsightValue}>+12% esta semana</Text>
        </View>
        <View style={styles.miniChart}>
          <View style={[styles.chartBar, { height: 18 }]} />
          <View style={[styles.chartBar, { height: 34 }]} />
          <View style={[styles.chartBar, { height: 26 }]} />
          <View style={[styles.chartBar, { height: 46 }]} />
          <View style={[styles.chartBar, { height: 30 }]} />
          <View style={[styles.chartBar, { height: 52 }]} />
        </View>
      </View>
    </View>
  );
}

export function HomeScreen({ onLoginPress, onSignupPress }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  const features = [
    {
      icon: 'dumbbell',
      title: 'Treino organizado',
      description: 'Acompanhe a execução, os treinos e o histórico do aluno em um só lugar.',
    },
    {
      icon: 'food-apple-outline',
      title: 'Dieta integrada',
      description: 'Una prescrição, acompanhamento alimentar e evolução em uma experiência clara.',
    },
    {
      icon: 'chart-line',
      title: 'Progresso visível',
      description: 'Veja a jornada do aluno com mais consistência, contexto e presença do treinador.',
    },
  ] as const;

  return (
    <SafeAreaView style={styles.screen}>
      <AuthBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.pageWrap}>
          <View style={[styles.card, isWide && styles.cardWide]}>
            <LinearGradient
              colors={['rgba(177, 255, 42, 0.18)', 'rgba(88, 233, 118, 0.02)', 'rgba(0, 0, 0, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGlow}
            />

            <View style={[styles.cardInner, isWide && styles.cardInnerWide]}>
              <View style={[styles.heroColumn, isWide && styles.heroColumnWide]}>
                <BrandMark
                  size="lg"
                  align="left"
                  subtitle="Consultoria fitness mobile"
                  titleStyle={styles.brandTitle}
                  subtitleStyle={styles.brandSubtitle}
                  containerStyle={styles.brandWrap}
                  logoShellStyle={styles.brandLogoShell}
                />

                <View style={styles.heroCopy}>
                  <View style={styles.heroTopline}>
                    <View style={styles.heroDot} />
                    <Text style={styles.heroToplineText}>
                      Tela inicial reformulada para ficar mais clara e sofisticada
                    </Text>
                  </View>

                  <Text style={styles.title}>Treino, dieta e acompanhamento em um só lugar.</Text>
                  <Text style={styles.subtitle}>
                    Entre como treinador ou aluno e siga direto para uma experiência feita para uso
                    diário, clara e profissional.
                  </Text>
                </View>

                <View style={styles.featureStatsRow}>
                  <FeatureStat value="1 painel" label="para gestão" icon="view-dashboard-outline" />
                  <FeatureStat value="3 fluxos" label="em um app" icon="account-group-outline" />
                  <FeatureStat value="100%" label="mobile first" icon="cellphone" />
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

                <View style={styles.actions}>
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
                  <ActionButton
                    label="Baixar APK"
                    icon="download-outline"
                    variant="ghost"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.location.href = APK_DOWNLOAD_URL || '/?page=download';
                      }
                    }}
                  />
                  <ActionButton
                    label="Criar conta de treinador"
                    icon="account-plus-outline"
                    variant="ghost"
                    onPress={() => onSignupPress('trainer')}
                  />
                </View>

                <View style={styles.supportStrip}>
                  <View style={styles.supportItem}>
                    <Text style={styles.supportLabel}>Fluxo</Text>
                    <Text style={styles.supportValue}>Treinador cria, aluno acompanha</Text>
                  </View>
                  <View style={styles.supportDivider} />
                  <View style={styles.supportItem}>
                    <Text style={styles.supportLabel}>Tempo</Text>
                    <Text style={styles.supportValue}>Entrada rápida, sem ruído visual</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.previewColumn, isWide && styles.previewColumnWide]}>
                <PreviewPanel />

                <View style={styles.detailRail}>
                  <View style={styles.detailBand}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Acesso</Text>
                      <Text style={styles.detailValue}>Rápido e direto</Text>
                    </View>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Foco</Text>
                      <Text style={styles.detailValue}>Treino e acompanhamento</Text>
                    </View>
                  </View>
                  <View style={styles.previewMicroCard}>
                    <View style={styles.previewMicroHeader}>
                      <Text style={styles.previewMicroTitle}>Fluxo pensado para o dia a dia</Text>
                      <MaterialCommunityIcons name="arrow-top-right" size={14} color="#9CF02E" />
                    </View>
                    <Text style={styles.previewMicroText}>
                      Tela inicial com leitura rápida, menos blocos competindo e ações mais evidentes.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030402',
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 840,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.14)',
    backgroundColor: 'rgba(7, 10, 8, 0.9)',
    overflow: 'hidden',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.68)',
    shadowColor: '#000',
    shadowOpacity: 0.62,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 14,
  },
  cardWide: {
    maxWidth: 1180,
  },
  cardGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 260,
  },
  cardInner: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 22,
  },
  cardInnerWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 28,
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  heroColumn: {
    gap: 18,
  },
  heroColumnWide: {
    flex: 1.08,
    minWidth: 0,
  },
  previewColumn: {
    gap: 14,
  },
  previewColumnWide: {
    flex: 0.92,
    minWidth: 0,
    paddingTop: 4,
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
  heroCopy: {
    gap: 14,
  },
  heroTopline: {
    alignSelf: 'flex-start',
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
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  heroToplineText: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'left',
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.6,
    maxWidth: 610,
  },
  subtitle: {
    color: '#C1CABA',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
    maxWidth: 610,
    fontFamily: 'Sora_400Regular',
  },
  featureStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureStat: {
    flexGrow: 1,
    flexBasis: 128,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  featureStatIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  featureStatValue: {
    color: '#F3F7EF',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Sora_700Bold',
  },
  featureStatLabel: {
    color: 'rgba(193, 202, 186, 0.8)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureList: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontFamily: 'Sora_700Bold',
  },
  featureDescription: {
    color: 'rgba(193, 202, 186, 0.8)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  actions: {
    gap: 12,
  },
  buttonShell: {
    borderRadius: 16,
  },
  buttonPressable: {
    borderRadius: 16,
  },
  pressedSoft: {
    opacity: 0.94,
  },
  primaryFill: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryFill: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(22, 26, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(146, 255, 68, 0.18)',
  },
  ghostFill: {
    backgroundColor: 'rgba(22, 26, 18, 0.58)',
    borderStyle: 'dashed',
  },
  buttonIconShell: {
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
  secondaryButtonText: {
    color: '#EEF4E7',
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.1,
  },
  ghostButtonText: {
    color: '#DFF7C9',
  },
  supportStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  supportItem: {
    flex: 1,
    flexBasis: 180,
    gap: 4,
  },
  supportLabel: {
    color: 'rgba(193, 202, 186, 0.68)',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  supportValue: {
    color: '#F3F7EF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_600SemiBold',
  },
  supportDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  previewPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(10, 12, 10, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.12)',
    gap: 14,
  },
  previewGlow: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 260,
    height: 220,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewEyebrow: {
    color: 'rgba(201, 233, 176, 0.7)',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewTitle: {
    marginTop: 5,
    color: '#F3F7EF',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Sora_700Bold',
    letterSpacing: -0.2,
  },
  previewStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.15)',
  },
  previewStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  previewStatusText: {
    color: '#EAF8E4',
    fontSize: 11,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  previewCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 14,
  },
  previewCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  previewCardLabel: {
    color: 'rgba(193, 202, 186, 0.74)',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  previewCardTitle: {
    marginTop: 4,
    color: '#F3F7EF',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Sora_700Bold',
  },
  previewChecks: {
    gap: 8,
  },
  previewCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewCheckText: {
    color: '#EAF8E4',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_500Medium',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewMetric: {
    flexGrow: 1,
    flexBasis: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  previewMetricValue: {
    fontSize: 19,
    lineHeight: 23,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.2,
  },
  previewMetricLabel: {
    marginTop: 4,
    color: 'rgba(193, 202, 186, 0.74)',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Sora_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  previewInsight: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 14,
  },
  previewInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewInsightTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Sora_700Bold',
  },
  previewInsightValue: {
    color: '#9CF02E',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Sora_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  miniChart: {
    height: 92,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  chartBar: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.84)',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  detailBand: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailRail: {
    gap: 10,
  },
  detailItem: {
    flex: 1,
    gap: 4,
  },
  detailDivider: {
    width: 1,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailLabel: {
    color: 'rgba(193, 202, 186, 0.68)',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  detailValue: {
    color: '#F3F7EF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_600SemiBold',
  },
  previewMicroCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    gap: 8,
  },
  previewMicroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewMicroTitle: {
    flex: 1,
    color: '#F3F7EF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Sora_700Bold',
  },
  previewMicroText: {
    color: 'rgba(193, 202, 186, 0.8)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
});
