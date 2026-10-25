import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { pickReceipt } from '@/state/receipts';
import { colors, radius, space, type } from '@/theme';

/**
 * Take a photo or pick one; `onPick` gets it shrunk. On the web a file input does both (phones
 * offer the camera in it).
 */
export function ReceiptSources({ onPick }: { onPick: (uri: string) => void }) {
  const [preparing, setPreparing] = useState(false);
  const pick = async (source: 'camera' | 'library') => {
    setPreparing(true);
    try {
      const uri = await pickReceipt(source);
      if (uri) onPick(uri);
    } catch (error) {
      console.warn('Receipt pick failed', error);
      showToast(he.errors.failed);
    } finally {
      setPreparing(false);
    }
  };

  if (preparing) return <Text style={styles.meta}>{he.receipt.preparing}</Text>;
  return (
    <View style={styles.row}>
      {Platform.OS !== 'web' && (
        <PillButton
          label={he.receipt.camera}
          variant="soft"
          icon={<Icon name="camera" size={18} color={colors.primaryStrong} />}
          onPress={() => pick('camera')}
        />
      )}
      <PillButton
        label={Platform.OS === 'web' ? he.receipt.choose : he.receipt.gallery}
        variant="soft"
        icon={<Icon name="image" size={18} color={colors.primaryStrong} />}
        onPress={() => pick('library')}
      />
    </View>
  );
}

/** The optional receipt of a new expense: a thumbnail once picked. */
export function ReceiptField({
  uri,
  onChange,
}: {
  uri: string | undefined;
  onChange: (uri: string | undefined) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={fieldStyles.label}>{he.receipt.label}</Text>
      {uri ? (
        <View style={styles.row}>
          <Image
            source={{ uri }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityLabel={he.receipt.open}
          />
          <PillButton
            label={he.receipt.remove}
            variant="quiet"
            size="sm"
            onPress={() => onChange(undefined)}
          />
        </View>
      ) : (
        <ReceiptSources onPick={onChange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  meta: { ...type.caption, color: colors.inkMuted },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.input,
    backgroundColor: colors.ground,
  },
});
