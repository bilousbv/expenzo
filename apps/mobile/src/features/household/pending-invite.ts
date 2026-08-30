/**
 * The invitation somebody opened before they had an account.
 *
 * Signing in swaps the whole navigator — `Stack.Protected` unmounts the
 * signed-out tree — so the screen holding the token disappears along with it.
 * Parking the token here and replaying it once a session exists is what makes
 * "open the link, register, land in the household" one continuous act instead
 * of two that lose each other in the middle.
 *
 * Module state rather than storage: it is wanted for the length of one sign-in
 * and nothing else, and an invitation surviving an app restart would redeem
 * itself at a moment nobody asked for.
 */
let pending: string | null = null;

export function setPendingInvite(token: string): void {
  pending = token;
}

/** Reads it once. A second call gets nothing, so it cannot replay twice. */
export function takePendingInvite(): string | null {
  const token = pending;
  pending = null;

  return token;
}
