import { useState, type FormEvent } from "react";
import { resendEmailVerification, updateProfile } from "./api";
import { FieldStatus, hasError, useFieldCheck } from "./FieldCheck";
import type { UserProfile } from "./types";

type ProfilePanelProps = {
  token: string;
  user: UserProfile;
  onUpdated: (user: UserProfile) => void;
};

/** Trang "Thông tin cá nhân": họ tên, email (cần xác minh), số điện thoại (không cần OTP). */
export default function ProfilePanel({ token, user, onUpdated }: ProfilePanelProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.pendingEmail ?? user.email ?? "");
  const [phone, setPhone] = useState(user.phoneNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Kiểm tra trùng/định dạng khi đang gõ; giữ nguyên giá trị cũ thì không cần kiểm tra.
  const emailCheck = useFieldCheck("email", email, { token, unchanged: user.pendingEmail ?? user.email });
  const phoneCheck = useFieldCheck("phoneNumber", phone, { token, unchanged: user.phoneNumber });
  const blocked = hasError(emailCheck, phoneCheck);
  const changed = name.trim() !== user.name
    || email.trim().toLowerCase() !== (user.pendingEmail ?? user.email ?? "")
    || phone.trim() !== (user.phoneNumber ?? "");

  function resetForm() {
    setName(user.name);
    setEmail(user.pendingEmail ?? user.email ?? "");
    setPhone(user.phoneNumber ?? "");
    setError("");
    setNotice("");
  }

  const missing = [!user.email && !user.pendingEmail ? "email" : null, !user.phoneNumber ? "số điện thoại" : null]
    .filter(Boolean)
    .join(" và ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await updateProfile(token, { name: name.trim(), email: email.trim(), phoneNumber: phone.trim() });
      onUpdated(result.user);
      setEmail(result.user.pendingEmail ?? result.user.email ?? "");
      setPhone(result.user.phoneNumber ?? "");
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được thông tin.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError("");
    setNotice("");
    try {
      setNotice((await resendEmailVerification(token)).message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không gửi lại được thư.");
    }
  }

  return (
    <section className="content-card profile-card" aria-label="Thông tin cá nhân">
      <div className="profile-head">
        <span className="profile-avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
        <div>
          <span className="eyebrow">TÀI KHOẢN</span>
          <h2>{user.name}</h2>
          <p>@{user.username}{user.familyName ? ` · ${user.familyName}` : ""}</p>
        </div>
      </div>

      {missing && (
        <div className="profile-missing" role="status">
          Tài khoản của bạn còn thiếu <b>{missing}</b>. Vui lòng bổ sung để người thân mời bạn vào gia đình và để lấy lại tài khoản khi cần.
        </div>
      )}

      <form className="transaction-form" onSubmit={handleSubmit}>
        <label htmlFor="profile-name">Họ tên</label>
        <input id="profile-name" value={name} required maxLength={100} autoComplete="name" onChange={(event) => setName(event.target.value)} />

        <label htmlFor="profile-username">Tên đăng nhập</label>
        <input id="profile-username" value={user.username} disabled readOnly />

        <div className="label-row">
          <label htmlFor="profile-email">Email <span className="required-mark">*</span></label>
          {user.email && user.emailVerified && !user.pendingEmail && <span className="status-chip status-ok">✓ Đã xác minh</span>}
          {user.pendingEmail && <span className="status-chip status-wait">Chờ xác minh</span>}
        </div>
        <input
          id="profile-email"
          type="email"
          value={email}
          required
          maxLength={254}
          autoComplete="email"
          placeholder="ban@email.com"
          aria-describedby="profile-email-check"
          aria-invalid={emailCheck.status === "error"}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldStatus check={emailCheck} id="profile-email-check" />
        {user.pendingEmail ? (
          <p className="field-hint">
            Đã gửi thư xác minh tới <b>{user.pendingEmail}</b>. Mở thư và bấm liên kết để dùng email này
            {user.email ? <> (hiện vẫn dùng <b>{user.email}</b>)</> : null}.{" "}
            <button type="button" className="link-button inline" onClick={() => void handleResend()}>Gửi lại thư</button>
          </p>
        ) : (
          <p className="field-hint">Nếu hệ thống yêu cầu xác minh, email mới chỉ có hiệu lực sau khi bạn bấm liên kết trong thư.</p>
        )}

        <label htmlFor="profile-phone">Số điện thoại <span className="required-mark">*</span></label>
        <input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          required
          maxLength={30}
          autoComplete="tel"
          placeholder="0912 345 678"
          aria-describedby="profile-phone-check"
          aria-invalid={phoneCheck.status === "error"}
          onChange={(event) => setPhone(event.target.value)}
        />
        <FieldStatus check={phoneCheck} id="profile-phone-check" />
        <p className="field-hint">Điền sai thì sửa lại rồi bấm Lưu. Số điện thoại được lưu ngay, không cần mã OTP.</p>

        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}
        <div className="transaction-form-actions">
          <button className="button button-primary transaction-submit" type="submit" disabled={busy || blocked || !changed}>
            {busy ? "Đang lưu..." : "Lưu thông tin"}
          </button>
          {changed && (
            <button className="button button-install transaction-cancel" type="button" disabled={busy} onClick={resetForm}>
              Khôi phục
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
