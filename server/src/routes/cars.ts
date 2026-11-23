import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { mapCar } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';

export const carsRouter = Router();
const body = z
  .object({
    name: z.string().min(1),
    colorHex: z.string().regex(/^#?[0-9a-f]{6}$/i),
    colorKey: z.string().min(1).optional(),
  })
  .transform((value) => {
    const hex = value.colorHex.startsWith('#')
      ? value.colorHex.toUpperCase()
      : `#${value.colorHex.toUpperCase()}`;
    return {
      name: value.name,
      colorHex: hex,
      colorKey: (value.colorKey ?? hex).toLowerCase(),
    };
  });

carsRouter.get('/', async (_q, res) => res.json((await db.query('select * from cars order by name')).rows.map(mapCar)));
carsRouter.get('/:id', async (req, res) => {
  const row = (await db.query('select * from cars where id=$1', [req.params.id])).rows[0];
  return row ? res.json(mapCar(row)) : res.status(404).json({ error: 'Car not found.' });
});
carsRouter.post('/', requireWrite, async (req, res) => {
  const value = body.parse(req.body);
  const row = (await db.query('insert into cars(name,color_key,color_hex) values($1,$2,$3) returning *', [value.name, value.colorKey, value.colorHex])).rows[0];
  res.status(201).json(mapCar(row));
});
carsRouter.put('/:id', requireWrite, async (req, res) => {
  const value = body.parse(req.body);
  const row = (await db.query('update cars set name=$1,color_key=$2,color_hex=$3 where id=$4 returning *', [value.name, value.colorKey, value.colorHex, req.params.id])).rows[0];
  return row ? res.json(mapCar(row)) : res.status(404).json({ error: 'Car not found.' });
});
carsRouter.delete('/:id', requireWrite, async (req, res) => {
  const result = await db.query('delete from cars where id=$1', [req.params.id]);
  return result.rowCount ? res.status(204).end() : res.status(404).json({ error: 'Car not found.' });
});
