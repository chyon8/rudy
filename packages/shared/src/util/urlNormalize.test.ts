import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './urlNormalize';

describe('normalizeUrl', () => {
  it('canonicalizes youtu.be to a watch URL and drops the si param', () => {
    expect(normalizeUrl('https://youtu.be/abc123?si=xyz')).toBe(
      'https://www.youtube.com/watch?v=abc123',
    );
  });

  it('canonicalizes watch URLs and drops timestamp params', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=abc123&t=30s')).toBe(
      'https://www.youtube.com/watch?v=abc123',
    );
  });

  it('canonicalizes shorts URLs', () => {
    expect(normalizeUrl('https://youtube.com/shorts/xyz789')).toBe(
      'https://www.youtube.com/watch?v=xyz789',
    );
  });

  it('strips utm params, hash, and trailing slash', () => {
    expect(normalizeUrl('https://example.com/path/?utm_source=a&b=2#frag')).toBe(
      'https://example.com/path?b=2',
    );
  });

  it('lowercases the host but preserves path case', () => {
    expect(normalizeUrl('https://Example.COM/A/')).toBe('https://example.com/A');
  });

  it('returns trimmed input for unparseable URLs', () => {
    expect(normalizeUrl('  not a url  ')).toBe('not a url');
  });
});
