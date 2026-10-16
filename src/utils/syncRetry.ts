export function syncRetryDelay(attempt: number): number {
  const retryNumber = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return Math.min(1000 * 2 ** Math.min(retryNumber - 1, 5), 30000);
}

export function attachOnlineRetry(target: EventTarget, retry: () => void): () => void {
  const handleOnline = () => retry();
  target.addEventListener('online', handleOnline);
  return () => target.removeEventListener('online', handleOnline);
}

export function shouldWarnBeforeUnload(hasUnsavedChanges: boolean, role: string): boolean {
  return hasUnsavedChanges && role !== 'viewer';
}
