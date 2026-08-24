import { parseIsoDate, type IsoDate } from './period';

/**
 * Merchant normalisation and duplicate scoring.
 *
 * Card statements mangle merchant names in predictable ways: processor
 * prefixes, terminal numbers, legal suffixes. Stripping those consistently is
 * what lets an email receipt be recognised as the same purchase a person
 * already typed in by hand.
 */

/** Processor and channel prefixes that carry no merchant information. */
const LEADING_NOISE = /^(pos\s+(purchase|debit)|card\s+purchase|payment\s+to)\s+/;

/** Longest alternatives first, so `corporation` is not truncated to `corp`. */
const LEGAL_SUFFIX =
  /[,\s]+(corporation|limited|l\.l\.c|llc|inc|ltd|gmbh|s\.?a\.?|p\.?l\.?c|corp|b\.?v|n\.?v|a\.?g|srl|pty|co)\.?\s*$/;

export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return '';

  let value = raw.toLowerCase();

  // Strip diacritics so "Café" and "Cafe" are the same merchant.
  value = value.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Everything up to and including a `*` is processor noise: "SQ *", "TST*",
  // "PAYPAL *". The merchant is whatever follows.
  value = value.replace(/^[^*]*\*\s*/, '');
  value = value.replace(LEADING_NOISE, '');

  // Apostrophes close up rather than splitting: "mcdonald's" -> "mcdonalds".
  value = value.replace(/['’]/g, '');

  // Store and terminal numbers.
  value = value.replace(/#\s*\d+/g, ' ');
  value = value.replace(/\bstore\s*\d+\b/g, ' ');
  value = value.replace(/\b\d{3,}\b/g, ' ');

  value = value.replace(LEGAL_SUFFIX, '');

  // Anything left that is not a letter or digit becomes a separator.
  value = value.replace(/[^a-z0-9]+/g, ' ');

  return value.trim().replace(/\s+/g, ' ');
}

function bigrams(value: string): string[] {
  const grams: string[] = [];
  for (let i = 0; i < value.length - 1; i += 1) {
    grams.push(value.slice(i, i + 2));
  }
  return grams;
}

/** Dice coefficient over character bigrams, 0 to 1. */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return a.length > 0 ? 1 : 0;
  if (!a || !b) return 0;

  const left = bigrams(a);
  const right = bigrams(b);
  if (left.length === 0 || right.length === 0) return 0;

  const pool = new Map<string, number>();
  for (const gram of left) {
    pool.set(gram, (pool.get(gram) ?? 0) + 1);
  }

  let shared = 0;
  for (const gram of right) {
    const remaining = pool.get(gram) ?? 0;
    if (remaining > 0) {
      shared += 1;
      pool.set(gram, remaining - 1);
    }
  }

  return (2 * shared) / (left.length + right.length);
}

export interface MatchCandidate {
  readonly merchant?: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredOn: IsoDate;
  readonly categoryId?: string | null;
}

/** Beyond this many days apart, two records are simply not the same purchase. */
const DATE_WINDOW_DAYS = 3;

/** Below this merchant similarity, nothing else can rescue the match. */
const MERCHANT_FLOOR = 0.34;

function daysBetween(a: IsoDate, b: IsoDate): number {
  const left = parseIsoDate(a);
  const right = parseIsoDate(b);

  const leftUtc = Date.UTC(left.year, left.month - 1, left.day);
  const rightUtc = Date.UTC(right.year, right.month - 1, right.day);

  return Math.abs(leftUtc - rightUtc) / 86_400_000;
}

function amountScore(a: MatchCandidate, b: MatchCandidate): number {
  if (a.amountMinor === b.amountMinor) return 1;

  const larger = Math.max(Math.abs(a.amountMinor), Math.abs(b.amountMinor));
  if (larger === 0) return 0;

  const drift = Math.abs(a.amountMinor - b.amountMinor) / larger;

  // Two percent covers a tip, a rounding difference or a small surcharge.
  return drift <= 0.02 ? 0.6 : 0;
}

function dateScore(days: number): number {
  if (days === 0) return 1;
  if (days <= 1) return 0.7;
  return 0.4;
}

/**
 * How likely two records describe the same purchase, 0 to 1.
 *
 * The caller decides what to do with it: at or above 0.9 enrich the existing
 * row, between 0.55 and 0.9 queue it for review, below that treat them as
 * separate purchases.
 */
export function matchScore(a: MatchCandidate, b: MatchCandidate): number {
  if (a.currency.toUpperCase() !== b.currency.toUpperCase()) return 0;

  const days = daysBetween(a.occurredOn, b.occurredOn);
  if (days > DATE_WINDOW_DAYS) return 0;

  const merchant = stringSimilarity(normalizeMerchant(a.merchant), normalizeMerchant(b.merchant));
  const category = a.categoryId && b.categoryId && a.categoryId === b.categoryId ? 1 : 0;

  const raw = 0.45 * amountScore(a, b) + 0.3 * merchant + 0.15 * dateScore(days) + 0.1 * category;

  // A different merchant means it is not the same purchase, however well the
  // amount and date happen to line up.
  const score = merchant < MERCHANT_FLOOR ? raw * merchant : raw;

  return Math.min(1, Math.max(0, score));
}
