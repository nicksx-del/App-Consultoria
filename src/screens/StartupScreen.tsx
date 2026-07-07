import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthBackground } from '../components/AuthBackground';
import { BrandMark } from '../components/BrandMark';

export function StartupScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <AuthBackground />

      <View style={styles.centerWrap}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(177, 255, 42, 0.18)', 'rgba(88, 233, 118, 0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glow}
          />

          <View style={styles.content}>
            <BrandMark
              size="lg"
              subtitle="Preparando seu acesso"
              titleStyle={styles.brandTitle}
              subtitleStyle={styles.brandSubtitle}
              containerStyle={styles.brandWrap}
              logoShellStyle={styles.brandLogoShell}
            />

            <Text style={styles.title}>Carregando experiência premium</Text>
            <Text style={styles.subtitle}>
              Estamos verificando sua sessão, sincronizando o perfil e deixando o painel pronto.
            </Text>

            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#9CF02E" />
              <Text style={styles.loadingText}>Aguarde alguns segundos</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030402',
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
    maxWidth: 460,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(180, 255, 133, 0.12)',
    backgroundColor: 'rgba(8, 11, 8, 0.88)',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  glow: {
    position: 'absolute',
    top: -32,
    left: -24,
    right: -24,
    height: 180,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 18,
    alignItems: 'center',
  },
  brandWrap: {
    gap: 10,
  },
  brandLogoShell: {
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
  },
  brandTitle: {
    fontSize: 18,
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  title: {
    color: '#F3F7EF',
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitle: {
    color: '#C1CABA',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  loadingRow: {
    marginTop: 6,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(22, 26, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  loadingText: {
    color: '#EAF8E4',
    fontSize: 13,
    fontWeight: '600',
  },
});
