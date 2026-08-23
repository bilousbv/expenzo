/** Platform-agnostic helpers shared by both apps. */
export function formatCurrency(amountInCents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountInCents / 100);
}
