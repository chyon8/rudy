import jwt from 'jsonwebtoken';

export function signToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: '30d' });
}

export function verifyToken(token: string, secret: string): string {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded.sub;
}
