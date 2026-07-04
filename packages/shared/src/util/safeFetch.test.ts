import { describe, expect, it } from 'vitest';
import { isBlockedIp } from './safeFetch';

describe('isBlockedIp', () => {
  it('blocks private and loopback IPv4', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '100.64.0.1', '0.0.0.0']) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it('blocks the cloud metadata link-local address', () => {
    expect(isBlockedIp('169.254.169.254')).toBe(true);
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1']) {
      expect(isBlockedIp(ip)).toBe(false);
    }
  });

  it('blocks loopback, link-local, ULA, and mapped IPv6', () => {
    for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it('allows public IPv6', () => {
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
  });
});
