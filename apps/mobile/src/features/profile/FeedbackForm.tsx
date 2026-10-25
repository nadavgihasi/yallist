import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { parseResponse } from 'hono/client';
import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { ChipGroup, FilterChip } from '@/components/Chips';
import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api, statusOf } from '@/lib/api';
import { colors, type } from '@/theme';

const KINDS = ['feature', 'bug'] as const;
type Kind = (typeof KINDS)[number];

/** Sends a feature request or bug report (POST /feedback), which also becomes a GitHub issue. */
export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('feature');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () =>
      parseResponse(
        api.feedback.$post({
          json: {
            kind,
            title: title.trim(),
            body: body.trim(),
            appVersion: Constants.expoConfig?.version ?? '?',
            platform: Platform.OS as 'ios' | 'android' | 'web',
          },
        }),
      ),
    onSuccess: () => {
      showToast(he.feedback.thanks);
      onClose();
    },
    onError: (error) =>
      showToast(statusOf(error) === 429 ? he.feedback.tooMany : he.feedback.failed),
  });
  // The API's limits: title 3–120 characters.
  const ready = title.trim().length >= 3 && !send.isPending;

  return (
    <Sheet
      title={he.feedback.title[kind]}
      onClose={onClose}
      footer={
        <PillButton
          label={send.isPending ? he.feedback.sending : he.feedback.send}
          size="lg"
          wide
          disabled={!ready}
          onPress={() => send.mutate()}
        />
      }
    >
      <ChipGroup label={he.feedback.kind}>
        {KINDS.map((k) => (
          <FilterChip
            key={k}
            label={he.feedback.kinds[k]}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </ChipGroup>
      <TextField
        label={he.feedback.subject}
        value={title}
        onChangeText={setTitle}
        placeholder={he.feedback.subjectPlaceholder[kind]}
        maxLength={120}
        returnKeyType="next"
        autoFocus
      />
      <TextField
        label={he.feedback.details}
        hint={he.feedback.optional}
        value={body}
        onChangeText={setBody}
        placeholder={he.feedback.detailsPlaceholder}
        maxLength={4000}
        multiline
        style={styles.details}
      />
      <Text style={styles.caption}>{he.feedback.publicHint}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  details: { minHeight: 120, paddingVertical: 14, textAlignVertical: 'top' },
  caption: { ...type.caption, color: colors.inkMuted },
});
