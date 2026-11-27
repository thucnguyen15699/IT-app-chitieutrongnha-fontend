import { useEffect, useRef } from "react";

/** Chu kỳ tải lại dự phòng: dữ liệu người khác nhập hiện lên chậm nhất sau khoảng thời gian này. */
export const AUTO_REFRESH_MS = 10_000;

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
    document.addEventListener("visibilitychange", run);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", run);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
