import { type Application } from '@/api/client';

export function getStoredActiveAppId(): string | null {
  try {
    return localStorage.getItem('reframex_active_app_id');
  } catch {
    return null;
  }
}

export function setStoredActiveAppId(appId: string): void {
  try {
    localStorage.setItem('reframex_active_app_id', appId);
    window.dispatchEvent(new CustomEvent('reframex-app-changed', { detail: { appId } }));
  } catch {
    // ignore
  }
}

export function resolveActiveApp(apps: Application[], preferredId?: string | null): Application | null {
  if (!apps || apps.length === 0) return null;
  const targetId = preferredId || getStoredActiveAppId();
  if (targetId && targetId !== 'portfolio') {
    const found = apps.find((a) => a.id === targetId);
    if (found) return found;
  }
  return apps.find((a) => a.is_active) ?? apps[0] ?? null;
}
