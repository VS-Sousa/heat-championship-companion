import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { mapDriver } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';

export const driversRouter = Router();
const body = z.object({
  name: z.string().min(1), nickname: z.string().optional().nullable(),
  isLegend: z.boolean().default(false), fixedCarId: z.string().uuid().optional().nullable(),
  favoriteCarId: z.string().uuid().optional().nullable(), userId: z.string().uuid().optional().nullable(),
});
const values = (v: z.infer<typeof body>) => [v.name, v.nickname ?? null, v.isLegend, v.fixedCarId ?? null, v.favoriteCarId ?? null, v.userId ?? null];

driversRouter.get('/', async (_q, res) => res.json((await db.query('select * from drivers order by name')).rows.map(mapDriver)));
driversRouter.get('/:id', async (req, res) => {
  const row = (await db.query('select * from drivers where id=$1', [req.params.id])).rows[0];
  return row ? res.json(mapDriver(row)) : res.status(404).json({ error: 'Driver not found.' });
});
driversRouter.post('/', requireWrite, async (req, res) => {
  const row = (await db.query('insert into drivers(name,nickname,is_legend,fixed_car_id,favorite_car_id,user_id) values($1,$2,$3,$4,$5,$6) returning *', values(body.parse(req.body)))).rows[0];
  res.status(201).json(mapDriver(row));
});
driversRouter.put('/:id', requireWrite, async (req, res) => {
  const row = (await db.query('update drivers set name=$1,nickname=$2,is_legend=$3,fixed_car_id=$4,favorite_car_id=$5,user_id=$6 where id=$7 returning *', [...values(body.parse(req.body)), req.params.id])).rows[0];
  return row ? res.json(mapDriver(row)) : res.status(404).json({ error: 'Driver not found.' });
});
driversRouter.delete('/:id', requireWrite, async (req, res) => {
  const result = await db.query('delete from drivers where id=$1', [req.params.id]);
  return result.rowCount ? res.status(204).end() : res.status(404).json({ error: 'Driver not found.' });
});
