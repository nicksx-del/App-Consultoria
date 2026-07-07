import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

function readExpoConfigValue(key: string) {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const env = process.env as Record<string, string | undefined>;
  return extra?.[key] ?? env[key] ?? '';
}

const supabaseUrl = readExpoConfigValue('EXPO_PUBLIC_SUPABASE_URL');
const supabasePublishableKey = readExpoConfigValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const supabaseAnonKey = readExpoConfigValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || supabaseAnonKey || 'sb_publishable_placeholder',
  {
    auth: {
      storage: AsyncStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
