export function isDev(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
