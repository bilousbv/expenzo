import type { AvatarUpload } from '@expenzo/data';
import { avatarFileProblem } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Avatar, Button } from '@expenzo/ui';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Text, View } from 'react-native';

export interface AvatarFieldProps {
  /** The assembled display name, for the label and the initials fallback. */
  name: string | null | undefined;
  /** A signed URL, or null when there is no photo yet. */
  url: string | null;
  onChoose: (file: AvatarUpload) => Promise<void>;
  onRemove: () => Promise<void>;
}

/**
 * Android's picker regularly reports no MIME type at all.
 *
 * Refusing on that alone would make the feature simply not work on a large
 * share of phones, so the extension stands in. The bucket still has the final
 * say over what it will accept, which is the check that has to be right.
 */
function typeOf(asset: { mimeType?: string | null; uri?: string | null }): string {
  if (asset.mimeType) return asset.mimeType;

  const extension = asset.uri?.split('.').pop()?.toLowerCase();

  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';

  return '';
}

/**
 * Base64 to bytes, without pulling in a dependency for it.
 *
 * `atob` exists in the Hermes runtime Expo SDK 57 ships, so this is a loop
 * rather than a package that would need version-matching on every upgrade.
 */
function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

/**
 * The photo on the profile screen.
 *
 * Asks the picker for base64 and uploads an ArrayBuffer. A React Native Blob
 * reaches Supabase storage as zero bytes — the upload reports success and
 * stores an empty object, which looks exactly like it worked until somebody
 * tries to view the photo.
 */
export function AvatarField({ name, url, onChoose, onRemove }: AvatarFieldProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChoose() {
    if (busy) return;

    setError(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    // Dismissing the picker is its most common outcome, and is not an error.
    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.base64) return;

    const type = typeOf(asset);
    const size = asset.fileSize ?? asset.base64.length;

    const problem = avatarFileProblem({ type, size });

    if (problem) {
      setError(t(problem));
      return;
    }

    setBusy(true);
    try {
      await onChoose({ body: decodeBase64(asset.base64), type, size });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      await onRemove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-content-muted">{t('profile.photo')}</Text>

      <View className="flex-row items-center gap-gutter">
        <Avatar name={name} url={url} size="lg" />

        <View className="flex-1 gap-2">
          <Button
            testID="avatar-choose"
            variant="secondary"
            size="sm"
            disabled={busy}
            onPress={handleChoose}
          >
            {t(
              busy
                ? 'profile.uploadingPhoto'
                : url
                  ? 'profile.replacePhoto'
                  : 'profile.choosePhoto',
            )}
          </Button>

          {url ? (
            <Button
              testID="avatar-remove"
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={handleRemove}
            >
              {t('profile.removePhoto')}
            </Button>
          ) : null}
        </View>
      </View>

      <Text className="text-xs text-content-muted">{t('profile.photoExplainer')}</Text>

      {error ? (
        <Text testID="avatar-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
