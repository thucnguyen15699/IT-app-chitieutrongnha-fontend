// Bật/tắt thông báo đẩy trên thiết bị hiện tại.
// - Android / máy tính: Chrome, Edge, Firefox hỗ trợ trực tiếp.
// - iPhone/iPad: cần iOS/iPadOS 16.4+ VÀ phải mở app từ biểu tượng ngoài màn hình chính
//   (Safari → Chia sẻ → Thêm vào màn hình chính). Mở trong Safari thường sẽ không có thông báo.

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export type PushStatus =
  | "unsupported"     // trình duyệt không hỗ trợ
  | "ios-needs-install" // iPhone chưa mở từ màn hình chính
  | "denied"          // người dùng đã chặn thông báo
  | "off"             // chưa bật
  | "on";             // đang bật trên thiết bị này

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (isIos()) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Máy tính Windows";
  if (/Mac/.test(ua)) return "Máy Mac";
  return "Trình duyệt";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const toBase64Url = (buffer: ArrayBuffer | null) =>
  buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error: unknown) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

async function api(token: string, path: string, body?: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Không kết nối được máy chủ thông báo.");
  }
  return response.status === 204 ? null : response.json();
}

export async function getPushStatus(): Promise<PushStatus> {
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/** Phải gọi trực tiếp từ thao tác bấm nút (iOS bắt buộc). */
export async function enablePush(token: string): Promise<PushStatus> {
  if (!supported()) return getPushStatus();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = (await api(token, "/push/public-key")) as { publicKey: string };
  let subscription = await registration.pushManager.getSubscription();
  // Đăng ký cũ với khóa server khác (vd. đổi server) thì đăng ký lại.
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && currentKey && toBase64Url(currentKey) !== publicKey) {
    await subscription.unsubscribe();
    subscription = null;
  }
  // Đăng ký với máy chủ push (Apple/Google). Mạng kém có thể treo: quá 25 giây thì báo lỗi thay vì chờ mãi.
  subscription ??= await withTimeout(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }),
    25_000,
    "Không kết nối được dịch vụ thông báo của điện thoại. Kiểm tra mạng rồi thử lại.",
  );
  await api(token, "/push/subscriptions", {
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(subscription.getKey("p256dh")),
    auth: toBase64Url(subscription.getKey("auth")),
    deviceLabel: deviceLabel(),
  });
  return "on";
}

export async function disablePush(token: string): Promise<PushStatus> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api(token, "/push/subscriptions/remove", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  }
  return "off";
}

export async function sendTestPush(token: string) {
  return (await api(token, "/push/test", {})) as { sent: number; removed: number };
}

/** Sau khi đăng nhập: thiết bị đã bật thì gửi lại đăng ký cho server (vd. đổi tài khoản trên cùng máy). */
export async function resyncPush(token: string) {
  if ((await getPushStatus()) === "on") await enablePush(token).catch(() => undefined);
}
