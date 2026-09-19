/** Stop waiting promptly; still observe a late rejection from work that ignores its signal. */
export function abortable<T>(value: T | Promise<T>, signal: AbortSignal): Promise<T> {
  if (!(value instanceof Promise) && !(value && typeof (value as { then?: unknown }).then === 'function')) {
    return signal.aborted ? Promise.reject(new DOMException('aborted', 'AbortError')) : Promise.resolve(value);
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('aborted', 'AbortError'));
    };
    void Promise.resolve(value).then(
      result => { signal.removeEventListener('abort', onAbort); resolve(result); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}
