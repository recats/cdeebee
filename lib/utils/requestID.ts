let counter = 0;

export function generateRequestID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
