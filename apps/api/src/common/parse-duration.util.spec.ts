import { parseDurationToMs } from './parse-duration.util';

describe('parseDurationToMs', () => {
  it('parses seconds, minutes, hours, days and weeks', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('30d')).toBe(2_592_000_000);
    expect(parseDurationToMs('1w')).toBe(604_800_000);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(parseDurationToMs(' 15M ')).toBe(900_000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationToMs('fifteen minutes')).toThrow();
    expect(() => parseDurationToMs('15')).toThrow();
    expect(() => parseDurationToMs('15x')).toThrow();
  });
});
