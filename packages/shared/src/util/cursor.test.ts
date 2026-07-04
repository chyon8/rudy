import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('round-trips an ISO timestamp and a uuid', () => {
    const ts = '2026-07-04T10:00:00.000Z';
    const id = '11111111-1111-1111-1111-111111111111';
    expect(decodeCursor(encodeCursor(ts, id))).toEqual({ createdAt: ts, id });
  });

  it('accepts a Date', () => {
    const d = new Date('2026-07-04T10:00:00.000Z');
    const id = '22222222-2222-2222-2222-222222222222';
    expect(decodeCursor(encodeCursor(d, id))).toEqual({
      createdAt: '2026-07-04T10:00:00.000Z',
      id,
    });
  });

  it('returns null for a cursor without a separator', () => {
    expect(decodeCursor(Buffer.from('nocolon').toString('base64url'))).toBeNull();
  });
});
