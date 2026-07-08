import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center';
  subtitle?: string;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  logoShellStyle?: StyleProp<ViewStyle>;
};

const SIZE_MAP = {
  sm: {
    shell: 44,
    image: 28,
    title: 14,
    subtitle: 10,
  },
  md: {
    shell: 58,
    image: 38,
    title: 17,
    subtitle: 11,
  },
  lg: {
    shell: 78,
    image: 52,
    title: 19,
    subtitle: 12,
  },
} as const;

export function BrandMark({
  size = 'md',
  align = 'center',
  subtitle,
  titleStyle,
  subtitleStyle,
  containerStyle,
  logoShellStyle,
}: BrandMarkProps) {
  const sizeStyle = SIZE_MAP[size];
  const centered = align === 'center';

  return (
    <View style={[styles.container, centered && styles.center, containerStyle]}>
      <View
        style={[
          styles.logoShell,
          {
            width: sizeStyle.shell,
            height: sizeStyle.shell,
            borderRadius: sizeStyle.shell * 0.32,
          },
          logoShellStyle,
        ]}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={[
            styles.logo,
            {
              width: sizeStyle.image,
              height: sizeStyle.image,
              borderRadius: sizeStyle.image * 0.22,
            },
          ]}
        />
      </View>

      <View style={[styles.copy, centered && styles.centerCopy]}>
        <Text
          style={[
            styles.title,
            {
              fontSize: sizeStyle.title,
            },
            titleStyle,
          ]}
        >
          Aplicativo-Consultoria
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: sizeStyle.subtitle,
              },
              subtitleStyle,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  center: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logoShell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    overflow: 'hidden',
  },
  logo: {
    resizeMode: 'cover',
  },
  copy: {
    flexShrink: 1,
    gap: 3,
  },
  centerCopy: {
    alignItems: 'center',
  },
  title: {
    color: '#F3F7EF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(193, 202, 186, 0.82)',
    lineHeight: 16,
    fontWeight: '500',
  },
});
