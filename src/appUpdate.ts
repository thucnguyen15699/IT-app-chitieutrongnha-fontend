import { onAppResume } from "./autoRefresh";

/** Bao lâu kiểm tra bản mới một lần khi app đang mở. */
const CHECK_EVERY_MS = 60_000;

/** File JS chính của bản đang chạy, vd. "/assets/index-Go-6uc7o.js" (tên đổi sau mỗi lần build). */
function currentBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return script ? new URL(script.src).pathname : null;
}

function isTyping(): boolean {
  const element = document.activeElement;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

/**
 * App thêm ra màn hình chính trên iOS giữ nguyên code cũ trong bộ nhớ tới khi tắt hẳn app,
 * nên sau mỗi lần deploy người dùng vẫn chạy bản cũ. Hàm này so tên file JS trên server với bản
 * đang chạy; khác nhau thì tải lại trang (khi quay lại app, hoặc khi không đang gõ dở).
 */
export function watchForNewVersion() {
  const running = currentBundle();
  if (!running) return; // chế độ dev (vite) không có file build

  let checking = false;
  const check = async (fromResume: boolean) => {
    if (checking || document.visibilityState !== "visible") return;
    checking = true;
    try {
      void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
      const response = await fetch("/", { cache: "no-store" });
      if (!response.ok) return;
      const latest = (await response.text()).match(/\/assets\/index-[\w-]+\.js/)?.[0];
      if (latest && latest !== running && (fromResume || !isTyping())) {
        window.location.reload();
      }
    } catch {
      /* mất mạng: thử lại lần sau */
    } finally {
      checking = false;
    }
  };

  onAppResume(() => void check(true));
  window.setInterval(() => void check(false), CHECK_EVERY_MS);
}
