import { useEffect, useRef } from "react";

/** Chu kỳ tải lại dự phòng: dữ liệu người khác nhập hiện lên chậm nhất sau khoảng thời gian này. */
export const AUTO_REFRESH_MS = 10_000;

/**
 * Các sự kiện "app vừa quay lại màn hình". App thêm ra màn hình chính trên iOS không phải lúc nào
 * cũng phát visibilitychange khi mở lại từ nền, nên nghe thêm pageshow (khôi phục từ bộ nhớ),
 * focus và online (vừa có mạng lại).
 */
const RESUME_EVENTS = ["visibilitychange", "pageshow", "focus", "online"] as const;

/** Gọi fn mỗi khi app quay lại màn hình; trả về hàm hủy. */
export function onAppResume(fn: () => void): () => void {
  let last = 0;
  const handler = () => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - last < 1000) return; // nhiều sự kiện cùng lúc khi mở lại → chỉ chạy một lần
    last = now;
    fn();
  };
  RESUME_EVENTS.forEach((name) => window.addEventListener(name, handler));
  document.addEventListener("visibilitychange", handler);
  return () => {
    RESUME_EVENTS.forEach((name) => window.removeEventListener(name, handler));
    document.removeEventListener("visibilitychange", handler);
  };
}

/**
 * Tự gọi refresh khi người khác trong nhà có thể vừa đổi dữ liệu, không cần tải lại trang:
 * 1) có thông báo đẩy → service worker báo sang (tức thì);
 * 2) quay lại app (mở từ màn hình chính / chuyển từ app khác);
 * 3) mỗi AUTO_REFRESH_MS khi app đang hiện trên màn hình (app chạy nền thì không tải, đỡ tốn pin).
 * refresh nên chạy "im lặng": lỗi mạng không hiện thông báo lỗi, không bật trạng thái "Đang tải".
 */
export function useAutoRefresh(refresh: () => void, intervalMs = AUTO_REFRESH_MS) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "nhaminh:data-changed") run();
    };
    const stopResume = onAppResume(run);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      stopResume();
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
