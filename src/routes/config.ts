import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { readConfig } from '../config/repository.ts';

export const configRoute = new Hono<AppEnv>();

configRoute.get('/', (c) => c.json(readConfig(c.get('db'))));
