import { type CdeebeeSettings, type CdeebeeModule } from './types';

export function checkModule(settings: CdeebeeSettings<unknown>, module: CdeebeeModule, result: () => void) {
  if (settings.modules.includes(module)) {
    result();
  }
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export  function hasDataProperty(value: unknown): value is Record<string, unknown> & { data: unknown[] } {
  return isRecord(value) && Array.isArray(value.data);
}

export  function hasProperty(value: unknown, prop: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, prop);
}

