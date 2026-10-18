export const abortException = (): DOMException => new DOMException('aborted', 'AbortError');

/** Stop waiting promptly; still observe a late rejection from work that ignores its signal. */
export function abortable<T>(value: T | Promise<T>, signal: AbortSignal): Promise<T> {
  if (!(value instanceof Promise) && !(value && typeof (value as { then?: unknown }).then === 'function')) {
    return signal.aborted ? Promise.reject(abortException()) : Promise.resolve(value);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(abortException());
    };
    void Promise.resolve(value).then(
      result => { signal.removeEventListener('abort', onAbort); resolve(result); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

export const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(abortException()); return; }
  if (ms <= 0) { resolve(); return; }
  const onAbort = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    reject(abortException());
  };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
});
