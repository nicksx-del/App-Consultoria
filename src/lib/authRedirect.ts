import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

type SupabaseUrlSession = {
  access_token: string;
  refresh_token: string;
};

export function getAuthRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return Linking.createURL('auth/callback');
}

export function getSupabaseSessionFromUrl(url: string): SupabaseUrlSession | null {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const params = new URLSearchParams(hash || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}
