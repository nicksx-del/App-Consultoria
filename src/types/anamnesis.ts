export type AnamnesisStatus = 'draft' | 'completed';

export type AnamnesisAnswers = Record<string, string>;

export type StudentAnamnesis = {
  id: string;
  studentId: string;
  trainerId: string;
  consultancyId: string;
  status: AnamnesisStatus;
  answers: AnamnesisAnswers;
  dismissedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveAnamnesisPayload = {
  answers: AnamnesisAnswers;
  status: AnamnesisStatus;
  dismissedAt: string | null;
  completedAt: string | null;
};

export type AnamnesisQuestion = {
  id: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
};

export type AnamnesisSection = {
  id: string;
  title: string;
  description: string;
  questions: AnamnesisQuestion[];
};

export type AnamnesisProgress = {
  answered: number;
  total: number;
  percent: number;
  completed: boolean;
};
