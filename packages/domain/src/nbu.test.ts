import { describe, expect, it } from 'vitest';

import { nbuToEurRates, parseNbuJson } from './nbu';

/**
 * The shape bank.gov.ua actually returns: one object per currency, `rate`
 * being hryvnia per one unit of it, and a dd.mm.yyyy date on every row.
 */
const NBU = JSON.stringify([
  { r030: 840, txt: 'Долар США', rate: 44.5445, cc: 'USD', exchangedate: '28.08.2026' },
  { r030: 978, txt: 'Євро', rate: 51.8578, cc: 'EUR', exchangedate: '28.08.2026' },
  { r030: 985, txt: 'Злотий', rate: 11.9823, cc: 'PLN', exchangedate: '28.08.2026' },
  { r030: 392, txt: 'Єна', rate: 0.27939, cc: 'JPY', exchangedate: '28.08.2026' },
]);

describe('parseNbuJson', () => {
  it('reads the publication date, which arrives day-first', () => {
    expect(parseNbuJson(NBU).asOf).toBe('2026-08-28');
  });

  it('reads every quoted currency as hryvnia per unit', () => {
    const { uahPer } = parseNbuJson(NBU);

    expect(uahPer.USD).toBe(44.5445);
    expect(uahPer.JPY).toBe(0.27939);
  });

  /**
   * The hryvnia is the base of this feed and so is never listed in it — the
   * same trap as the euro in the ECB file. Leaving it out would make every
   * conversion into or out of the app's most important currency a lookup miss.
   */
  it('adds UAH at one, which the feed never states', () => {
    expect(parseNbuJson(NBU).uahPer.UAH).toBe(1);
  });

  /**
   * The National Bank quotes gold, silver, palladium, platinum and the IMF's
   * drawing rights alongside real money. Left in, they would appear in the
   * currency picker between lira and dollars, and an ounce of gold would be
   * treated as having two decimal places.
   */
  it('leaves out the metals and drawing rights, which are not money', () => {
    const withMetals = JSON.stringify([
      { rate: 51.8578, cc: 'EUR', exchangedate: '28.08.2026' },
      { rate: 141000, cc: 'XAU', exchangedate: '28.08.2026' },
      { rate: 1600, cc: 'XAG', exchangedate: '28.08.2026' },
      { rate: 60000, cc: 'XDR', exchangedate: '28.08.2026' },
    ]);

    const { uahPer } = parseNbuJson(withMetals);

    expect(uahPer.XAU).toBeUndefined();
    expect(uahPer.XAG).toBeUndefined();
    expect(uahPer.XDR).toBeUndefined();
  });

  // Not a rule about the X prefix: these are the CFA and CFP francs, which
  // people are genuinely paid in.
  it('keeps the CFA and CFP francs, which share that prefix', () => {
    const withFrancs = JSON.stringify([
      { rate: 51.8578, cc: 'EUR', exchangedate: '28.08.2026' },
      { rate: 0.079, cc: 'XOF', exchangedate: '28.08.2026' },
    ]);

    expect(parseNbuJson(withFrancs).uahPer.XOF).toBe(0.079);
  });

  it('refuses a body that is not the feed', () => {
    expect(() => parseNbuJson('{"error":"nope"}')).toThrow(/feed/i);
    expect(() => parseNbuJson('[]')).toThrow(/feed/i);
  });

  it('refuses a rate that is not a positive number', () => {
    const broken = NBU.replace('44.5445', '0');

    expect(() => parseNbuJson(broken)).toThrow(/USD/);
  });

  it('refuses a date it cannot read', () => {
    expect(() => parseNbuJson(NBU.replace('28.08.2026', '2026-08-28'))).toThrow(/date/i);
  });
});

describe('nbuToEurRates', () => {
  /**
   * The rate table is EUR-based and every conversion triangulates through it,
   * so this feed has to be restated in those terms rather than given a base of
   * its own — two bases would mean two lookup paths and a chance for them to
   * disagree.
   */
  it('restates hryvnia quotes as units per euro', () => {
    const rates = nbuToEurRates(parseNbuJson(NBU));

    // 51.8578 UAH per EUR over 44.5445 UAH per USD.
    expect(rates.USD).toBeCloseTo(1.1642, 4);
  });

  // The whole point of adding this source.
  it('quotes the hryvnia itself', () => {
    expect(nbuToEurRates(parseNbuJson(NBU)).UAH).toBeCloseTo(51.8578, 4);
  });

  it('puts the euro at exactly one', () => {
    expect(nbuToEurRates(parseNbuJson(NBU)).EUR).toBe(1);
  });

  /**
   * Agreement with the ECB is the check that the arithmetic is the right way
   * up. Both publish the same pair daily and independently, so a rate that
   * came out inverted would be off by a factor of about 1.4, not a rounding.
   */
  it('lands on the same USD rate the ECB publishes', () => {
    const rates = nbuToEurRates(parseNbuJson(NBU));

    expect(rates.USD).toBeGreaterThan(1);
    expect(rates.USD).toBeLessThan(1.3);
  });

  // Without the euro there is nothing to restate the feed against.
  it('refuses a feed with no euro in it', () => {
    const noEuro = JSON.stringify([
      { r030: 840, txt: 'Долар США', rate: 44.5445, cc: 'USD', exchangedate: '28.08.2026' },
    ]);

    expect(() => nbuToEurRates(parseNbuJson(noEuro))).toThrow(/euro/i);
  });
});
