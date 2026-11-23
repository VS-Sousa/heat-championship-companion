import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { mapTrack } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';

export const tracksRouter = Router();
const body = z.object({ name: z.string().min(1), country: z.string().min(1), lengthSpaces:z.number().int().positive().optional(),laps:z.number().int().positive().optional(),corners:z.array(z.object({order:z.number().int().positive(),name:z.string(),maxSpeed:z.number()})).optional() });

tracksRouter.get('/', async (_q, res) => res.json((await db.query('select * from tracks order by name')).rows.map(mapTrack)));
tracksRouter.get('/:id', async (req, res) => {
  const row = (await db.query('select * from tracks where id=$1', [req.params.id])).rows[0];
  return row ? res.json(mapTrack(row)) : res.status(404).json({ error: 'Track not found.' });
});
tracksRouter.post('/', requireWrite, async (req, res) => {
  const v = body.parse(req.body);
  const row = (await db.query('insert into tracks(name,country,length_spaces,laps,corners) values($1,$2,$3,$4,$5) returning *', [v.name, v.country,v.lengthSpaces??null,v.laps??null,JSON.stringify(v.corners??[])])).rows[0];
  res.status(201).json(mapTrack(row));
});
tracksRouter.put('/:id', requireWrite, async (req, res) => {
  const v = body.parse(req.body);
  const row = (await db.query('update tracks set name=$1,country=$2,length_spaces=$3,laps=$4,corners=$5 where id=$6 returning *', [v.name, v.country,v.lengthSpaces??null,v.laps??null,JSON.stringify(v.corners??[]), req.params.id])).rows[0];
  return row ? res.json(mapTrack(row)) : res.status(404).json({ error: 'Track not found.' });
});
tracksRouter.delete('/:id', requireWrite, async (req, res) => {
  const result = await db.query('delete from tracks where id=$1', [req.params.id]);
  return result.rowCount ? res.status(204).end() : res.status(404).json({ error: 'Track not found.' });
});
