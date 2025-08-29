// src/lib/push.ts
import { apiGet, apiPost } from "./api";

/** Converte VAPID base64url em ArrayBuffer (BufferSource aceito pelo PushManager). */
function urlBase64ToArrayBuffer(b64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buf; // <- ArrayBuffer “clássico”, satisfaz o TS (BufferSource)
}

type VapidKeyResponse = { key: string };

function isValidNpub(n?: string | null): n is string {
  return typeof n === "string" && /^npub1[0-9a-z]+$/.test(n);
}

type SubscribeBody = {
  subscription: PushSubscriptionJSON;
  npub?: string;
  label?: string;
  segment?: string;
};

type SubscribeResponse = {
  ok: boolean;
  id: number;
  endpoint: string;
};

const DEFAULT_SEGMENT =
  import.meta.env.MODE === "development" ? "dev" : "prod";

/** Solicita permissão de notificação, se necessário. */
async function ensureNotificationPermission(): Promise<void> {
  if (Notification.permission === "granted") return;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission denied");
}

/** Garante que há um Service Worker ativo e retorna o registration. */
async function getSWRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker not supported");
  }
  return navigator.serviceWorker.ready;
}

/** Obtém (ou cria) uma PushSubscription válida. */
async function getOrCreateSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const { key } = await apiGet<VapidKeyResponse>("/vapid-public-key");
  const applicationServerKey: BufferSource = urlBase64ToArrayBuffer(key);

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

/** Serializa a assinatura em JSON padrão (endpoint, keys.p256dh, keys.auth). */
function toJSON(sub: PushSubscription): PushSubscriptionJSON {
  // PushSubscription.toJSON é parte da spec e presente nos browsers modernos
  return (sub as PushSubscription & { toJSON(): PushSubscriptionJSON }).toJSON();
}

/**
 * Faz a inscrição e envia para o backend. Reutiliza a existente quando possível.
 * @param npub opcional; será enviada somente se válida (npub1…)
 * @param label rótulo da subscription (ex.: "web")
 * @param segment segmento (ex.: "dev" | "prod"); por padrão deduz do ambiente
 */
export async function subscribeToPush(
  npub?: string,
  label = "web",
  segment = DEFAULT_SEGMENT
): Promise<SubscribeResponse> {
  if (!("PushManager" in window)) throw new Error("Push not supported");

  await ensureNotificationPermission();
  const reg = await getSWRegistration();

  const sub = await getOrCreateSubscription(reg);
  const subJson = toJSON(sub);

  const body: SubscribeBody = { subscription: subJson, label, segment };
  if (isValidNpub(npub)) body.npub = npub;

  const res = await apiPost<SubscribeResponse, SubscribeBody>("/subscribe", body);
  return res;
}

/** Cancela a inscrição de push no navegador (não remove do seu backend). */
export async function unsubscribeFromPush(): Promise<boolean> {
  const reg = await getSWRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  return sub.unsubscribe();
}

/** Retorna informações do status atual de push no cliente. */
export async function getPushStatus(): Promise<{
  permission: NotificationPermission;
  hasSW: boolean;
  hasSubscription: boolean;
  endpoint?: string;
}> {
  const permission = Notification.permission;
  const hasSW = "serviceWorker" in navigator;
  let hasSubscription = false;
  let endpoint: string | undefined;

  if (hasSW) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      hasSubscription = !!sub;
      endpoint = sub?.endpoint;
    } catch {
      /* ignore */
    }
  }

  return { permission, hasSW, hasSubscription, endpoint };
}