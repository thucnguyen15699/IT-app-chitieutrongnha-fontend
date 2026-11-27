import { useState } from "react";
import { acceptInvitation, declineInvitation } from "./api";
import { formatDate } from "./format";
import type { IncomingInvitation } from "./types";

type InvitationsInboxProps = {
  token: string;
  invitations: IncomingInvitation[];
  /** Sau khi đồng ý: người dùng có thêm gia đình mới (vẫn giữ gia đình cũ). */
  onAccepted: (familyId: number) => void;
  onDeclined: (id: number) => void;
};

/** Danh sách lời mời vào gia đình mà người dùng nhận được, kèm nút Đồng ý / Từ chối. */
export default function InvitationsInbox({ token, invitations, onAccepted, onDeclined }: InvitationsInboxProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (invitations.length === 0) return null;

  async function handleAccept(invitation: IncomingInvitation) {
    const warning = `Tham gia gia đình "${invitation.familyName}"?\n\nBạn vẫn giữ các gia đình đang có và chuyển qua lại được ở menu bên trái.`;
    if (!window.confirm(warning)) return;
    setBusyId(invitation.id);
    setError("");
    try {
      const result = await acceptInvitation(token, invitation.id);
      onAccepted(result.familyId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không nhận được lời mời.");
      setBusyId(null);
    }
  }

  async function handleDecline(invitation: IncomingInvitation) {
    if (!window.confirm(`Từ chối lời mời vào gia đình "${invitation.familyName}"?`)) return;
    setBusyId(invitation.id);
    setError("");
    try {
      await declineInvitation(token, invitation.id);
      onDeclined(invitation.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không từ chối được.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="invite-inbox" aria-label="Lời mời vào gia đình">
      <div className="invite-inbox-head">
        <span className="invite-inbox-icon" aria-hidden="true">✉</span>
        <div>
          <strong>Bạn có {invitations.length} lời mời vào gia đình</strong>
          <p>Đồng ý để cùng quản lý chi tiêu, hoặc từ chối nếu không quen người mời.</p>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <ul className="invite-inbox-list">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <div className="invite-inbox-text">
              <strong>{invitation.familyName}</strong>
              <span>
                {invitation.invitedByName} mời bạn · {formatDate(invitation.createdAt.slice(0, 10))} ·
                qua {invitation.matchedBy === "EMAIL" ? "email" : "số điện thoại"}
              </span>
              {invitation.message && <q>{invitation.message}</q>}
            </div>
            <div className="invite-inbox-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={busyId !== null}
                onClick={() => void handleAccept(invitation)}
              >{busyId === invitation.id ? "Đang xử lý..." : "Đồng ý"}</button>
              <button
                type="button"
                className="button button-install"
                disabled={busyId !== null}
                onClick={() => void handleDecline(invitation)}
              >Từ chối</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
