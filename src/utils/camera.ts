export type CameraProblem = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'other';

/** Why the camera can't start, before even trying. null = looks fine. */
export function checkCameraSupport(): CameraProblem | null {
  if (typeof window === 'undefined') return 'unsupported';
  // Browsers hide the camera entirely on plain http pages (except localhost)
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return null;
}

export function classifyCameraError(err: unknown): CameraProblem {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'other';
}

/** The https address of this same page (e.g. https://192.168.1.50:3443/), if the server offers one. */
export async function findSecureAddress(): Promise<string | null> {
  if (window.location.protocol === 'https:') return null;
  try {
    const res = await fetch('/api/health');
    const { httpsPort } = await res.json();
    if (!httpsPort) return null;
    return `https://${window.location.hostname}:${httpsPort}${window.location.pathname}`;
  } catch {
    return null;
  }
}
