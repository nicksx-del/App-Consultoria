import { Platform } from 'react-native';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const APK_DOWNLOAD_URL = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL?.trim() ?? '';

function openDownloadLink() {
  if (!APK_DOWNLOAD_URL) {
    return;
  }

  if (Platform.OS === 'web') {
    window.open(APK_DOWNLOAD_URL, '_blank');
    return;
  }

  void Linking.openURL(APK_DOWNLOAD_URL);
}

function DetailItem({
  icon,
  title,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} size={18} color="#9CF02E" />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailText}>{text}</Text>
      </View>
    </View>
  );
}

export function DownloadScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['rgba(177, 255, 42, 0.2)', 'rgba(8, 12, 8, 0.96)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="download-outline" size={14} color="#061007" />
              <Text style={styles.badgeText}>APK para Android</Text>
            </View>
            <View style={styles.qrCard}>
              <MaterialCommunityIcons name="qrcode" size={34} color="#9CF02E" />
              <Text style={styles.qrText}>QR pronto</Text>
            </View>
          </View>

          <Text style={styles.title}>Baixe o aplicativo da consultoria no celular</Text>
          <Text style={styles.subtitle}>
            A página já está pronta para receber o link do APK. Basta definir a variável
            EXPO_PUBLIC_APK_DOWNLOAD_URL para o botão abrir o arquivo de instalação.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={openDownloadLink}
              disabled={!APK_DOWNLOAD_URL}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                !APK_DOWNLOAD_URL && styles.disabled,
              ]}
            >
              <Feather name="download" size={16} color="#061007" />
              <Text style={styles.primaryButtonText}>
                {APK_DOWNLOAD_URL ? 'Baixar APK' : 'Adicionar link do APK'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.href = '/';
                }
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Voltar ao site</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.grid}>
          <DetailItem
            icon="cellphone"
            title="Instalação rápida"
            text="Depois de baixar, toque no arquivo APK para instalar no Android."
          />
          <DetailItem
            icon="shield-check-outline"
            title="Arquivo sob seu controle"
            text="Você decide onde hospedar o APK: site, Drive, Dropbox, Firebase ou Expo."
          />
          <DetailItem
            icon="link-variant"
            title="Link único"
            text="Quando definir a URL, ela vira a página oficial de download da consultoria."
          />
          <DetailItem
            icon="qrcode-scan"
            title="Compartilhamento fácil"
            text="Use o QR Code para abrir a página no celular com um toque."
          />
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 14,
  },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    padding: 20,
    gap: 16,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.58)',
    shadowColor: '#000',
    shadowOpacity: 0.58,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#9CF02E',
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#061007',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  qrCard: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 12, 8, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
  },
  qrText: {
    marginTop: 2,
    color: 'rgba(220, 244, 200, 0.8)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#F3F7EF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: 'rgba(220, 244, 200, 0.72)',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    backgroundColor: 'rgba(8, 12, 8, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#F3F7EF',
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: 160,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
    backgroundColor: 'rgba(8, 12, 8, 0.76)',
    gap: 10,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.12)',
  },
  detailCopy: {
    gap: 4,
  },
  detailTitle: {
    color: '#F3F7EF',
    fontSize: 14,
    fontWeight: '900',
  },
  detailText: {
    color: 'rgba(220, 244, 200, 0.68)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
