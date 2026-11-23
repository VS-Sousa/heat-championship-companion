import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

export const authRouter = Router();

authRouter.post('/guest', (_req, res) =>
  res.json({ role: 'guest', token: 'local-guest' }),
);
authRouter.post('/host', async (req, res) => {
  const parsed = z.object({ username: z.string(), password: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'username and password are required.' });
  const result = await db.query(
    'select username, role from profiles where username=$1 and password_text=$2',
    [parsed.data.username, parsed.data.password],
  );
  if (!result.rows[0]) return res.status(401).json({ error: 'Invalid credentials.' });
  return res.json({
    role: result.rows[0].role, username: result.rows[0].username, token: 'local-host',
  });
});
