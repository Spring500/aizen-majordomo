import type { AppConfig } from '../types.ts';
import { parseResponse } from './cards.ts';

export async function getConfig(): Promise<AppConfig> {
  const res = await fetch('/config');
  return parseResponse<AppConfig>(res);
}
