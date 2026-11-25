import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushStatus, isIos, sendTestPush, type PushStatus } from "./push";

type NotificationSettingsProps = {
  token: string;
  /** "card": thẻ đầy đủ ở trang Thông tin tài khoản. "banner": lời mời bật ngắn gọn ở Tổng quan. */
  variant?: "card" | "banner";
  onOpenSettings?: () => void;
};

const BANNER_DISMISSED_KEY = "nhaminh_push_banner_dismissed";

export default function NotificationSettings({ token, variant = "card", onOpenSettings }: NotificationSettingsProps) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus("unsupported"));
  }, []);

  async function run(action: () => Promise<PushStatus | void>, success?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await action();
      if (next) setStatus(next);
      if (success) setNotice(success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thực hiện được.");
    } finally {
      setBusy(false);
    }
  }

  if (status === null) return null;

  // ---- Lời mời bật ở trang Tổng quan: chỉ hiện khi có thể bật mà chưa bật ----
  if (variant === "banner") {
    if (dismissed || (status !== "off" && status !== "ios-needs-install")) return null;
    const dismiss = () => {
      setDismissed(true);
      try {
        localStorage.setItem(BANNER_DISMISSED_KEY, "1");
      } catch {
        /* không lưu được thì lần sau hiện lại, không sao */
      }
    };
    return (
      <div className="push-banner" role="status">
        <span className="push-banner-icon" aria-hidden="true">🔔</span>
        <span className="push-banner-text">
          {status === "ios-needs-install"
            ? "Muốn nhận thông báo khi người nhà thêm khoản thu/chi? Hãy thêm NhaMinh vào màn hình chính trước."
            : "Bật thông báo để biết ngay khi người nhà thêm khoản thu hoặc chi."}
        </span>
        <div className="push-banner-actions">
          {status === "off" ? (
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void run(() => enablePush(token), "Đã bật thông báo.")}>
              Bật thông báo
            </button>
          ) : (
            <button type="button" className="button button-primary" onClick={onOpenSettings}>Xem cách làm</button>
          )}
          <button type="button" className="button button-install" onClick={dismiss}>Để sau</button>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    );
  }

  // ---- Thẻ cài đặt đầy đủ ----
  return (
    <section className="content-card notification-card" aria-label="Thông báo">
      <span className="eyebrow">THÔNG BÁO TRÊN THIẾT BỊ NÀY</span>
      <h2 className="family-section-title">Thông báo</h2>
      <p className="notification-intro">Nhận thông báo khi thành viên khác trong gia đình thêm khoản thu hoặc chi.</p>

      {status === "on" && (
        <>
          <p className="notification-state notification-on">✓ Đang bật trên thiết bị này</p>
          <div className="transaction-form-actions">
            <button type="button" className="button button-primary" disabled={busy} onClick={() => void run(async () => {
              const result = await sendTestPush(token);
              setNotice(result.sent > 0 ? "Đã gửi thông báo thử, kiểm tra điện thoại nhé." : "Chưa gửi được. Hãy tắt rồi bật lại thông báo.");
            })}>Gửi thử</button>
            <button type="button" className="button button-install" disabled={busy} onClick={() => void run(() => disablePush(token), "Đã tắt thông báo trên thiết bị này.")}>
              Tắt
            </button>
          </div>
        </>
      )}

      {status === "off" && (
        <button type="button" className="button button-primary transaction-submit" disabled={busy}
          onClick={() => void run(() => enablePush(token), "Đã bật thông báo. Bấm \"Gửi thử\" để kiểm tra.")}>
          {busy ? "Đang bật..." : "Bật thông báo"}
        </button>
      )}

      {status === "ios-needs-install" && (
        <div className="notification-help">
          <p><b>iPhone/iPad cần thêm app vào màn hình chính</b> mới nhận được thông báo (iOS 16.4 trở lên):</p>
          <ol>
            <li>Mở trang này bằng <b>Safari</b>.</li>
            <li>Chạm nút <b>Chia sẻ</b> <span aria-hidden="true">(□↑)</span> → <b>Thêm vào MH chính</b>.</li>
            <li>Mở <b>NhaMinh</b> từ biểu tượng ngoài màn hình chính, đăng nhập, vào lại mục này và bấm <b>Bật thông báo</b>.</li>
          </ol>
        </div>
      )}

      {status === "denied" && (
        <div className="notification-help">
          <p><b>Thông báo đang bị chặn</b> cho NhaMinh. Mở lại quyền rồi tải lại trang:</p>
          <ul>
            {isIos()
              ? <li>iPhone: <b>Cài đặt → Thông báo → NhaMinh</b> → bật <b>Cho phép thông báo</b>.</li>
              : <li>Android (Chrome): chạm biểu tượng ổ khóa cạnh địa chỉ → <b>Quyền</b> → <b>Thông báo</b> → Cho phép. Nếu đã cài app: <b>Cài đặt → Ứng dụng → NhaMinh → Thông báo</b>.</li>}
          </ul>
        </div>
      )}

      {status === "unsupported" && (
        <p className="notification-help">Trình duyệt này chưa hỗ trợ thông báo. Hãy dùng Chrome (Android/máy tính) hoặc Safari trên iOS 16.4+.</p>
      )}

      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
    </section>
  );
}
