import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import type { Plan } from './PlanTypes.js';

export async function loadPlan(path: string): Promise<Plan> {
  const content = await readFile(path, 'utf8');
  const data = YAML.parse(content);
  if (!data || typeof data !== 'object') throw new Error('Invalid plan: not an object');
  if (!data.name || !Array.isArray(data.steps)) throw new Error('Invalid plan: missing fields');
  return data as Plan;
}
