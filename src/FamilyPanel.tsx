import { useEffect, useState, type FormEvent } from "react";
import { cancelFamilyInvitation, getMyFamily, inviteToFamily, renameFamily } from "./api";
import { formatDate } from "./format";
import type { FamilyDetails } from "./types";

type FamilyPanelProps = {
  token: string;
  /** Đổi tên gia đình xong thì cập nhật tên hiển thị ở menu. */
  onRenamed: (name: string) => void;
};

const ROLE_LABEL: Record<string, string> = { OWNER: "Chủ gia đình", MEMBER: "Thành viên" };

/** Trang "Gia đình": thành viên, mời người thân bằng email/SĐT, lời mời đang chờ. */
export default function FamilyPanel({ token, onRenamed }: FamilyPanelProps) {
  const [family, setFamily] = useState<FamilyDetails | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getMyFamily(token)
      .then(setFamily)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Không tải được gia đình."));
  }, [token]);

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await renameFamily(token, name.trim());
      setFamily(updated);
      setEditingName(false);
      onRenamed(updated.name);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không đổi được tên.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError("Nhập email hoặc số điện thoại của người cần mời.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await inviteToFamily(token, { email: email.trim(), phoneNumber: phone.trim(), message: message.trim() });
      setFamily((current) => current && { ...current, pendingInvitations: [result.invitation, ...current.pendingInvitations] });
      setEmail("");
      setPhone("");
      setMessage("");
      setNotice(result.note);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không gửi được lời mời.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(id: number) {
    if (!window.confirm("Hủy lời mời này?")) return;
    setError("");
    try {
      await cancelFamilyInvitation(token, id);
      setFamily((current) => current && { ...current, pendingInvitations: current.pendingInvitations.filter((entry) => entry.id !== id) });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không hủy được lời mời.");
    }
  }

  if (!family) {
    return error ? <p className="transaction-empty" role="alert">{error}</p> : <p className="transaction-empty">Đang tải...</p>;
  }

  return (
    <div className="family-layout">
      <section className="content-card" aria-label="Thành viên gia đình">
        <span className="eyebrow">GIA ĐÌNH CỦA BẠN</span>
        {editingName ? (
          <form className="inline-add-form family-rename" onSubmit={handleRename}>
            <input autoFocus value={name} required maxLength={120} aria-label="Tên gia đình" onChange={(event) => setName(event.target.value)} />
            <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>Lưu</button>
            <button className="button button-install" type="button" onClick={() => setEditingName(false)}>Hủy</button>
          </form>
        ) : (
          <div className="family-title-row">
            <h2>{family.name}</h2>
            {family.canManage && (
              <button type="button" className="link-button" onClick={() => { setName(family.name); setEditingName(true); }}>Đổi tên</button>
            )}
          </div>
        )}
        <ul className="manage-list">
          {family.members.map((member) => (
            <li key={member.userId}>
              <span className="member-avatar" aria-hidden="true">{member.name.charAt(0).toUpperCase()}</span>
              <strong>{member.name}{member.me ? " (bạn)" : ""}<small>@{member.username} · từ {formatDate(member.joinedAt.slice(0, 10))}</small></strong>
              <span className={`manage-badge${member.role === "OWNER" ? " manage-badge-custom" : ""}`}>{ROLE_LABEL[member.role] ?? member.role}</span>
            </li>
          ))}
        </ul>
        {family.myRole === "ADMIN_VIEW" && (
          <p className="manage-hint">Bạn đang xem gia đình này với quyền quản trị (chỉ xem).</p>
        )}
      </section>

      {family.canInvite && (
        <section className="content-card" aria-label="Mời người thân">
          <span className="eyebrow">THÊM NGƯỜI THÂN</span>
          <h2 className="family-section-title">Mời vào gia đình</h2>
          <form className="transaction-form" onSubmit={handleInvite}>
            <label htmlFor="invite-email">Email</label>
            <input id="invite-email" type="email" value={email} maxLength={254} placeholder="nguoithan@email.com" autoComplete="off" onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="invite-phone">Hoặc / và số điện thoại</label>
            <input id="invite-phone" type="tel" inputMode="tel" value={phone} maxLength={30} placeholder="0912 345 678" autoComplete="off" onChange={(event) => setPhone(event.target.value)} />
            <label htmlFor="invite-message">Lời nhắn (không bắt buộc)</label>
            <input id="invite-message" value={message} maxLength={255} placeholder="Ví dụ: Anh vào nhà mình để cùng ghi chi tiêu nhé" onChange={(event) => setMessage(event.target.value)} />
            <p className="invite-note">
              <b>Lưu ý:</b> chỉ cần một trong hai, email hoặc số điện thoại. Nếu người được mời <b>đã có tài khoản</b> dùng đúng
              email/số điện thoại này, họ chỉ cần <b>đăng nhập</b> là thấy lời mời và chọn <b>Đồng ý</b> hoặc <b>Từ chối</b>.
              Nếu chưa có tài khoản, họ đăng ký bằng đúng email/số điện thoại đó (có thể bỏ trống tên gia đình) rồi đăng nhập.
              Mời bằng email thì hệ thống sẽ gửi thêm thư báo.
            </p>
            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="form-success" role="status">{notice}</div>}
            <button className="button button-primary transaction-submit" type="submit" disabled={busy || (!email.trim() && !phone.trim())}>
              {busy ? "Đang gửi..." : "Gửi lời mời"}
            </button>
          </form>

          {family.pendingInvitations.length > 0 && (
            <>
              <h3 className="family-subtitle">Lời mời đang chờ</h3>
              <ul className="manage-list">
                {family.pendingInvitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span className="manage-dot target-dot" aria-hidden="true" />
                    <strong>
                      {[invitation.email, invitation.phoneNumber].filter(Boolean).join(" · ")}
                      <small>{invitation.invitedByName} mời · {formatDate(invitation.createdAt.slice(0, 10))}</small>
                    </strong>
                    <button type="button" className="transaction-edit-button planned-delete" onClick={() => void handleCancel(invitation.id)}>Hủy</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
