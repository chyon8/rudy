/**
 * 페이지네이션 cursor = base64url(createdAt + ':' + id).
 * createdAt(ISO)은 콜론을 포함하고 id(uuid)는 콜론이 없으므로, 마지막 콜론으로 분리한다.
 */
export function encodeCursor(createdAt: Date | string, id: string): string {
  const ts = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  return Buffer.from(`${ts}:${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const idx = decoded.lastIndexOf(':');
    if (idx <= 0 || idx === decoded.length - 1) return null;
    return { createdAt: decoded.slice(0, idx), id: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}
