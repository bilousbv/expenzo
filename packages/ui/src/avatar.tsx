'use client';

import { useState } from 'react';

import { avatarClass, avatarInitials, avatarLabelClass, type AvatarProps } from './avatar.styles';

/**
 * Web implementation. Metro picks `avatar.native.tsx` instead.
 *
 * Most members will never upload a photo, so the initials are the ordinary
 * case rather than an error state, and the same fallback covers a signed URL
 * that has expired.
 */
export function Avatar({ name, url, size = 'md', className, testID }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const label = name?.trim() ? name : undefined;
  const showPhoto = Boolean(url) && !failed;

  return (
    <div
      data-testid={testID}
      className={avatarClass(size, `flex ${className ?? ''}`)}
      // The name is rendered next to this everywhere it appears, so announcing
      // it a second time is noise. When there is a photo the <img> carries the
      // label instead.
      aria-hidden={showPhoto ? undefined : true}
    >
      {showPhoto ? (
        <img
          src={url as string}
          alt={label ?? ''}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={avatarLabelClass(size)}>{avatarInitials(name)}</span>
      )}
    </div>
  );
}
