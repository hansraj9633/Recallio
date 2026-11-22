export interface BrowserStorageEstimate {
  usage: number;
  quota: number;
  supported: boolean;
  persisted: boolean | null;
}

export async function getBrowserStorageEstimate(): Promise<BrowserStorageEstimate> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { usage: 0, quota: 0, supported: false, persisted: null };
  }
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({ usage: 0, quota: 0 }),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(null),
    ]);
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      supported: true,
      persisted,
    };
  } catch {
    return { usage: 0, quota: 0, supported: false, persisted: null };
  }
}

export async function requestPersistentStorage(): Promise<{
  supported: boolean;
  granted: boolean;
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { supported: false, granted: false };
  }
  try {
    const granted = await navigator.storage.persist();
    return { supported: true, granted };
  } catch {
    return { supported: true, granted: false };
  }
}

export function isVolumeControlSupported(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return !isIOS;
}
