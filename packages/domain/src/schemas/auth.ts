import { z } from 'zod';

/**
 * Credentials, shared by the browser, the phone and the end-to-end tests.
 *
 * These mirror what GoTrue will accept. Where the two could disagree the
 * stricter rule lives here, so the user finds out before a round trip rather
 * than through a server message written for an API client.
 */

/**
 * GoTrue stores and compares addresses lowercased. Settling the case here means
 * registering as Ana@Example.com and signing in as ana@example.com is one
 * account, rather than depending on which screen happened to normalise.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address')
  .transform((value) => value.toLowerCase());

/** Matches `minimum_password_length` in supabase/config.toml. */
const MIN_LENGTH = 8;

/**
 * bcrypt — which GoTrue hashes with — reads only the first 72 bytes and
 * silently ignores the rest. A longer password appears to work, and then any
 * 72-byte prefix of it also signs in. Refusing it is honest; truncating is not.
 */
const MAX_BYTES = 72;

const encoder = new TextEncoder();

export const passwordSchema = z
  .string()
  .min(MIN_LENGTH, `Use at least ${MIN_LENGTH} characters`)
  .refine(
    (value) => encoder.encode(value).length <= MAX_BYTES,
    `That password is too long — keep it under ${MAX_BYTES} bytes`,
  );

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type Credentials = z.input<typeof credentialsSchema>;

export const registrationSchema = credentialsSchema
  .extend({ confirmPassword: z.string() })
  // `check` rather than `refine` on the object: a superRefine-style check runs
  // only once the fields themselves have parsed, so a password that is too
  // short reports as too short rather than as a mismatch, and the message
  // lands on the field the user has to fix.
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Those passwords do not match',
    path: ['confirmPassword'],
  });

export type Registration = z.input<typeof registrationSchema>;

/**
 * The third-party providers the app knows how to sign in with.
 *
 * Both are configured in supabase/config.toml but stay disabled until real
 * credentials exist. Sign in with Apple is not optional once Google is offered:
 * App Store guideline 4.8 requires it.
 */
export const oauthProviderSchema = z.enum(['google', 'apple']);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
