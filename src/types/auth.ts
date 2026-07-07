export type AuthRole = 'trainer' | 'student';

export type AppScreen = 'home' | 'login' | 'signup' | 'verify-email';

export type Profile = {
  id: string;
  role: AuthRole;
  full_name: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};
