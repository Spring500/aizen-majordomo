import type { WorkspaceConfig } from '../types.ts';
import { parseResponse } from './cards.ts';

export async function getConfig(): Promise<WorkspaceConfig> {
  const res = await fetch('/config');
  return parseResponse<WorkspaceConfig>(res);
}
