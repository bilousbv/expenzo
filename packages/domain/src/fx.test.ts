import { describe, expect, it } from 'vitest';

import { convertMinor, deriveRate, parseEcbDailyXml } from './fx';

/**
 * The shape the European Central Bank actually publishes at
 * eurofxref-daily.xml: three nested Cube elements, single-quoted attributes,
 * and one self-closing Cube per currency. EUR itself is never listed — it is
 * the base, at a rate of one.
 */
const ECB_DAILY = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <gesmes:Sender>
    <gesmes:name>European Central Bank</gesmes:name>
  </gesmes:Sender>
  <Cube>
    <Cube time='2026-08-25'>
      <Cube currency='USD' rate='1.1642'/>
      <Cube currency='JPY' rate='171.35'/>
      <Cube currency='GBP' rate='0.86215'/>
      <Cube currency='KWD' rate='0.35604'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe('parseEcbDailyXml', () => {
  it('reads the publication date', () => {
    expect(parseEcbDailyXml(ECB_DAILY).asOf).toBe('2026-08-25');
  });

  it('reads every quoted currency', () => {
    const { rates } = parseEcbDailyXml(ECB_DAILY);

    expect(rates.USD).toBe(1.1642);
    expect(rates.JPY).toBe(171.35);
    expect(rates.GBP).toBe(0.86215);
  });

  // EUR is the base and never appears in the file. Leaving it out of the map
  // would make every conversion into or out of euros a lookup miss.
  it('adds EUR at a rate of one, which the file never states', () => {
    expect(parseEcbDailyXml(ECB_DAILY).rates.EUR).toBe(1);
  });

  it('ignores the outer envelope rather than reading it as a currency', () => {
    const codes = Object.keys(parseEcbDailyXml(ECB_DAILY).rates).sort();

    expect(codes).toEqual(['EUR', 'GBP', 'JPY', 'KWD', 'USD']);
  });

  // A feed that arrives without a date is a feed we cannot file rates under.
  // Guessing today would attribute yesterday's rates to today for ever.
  it('refuses a document with no date', () => {
    expect(() =>
      parseEcbDailyXml('<Cube><Cube><Cube currency="USD" rate="1.1"/></Cube></Cube>'),
    ).toThrow(/date/i);
  });

  it('refuses a document with no rates in it', () => {
    expect(() => parseEcbDailyXml(`<Cube><Cube time='2026-08-25'></Cube></Cube>`)).toThrow(/rate/i);
  });

  // Silently skipping an unparseable rate drops a currency from the table, and
  // the first anyone hears of it is an expense that will not save.
  it('refuses a rate that is not a positive number', () => {
    const broken = ECB_DAILY.replace(`rate='1.1642'`, `rate='N/A'`);

    expect(() => parseEcbDailyXml(broken)).toThrow(/USD/);
  });
});

describe('deriveRate', () => {
  const rates = { EUR: 1, USD: 1.1642, JPY: 171.35, GBP: 0.86215 };

  it('is one between a currency and itself, even an unquoted one', () => {
    expect(deriveRate('CHF', 'CHF', rates)).toBe(1);
  });

  it('reads a euro pair straight off the feed', () => {
    expect(deriveRate('EUR', 'USD', rates)).toBe(1.1642);
  });

  it('inverts it for the other direction', () => {
    expect(deriveRate('USD', 'EUR', rates)).toBeCloseTo(1 / 1.1642, 12);
  });

  // The feed is EUR-based, so every other pair is triangulated through it.
  it('triangulates a pair the feed does not quote directly', () => {
    expect(deriveRate('USD', 'GBP', rates)).toBeCloseTo(0.86215 / 1.1642, 12);
  });

  it('round-trips back to one', () => {
    const there = deriveRate('USD', 'JPY', rates) ?? 0;
    const back = deriveRate('JPY', 'USD', rates) ?? 0;

    expect(there * back).toBeCloseTo(1, 12);
  });

  it('has no rate for a currency the feed does not carry', () => {
    expect(deriveRate('USD', 'CLP', rates)).toBeNull();
    expect(deriveRate('CLP', 'USD', rates)).toBeNull();
  });
});

describe('convertMinor', () => {
  it('leaves an amount alone at a rate of one', () => {
    expect(convertMinor(1250, 'USD', 'USD', 1)).toBe(1250);
  });

  it('converts between two-decimal currencies', () => {
    // 12.50 USD at 0.85 = 10.625 EUR, rounded to 10.63.
    expect(convertMinor(1250, 'USD', 'EUR', 0.85)).toBe(1063);
  });

  // The trap this function exists for: minor units are not a fixed hundredth.
  // 1000 JPY is a thousand yen, not ten.
  it('crosses a currency with no minor unit at all', () => {
    // 1000 JPY at 0.0068 = 6.80 USD.
    expect(convertMinor(1000, 'JPY', 'USD', 0.0068)).toBe(680);
  });

  it('and one in the other direction', () => {
    // 20.00 USD at 147 = 2940 JPY, which has no decimal places.
    expect(convertMinor(2000, 'USD', 'JPY', 147)).toBe(2940);
  });

  it('handles a three-decimal currency', () => {
    // 10.00 USD at 0.306 = 3.060 KWD, stored as 3060 fils.
    expect(convertMinor(1000, 'USD', 'KWD', 0.306)).toBe(3060);
  });

  it('rounds to the nearest minor unit rather than truncating', () => {
    // 1.00 USD at 0.925 = 0.925 EUR, which is 92.5 cents.
    expect(convertMinor(100, 'USD', 'EUR', 0.925)).toBe(93);
  });

  // One Chilean peso is worth about a tenth of a US cent. Rounding it to the
  // nearest cent gives zero, and an expense that happened is not an expense of
  // nothing — the column's check constraint agrees.
  it('never rounds a real amount away to nothing', () => {
    expect(convertMinor(1, 'CLP', 'USD', 0.001)).toBe(1);
  });

  it('refuses a rate that is not positive', () => {
    expect(() => convertMinor(1250, 'USD', 'EUR', 0)).toThrow(/rate/i);
  });

  it('refuses an amount that is not a whole number of minor units', () => {
    expect(() => convertMinor(12.5, 'USD', 'EUR', 0.85)).toThrow(/minor units/i);
  });
});
