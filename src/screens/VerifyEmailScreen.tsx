import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthBackground } from '../components/AuthBackground';
import { BrandMark } from '../components/BrandMark';

type VerifyEmailScreenProps = {
  email?: string;
  onBackToLogin: () => void;
};

export function VerifyEmailScreen({ email, onBackToLogin }: VerifyEmailScreenProps) {
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
            <View style={styles.cardInner}>
              <View style={styles.iconShell}>
                <MaterialCommunityIcons name="email-check-outline" size={34} color="#07110B" />
              </View>

              <BrandMark
                size="sm"
                subtitle="Confirmação de conta"
                titleStyle={styles.brandTitle}
                subtitleStyle={styles.brandSubtitle}
                containerStyle={styles.brandWrap}
              />

              <Text style={styles.title}>Verifique seu e-mail</Text>
              <Text style={styles.subtitle}>
                Enviamos um link de confirmação para {email ? email : 'o e-mail informado'}.
                Depois de confirmar, volte para entrar na sua conta.
              </Text>

              <View style={styles.tipBox}>
                <Feather name="info" size={15} color="#9CF02E" />
                <Text style={styles.tipText}>
                  Se não encontrar a mensagem, confira spam, promoções ou lixo eletrônico.
                </Text>
              </View>

              <Pressable onPress={onBackToLogin} style={styles.buttonPressable}>
                <LinearGradient
                  colors={['#B1FF2A', '#58E976']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Feather name="arrow-left" size={18} color="#07110B" />
                  <Text style={styles.primaryText}>Voltar para login</Text>
                </LinearGradient>
              </Pressable>
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
    maxWidth: 520,
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
  },
  cardInner: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 30,
    gap: 16,
  },
  iconShell: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CF02E',
    boxShadow: '0 14px 34px rgba(156, 240, 46, 0.34)',
  },
  brandWrap: {
    gap: 8,
  },
  brandTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontFamily: 'Sora_500Medium',
    fontSize: 10,
  },
  title: {
    color: '#F3F7EF',
    fontSize: 30,
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
    fontFamily: 'Sora_400Regular',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  tipText: {
    flex: 1,
    color: 'rgba(222, 231, 216, 0.82)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Sora_400Regular',
  },
  buttonPressable: {
    width: '100%',
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(156, 240, 46, 0.32)',
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
  primaryText: {
    color: '#07110B',
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
  },
});
