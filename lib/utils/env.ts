interface ProcessLike {
  env?: Record<string, string | undefined>;
}

export function isDev(): boolean {
  try {
    const processLike = (globalThis as { process?: ProcessLike }).process;
    return processLike !== undefined && processLike.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
