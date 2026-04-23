import { describe, it, expect, vi } from 'vitest';
import { parseCookieSameSite } from '@api/routes/auth.router';

describe('parseCookieSameSite', () => {
  it('returns "None" when input is undefined', () => {
    expect(parseCookieSameSite(undefined)).toBe('None');
  });

  it('returns "None" when input is empty string', () => {
    expect(parseCookieSameSite('')).toBe('None');
  });

  it('returns "None" when input is only whitespace', () => {
    expect(parseCookieSameSite('   ')).toBe('None');
  });

  it('parses "Strict" correctly', () => {
    expect(parseCookieSameSite('Strict')).toBe('Strict');
  });

  it('parses "Lax" correctly', () => {
    expect(parseCookieSameSite('Lax')).toBe('Lax');
  });

  it('parses "None" correctly', () => {
    expect(parseCookieSameSite('None')).toBe('None');
  });

  it('normalises case-insensitive input "strict"', () => {
    expect(parseCookieSameSite('strict')).toBe('Strict');
  });

  it('normalises case-insensitive input "NONE"', () => {
    expect(parseCookieSameSite('NONE')).toBe('None');
  });

  it('normalises case-insensitive input "lAx"', () => {
    expect(parseCookieSameSite('lAx')).toBe('Lax');
  });

  it('falls back to "None" on unrecognised value and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseCookieSameSite('invalid')).toBe('None');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown COOKIE_SAMESITE value'),
    );
    warnSpy.mockRestore();
  });

  it('trims leading/trailing whitespace before parsing', () => {
    expect(parseCookieSameSite('  Strict  ')).toBe('Strict');
  });
});
