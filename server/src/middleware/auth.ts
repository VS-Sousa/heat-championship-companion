import type { NextFunction, Request, Response } from 'express';

export type Role = 'guest' | 'host' | 'admin';

declare global {
  namespace Express {
    interface Request { auth?: { role: Role; username?: string } }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (token === 'local-guest') req.auth = { role: 'guest' };
  else if (token === 'local-host') req.auth = { role: 'host', username: 'host' };
  else return res.status(401).json({ error: 'Invalid or missing bearer token.' });
  next();
}

export function requireWrite(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'host' && req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Host access required.' });
  }
  next();
}
