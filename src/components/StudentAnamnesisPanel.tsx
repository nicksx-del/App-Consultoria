import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import {
  anamnesisSections,
  createPrefilledAnamnesisAnswers,
  getAnamnesisProgress,
} from '../lib/anamnesis';
import type { Profile } from '../types/auth';
import type { SaveAnamnesisPayload, StudentAnamnesis } from '../types/anamnesis';
import type { Student } from '../types/student';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type StudentAnamnesisPanelProps = {
  student: Student;
  profile: Profile;
  anamnesis: StudentAnamnesis | null;
  loading: boolean;
  saving: boolean;
  errorMessage?: string | null;
  canEdit: boolean;
  prompt?: boolean;
  onSave: (payload: SaveAnamnesisPayload) => Promise<StudentAnamnesis | void> | StudentAnamnesis | void;
  onClosePrompt?: () => void;
  onDismissPrompt?: () => void;
};

const sectionIcons: Record<string, IconName> = {
  personal: 'account-heart-outline',
  routine: 'clock-outline',
  training: 'weight-lifter',
  health: 'medical-bag',
  nutrition: 'food-apple-outline',
  notes: 'message-text-outline',
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Ainda nao concluida';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function StudentAnamnesisPanel({
  student,
  profile,
  anamnesis,
  loading,
  saving,
  errorMessage,
  canEdit,
  prompt = false,
  onSave,
  onClosePrompt,
  onDismissPrompt,
}: StudentAnamnesisPanelProps) {
  const [draftAnswers, setDraftAnswers] = useState(() =>
    createPrefilledAnamnesisAnswers(student, anamnesis?.answers ?? {}),
  );
  const [openSections, setOpenSections] = useState<string[]>(['personal', 'routine']);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const progress = useMemo(() => getAnamnesisProgress(draftAnswers), [draftAnswers]);
  const readonly = !canEdit || loading;
  const completed = anamnesis?.status === 'completed' || progress.completed;
  const combinedError = localError || errorMessage;
  const progressLabel = progress.completed ? 'Tudo preenchido' : `${progress.total - progress.answered} pendentes`;

  useEffect(() => {
    setDraftAnswers(createPrefilledAnamnesisAnswers(student, anamnesis?.answers ?? {}));
    setDirty(false);
  }, [student.id, anamnesis?.id, anamnesis?.updatedAt]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId],
    );
  };

  const updateAnswer = (questionId: string, value: string) => {
    setLocalError(null);
    setDirty(true);
    setDraftAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const saveAnswers = async (status: 'draft' | 'completed', dismissedAt = anamnesis?.dismissedAt ?? null) => {
    if (status === 'completed' && !progress.completed) {
      setLocalError(`Preencha as ${progress.total} respostas antes de concluir. Faltam ${progress.total - progress.answered}.`);
      return;
    }

    setLocalError(null);

    const completedAt = status === 'completed' ? anamnesis?.completedAt ?? new Date().toISOString() : anamnesis?.completedAt ?? null;
    const saved = await onSave({
      answers: draftAnswers,
      status,
      dismissedAt,
      completedAt,
    });

    if (saved) {
      setDirty(false);
    }

    if (prompt && status === 'completed') {
      onClosePrompt?.();
    }
  };

  const dismissForever = async () => {
    const dismissedAt = new Date().toISOString();

    await onSave({
      answers: draftAnswers,
      status: anamnesis?.status ?? 'draft',
      dismissedAt,
      completedAt: anamnesis?.completedAt ?? null,
    });

    setDirty(false);
    onDismissPrompt?.();
  };

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color="#9CF02E" />
        <Text style={styles.loadingText}>Abrindo anamnese...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, prompt && styles.promptContainer]}>
      <LinearGradient
        colors={prompt ? ['rgba(156, 240, 46, 0.22)', 'rgba(6, 12, 7, 0.96)'] : ['rgba(156, 240, 46, 0.16)', 'rgba(6, 12, 7, 0.88)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={25} color="#061007" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>{prompt ? 'Antes de continuar' : 'Anamnese do aluno'}</Text>
          <Text style={styles.title}>{prompt ? 'Conte sua rotina para o coach' : 'Dados do aluno'}</Text>
          <Text style={styles.subtitle}>
            {prompt
              ? 'Essas respostas ajudam a montar treino, dieta, cardio e ajustes com precisão.'
              : `Base de rotina, saúde, treino e alimentação de ${student.full_name}.`}
          </Text>
        </View>
        {prompt && onClosePrompt ? (
          <Pressable onPress={onClosePrompt} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Feather name="x" size={16} color="#BCEAA9" />
          </Pressable>
        ) : null}
      </LinearGradient>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.kicker}>{progress.answered}/{progress.total} respostas</Text>
            <Text style={styles.sectionTitle}>{completed ? 'Anamnese pronta' : 'Respostas pendentes'}</Text>
          </View>
          <View style={[styles.statusPill, completed && styles.statusPillDone]}>
            <MaterialCommunityIcons name={completed ? 'check-decagram' : 'progress-clock'} size={14} color={completed ? '#061007' : '#9CF02E'} />
            <Text style={[styles.statusPillText, completed && styles.statusPillTextDone]}>
              {completed ? 'Concluída' : `${progress.percent}%`}
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </View>
        <View style={styles.metaStrip}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="account-outline" size={14} color="#9CF02E" />
            <Text style={styles.metaChipText}>{student.full_name}</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="calendar-check-outline" size={14} color="#9CF02E" />
            <Text style={styles.metaChipText}>{anamnesis ? formatDate(anamnesis.completedAt) : 'Ainda em aberto'}</Text>
          </View>
        </View>
        <View style={styles.metaGrid}>
          <View style={styles.metaTile}>
            <Text style={styles.metaValue}>{formatDate(anamnesis?.completedAt)}</Text>
            <Text style={styles.metaLabel}>Conclusão</Text>
          </View>
          <View style={styles.metaTile}>
            <Text style={styles.metaValue}>{profile.role === 'trainer' ? 'Coach' : 'Aluno'}</Text>
            <Text style={styles.metaLabel}>Visualização</Text>
          </View>
        </View>
      </View>

      {combinedError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color="#FCA5A5" />
          <Text style={styles.errorText}>{combinedError}</Text>
        </View>
      ) : null}

      <View style={styles.sectionList}>
        {anamnesisSections.map((section) => {
          const expanded = openSections.includes(section.id);
          const answered = section.questions.filter((question) => draftAnswers[question.id]?.trim()).length;

          return (
            <View key={section.id} style={styles.sectionCard}>
              <Pressable
                onPress={() => toggleSection(section.id)}
                style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
              >
                <View style={styles.sectionIcon}>
                  <MaterialCommunityIcons name={sectionIcons[section.id] ?? 'clipboard-text-outline'} size={19} color="#061007" />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionDescription}>{section.description}</Text>
                </View>
                <View style={styles.sectionCounter}>
                  <Text style={styles.sectionCounterText}>{answered}/{section.questions.length}</Text>
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#BCEAA9" />
                </View>
              </Pressable>

              {expanded ? (
                <View style={styles.questionList}>
                  {section.questions.map((question) => (
                    <View key={question.id} style={styles.questionField}>
                      <Text style={styles.questionLabel}>{question.label}</Text>
                      <TextInput
                        value={draftAnswers[question.id] ?? ''}
                        editable={!readonly}
                        placeholder={question.placeholder}
                        placeholderTextColor="rgba(220, 244, 200, 0.34)"
                        keyboardType={question.keyboardType ?? 'default'}
                        multiline={question.multiline}
                        textAlignVertical={question.multiline ? 'top' : 'center'}
                        onChangeText={(value) => updateAnswer(question.id, value)}
                        style={[styles.answerInput, question.multiline && styles.answerTextarea, readonly && styles.answerInputReadonly]}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.actionPanel}>
        <View style={styles.actionCopy}>
          <Text style={styles.kicker}>{dirty ? 'Alterações pendentes' : 'Pronto para salvar'}</Text>
          <Text style={styles.actionText}>
            {canEdit ? 'Salve como rascunho ou conclua quando tudo estiver preenchido.' : 'Apenas visualização para consulta do coach.'}
          </Text>
        </View>

        {canEdit ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void saveAnswers('draft')}
              disabled={saving}
              style={({ pressed }) => [styles.secondaryButton, pressed && !saving && styles.pressed, saving && styles.disabled]}
            >
              {saving ? <ActivityIndicator color="#9CF02E" size="small" /> : <Feather name="save" size={15} color="#9CF02E" />}
              <Text style={styles.secondaryButtonText}>Salvar rascunho</Text>
            </Pressable>

            <Pressable
              onPress={() => void saveAnswers('completed')}
              disabled={saving}
              style={({ pressed }) => [styles.primaryButton, pressed && !saving && styles.pressed, saving && styles.disabled]}
            >
              {saving ? <ActivityIndicator color="#061007" size="small" /> : <Feather name="check" size={16} color="#061007" />}
              <Text style={styles.primaryButtonText}>Concluir anamnese</Text>
            </Pressable>
          </View>
        ) : null}

        {prompt ? (
          <View style={styles.promptActions}>
            <Pressable onPress={onClosePrompt} style={({ pressed }) => [styles.promptGhost, pressed && styles.pressed]}>
              <Text style={styles.promptGhostText}>Agora não</Text>
            </Pressable>
            <Pressable
              onPress={() => void dismissForever()}
              disabled={saving}
              style={({ pressed }) => [styles.promptDanger, pressed && !saving && styles.pressed, saving && styles.disabled]}
            >
              <Feather name="eye-off" size={14} color="#FCA5A5" />
              <Text style={styles.promptDangerText}>Ocultar para sempre</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  promptContainer: {
    paddingBottom: 12,
  },
  loadingCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: 'rgba(232, 246, 221, 0.72)',
    fontWeight: '800',
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.22)',
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9CF02E',
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroStats: {
    gap: 8,
    minWidth: 126,
  },
  heroStat: {
    minWidth: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  heroStatValue: {
    color: '#F2FFE8',
    fontSize: 17,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 2,
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F2FFE8',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(232, 246, 221, 0.64)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  progressCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(8, 14, 9, 0.78)',
    padding: 15,
    gap: 13,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#F2FFE8',
    fontSize: 16,
    fontWeight: '900',
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.24)',
    backgroundColor: 'rgba(156, 240, 46, 0.09)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillDone: {
    backgroundColor: '#9CF02E',
    borderColor: '#9CF02E',
  },
  statusPillText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  statusPillTextDone: {
    color: '#061007',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 246, 221, 0.09)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CF02E',
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(156, 240, 46, 0.08)',
  },
  metaChipText: {
    color: '#DCF4C8',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaTile: {
    flex: 1,
    minWidth: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: 11,
    gap: 3,
  },
  metaValue: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  metaLabel: {
    color: 'rgba(232, 246, 221, 0.52)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  errorBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.28)',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  sectionList: {
    gap: 12,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.14)',
    backgroundColor: 'rgba(8, 14, 9, 0.76)',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#9CF02E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
    gap: 3,
  },
  sectionDescription: {
    color: 'rgba(232, 246, 221, 0.55)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sectionCounter: {
    alignItems: 'center',
    gap: 4,
  },
  sectionCounterText: {
    color: '#9CF02E',
    fontSize: 11,
    fontWeight: '900',
  },
  questionList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 240, 46, 0.1)',
    padding: 13,
    gap: 12,
  },
  questionField: {
    gap: 7,
  },
  questionLabel: {
    color: '#F2FFE8',
    fontSize: 13,
    fontWeight: '900',
  },
  answerInput: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#F2FFE8',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  answerTextarea: {
    minHeight: 92,
    lineHeight: 19,
  },
  answerInputReadonly: {
    opacity: 0.78,
  },
  actionPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.16)',
    backgroundColor: 'rgba(7, 14, 8, 0.86)',
    padding: 15,
    gap: 13,
  },
  actionCopy: {
    gap: 4,
  },
  actionText: {
    color: 'rgba(232, 246, 221, 0.6)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#9CF02E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#061007',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.28)',
    backgroundColor: 'rgba(156, 240, 46, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#9CF02E',
    fontSize: 13,
    fontWeight: '900',
  },
  promptActions: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 240, 46, 0.1)',
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promptGhost: {
    flex: 1,
    minWidth: 130,
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(156, 240, 46, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptGhostText: {
    color: '#BCEAA9',
    fontSize: 12,
    fontWeight: '900',
  },
  promptDanger: {
    flex: 1,
    minWidth: 160,
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.28)',
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  promptDangerText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.62,
  },
});
