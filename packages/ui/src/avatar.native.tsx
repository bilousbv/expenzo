import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { avatarClass, avatarInitials, avatarLabelClass, type AvatarProps } from './avatar.styles';

/**
 * React Native implementation, resolved by Metro through the `.native` suffix.
 *
 * Same fallback as the web half: most members never upload a photo, and a
 * signed URL eventually expires, so initials are the ordinary case rather than
 * an error state.
 */
export function Avatar({ name, url, size = 'md', className, testID }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const showPhoto = Boolean(url) && !failed;

  return (
    <View testID={testID} className={avatarClass(size, className)}>
      {showPhoto ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri: url as string }}
          onError={() => setFailed(true)}
          accessibilityLabel={name?.trim() ? name : undefined}
          className="h-full w-full"
          resizeMode="cover"
        />
      ) : (
        <Text className={avatarLabelClass(size)}>{avatarInitials(name)}</Text>
      )}
    </View>
  );
}
