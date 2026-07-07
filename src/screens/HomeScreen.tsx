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

type RolePillProps = {
  label: string;
  helper: string;
  icon: IconName;
  onPress: () => void;
};

type ActionButtonProps = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  variant: 'primary' | 'secondary' | 'ghost';
  onPress: () => void;
};

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

export function HomeScreen({ onLoginPress, onSignupPress }: HomeScreenProps) {
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
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(177, 255, 42, 0.12)', 'rgba(88, 233, 118, 0.0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGlow}
            />

            <View style={styles.cardInner}>
              <BrandMark
                size="lg"
                subtitle="Consultoria fitness mobile"
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
                      window.location.href = '/?page=download';
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

              <View style={styles.footerNote}>
                <Feather name="info" size={13} color="#9CF02E" />
                <Text style={styles.footerText}>
                  Contas de aluno são criadas pelo treinador no fluxo de gestão.
                </Text>
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
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 640,
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
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  cardInner: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 20,
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
    alignItems: 'center',
  },
  badge: {
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
  badgeText: {
    color: '#C9E9B0',
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 30,
    lineHeight: 35,
    textAlign: 'center',
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.4,
    maxWidth: 560,
  },
  subtitle: {
    color: '#C1CABA',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 560,
    fontFamily: 'Sora_400Regular',
  },
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
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 2,
  },
  footerText: {
    flex: 1,
    color: 'rgba(193, 202, 186, 0.76)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
});
