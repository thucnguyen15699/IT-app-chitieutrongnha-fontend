import { useEffect, useState, type FormEvent } from "react";
import { createFamily, getMyInvitations } from "./api";
import InvitationsInbox from "./InvitationsInbox";
import type { IncomingInvitation, UserProfile } from "./types";

type NoFamilyScreenProps = {
  token: string;
  user: UserProfile;
  /** Đã vào một gia đình (tạo mới hoặc nhận lời mời): tải lại hồ sơ. */
  onJoined: () => void;
  onSignOut: () => void;
};

/** Màn hình cho người dùng chưa thuộc gia đình nào: nhận lời mời hoặc tự tạo gia đình. */
export default function NoFamilyScreen({ token, user, onJoined, onSignOut }: NoFamilyScreenProps) {
  const [invitations, setInvitations] = useState<IncomingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyName, setFamilyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyInvitations(token)
      .then(setInvitations)
      .catch(() => setInvitations([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createFamily(token, familyName.trim());
      onJoined();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tạo được gia đình.");
      setBusy(false);
    }
  }

  return (
    <main className="no-family-page">
      <header className="topbar">
        <span className="brand"><span className="brand-mark">n</span><span>NhaMinh</span></span>
        <button className="button button-install" type="button" onClick={onSignOut}>Đăng xuất</button>
      </header>
      <div className="no-family-content">
        <span className="eyebrow">CHÀO {user.name.toUpperCase()}</span>
        <h1>Bạn chưa thuộc gia đình nào</h1>
        <p className="no-family-intro">
          Nếu người thân đã mời bạn bằng email hoặc số điện thoại của tài khoản này, lời mời sẽ hiện ở dưới.
          Nếu không, hãy tự tạo gia đình rồi mời mọi người vào sau.
        </p>

        {loading ? (
          <p className="transaction-empty">Đang kiểm tra lời mời...</p>
        ) : invitations.length > 0 ? (
          <InvitationsInbox
            token={token}
            invitations={invitations}
            onAccepted={onJoined}
            onDeclined={(id) => setInvitations((current) => current.filter((entry) => entry.id !== id))}
          />
        ) : (
          <p className="no-family-empty">
            Chưa có lời mời nào cho {user.email ?? "email của bạn"}{user.phoneNumber ? ` hoặc số ${user.phoneNumber}` : ""}.
          </p>
        )}

        <section className="content-card no-family-create">
          <h2>Tạo gia đình mới</h2>
          <form className="inline-add-form" onSubmit={handleCreate}>
            <input
              value={familyName}
              required
              maxLength={120}
              placeholder="Đặt tên gia đình nhỏ của bạn, ví dụ: Nhà Mình"
              aria-label="Tên gia đình"
              onChange={(event) => setFamilyName(event.target.value)}
            />
            <button className="button button-primary" type="submit" disabled={busy || !familyName.trim()}>
              {busy ? "Đang tạo..." : "Tạo gia đình"}
            </button>
          </form>
          {error && <div className="form-error" role="alert">{error}</div>}
        </section>
      </div>
    </main>
  );
}
