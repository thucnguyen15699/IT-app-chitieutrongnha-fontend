import { Fragment, useEffect, useState, type FormEvent } from "react";
import { createAdminUser, getAdminFamilies, getAdminUsers, resetUserPassword } from "./api";
import { FieldStatus, hasError, useFieldCheck } from "./FieldCheck";
import { formatDate } from "./format";
import type { AdminUser, FamilySummary } from "./types";

type AdminPanelProps = {
  token: string;
  onBack: () => void;
  onSignOut: () => void;
  /** Mở Dashboard ở chế độ xem (chỉ đọc) của một gia đình. */
  onViewFamily: (family: { id: number; name: string }) => void;
};

export default function AdminPanel({ token, onBack, onSignOut, onViewFamily }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [familyMode, setFamilyMode] = useState<"existing" | "new">("existing");
  const [familyId, setFamilyId] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Không gửi token: so trùng với mọi tài khoản (kể cả tài khoản admin).
  const usernameCheck = useFieldCheck("username", username);
  const emailCheck = useFieldCheck("email", email);
  const phoneCheck = useFieldCheck("phoneNumber", phone);
  const blocked = hasError(usernameCheck, emailCheck, phoneCheck);
  // Đặt lại mật khẩu cho một tài khoản (mở form ngay dưới dòng của tài khoản đó).
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetNotice, setResetNotice] = useState("");

  function openReset(userId: number | null) {
    setResetUserId(userId);
    setResetPassword("");
    setResetError("");
    setResetNotice("");
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetUserId === null) return;
    setResetBusy(true);
    setResetError("");
    try {
      const result = await resetUserPassword(token, resetUserId, resetPassword);
      openReset(null);
      setResetNotice(result.message);
    } catch (requestError) {
      setResetError(requestError instanceof Error ? requestError.message : "Không đặt lại được mật khẩu.");
    } finally {
      setResetBusy(false);
    }
  }

  async function refresh() {
    setError("");
    try {
      const [userList, familyList] = await Promise.all([getAdminUsers(token), getAdminFamilies(token)]);
      setUsers(userList);
      setFamilies(familyList);
      setFamilyId((current) => current || (familyList[0] ? String(familyList[0].id) : ""));
      if (familyList.length === 0) setFamilyMode("new");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được dữ liệu quản trị.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [token]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(formElement);
    try {
      const created = await createAdminUser(token, {
        name: String(form.get("name") ?? "").trim(),
        username: String(form.get("username") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        phoneNumber: String(form.get("phoneNumber") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        familyId: familyMode === "existing" ? Number(familyId) : null,
        familyName: familyMode === "new" ? String(form.get("familyName") ?? "").trim() : null,
      });
      formElement.reset();
      setUsername("");
      setEmail("");
      setPhone("");
      setNotice(`Đã tạo tài khoản ${created.username} trong gia đình "${created.familyName}". Người dùng đăng nhập bằng tên đăng nhập.`);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tạo được tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-page">
      <header className="topbar">
        <a className="brand" href="#" aria-label="NhaMinh trang chủ">
          <span className="brand-mark">n</span><span>NhaMinh</span>
        </a>
        <div className="topbar-actions">
          <button className="button button-install" type="button" onClick={onBack}>Trang chủ</button>
          <button className="avatar" aria-label="Đăng xuất" title="Đăng xuất" onClick={onSignOut}>A</button>
        </div>
      </header>

      <div className="admin-content">
        <span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span>
        <h1>Quản lý tài khoản & gia đình</h1>
        <p className="admin-intro">
          Mỗi gia đình chỉ thấy dữ liệu của mình. Quản trị viên có thể xem (không sửa) dữ liệu của bất kỳ gia đình nào.
        </p>

        <section className="admin-card">
          <h2>Tạo tài khoản</h2>
          <form className="admin-form" onSubmit={handleCreate}>
            <label htmlFor="admin-name">Họ tên</label>
            <input id="admin-name" name="name" required maxLength={100} />
            <label htmlFor="admin-username">Tên đăng nhập</label>
            <div className="admin-field">
              <input id="admin-username" name="username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]{3,50}" value={username} onChange={(event) => setUsername(event.target.value)} />
              <FieldStatus check={usernameCheck} />
            </div>
            <label htmlFor="admin-email">Email (không bắt buộc)</label>
            <div className="admin-field">
              <input id="admin-email" name="email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
              <FieldStatus check={emailCheck} />
            </div>
            <label htmlFor="admin-phone">Số điện thoại (không bắt buộc)</label>
            <div className="admin-field">
              <input id="admin-phone" name="phoneNumber" type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
              <FieldStatus check={phoneCheck} />
            </div>

            <span className="admin-form-label">Gia đình</span>
            <div className="segmented admin-family-mode" role="group" aria-label="Cách gán gia đình">
              <button type="button" className={familyMode === "existing" ? "active" : ""} aria-pressed={familyMode === "existing"} disabled={families.length === 0} onClick={() => setFamilyMode("existing")}>Gia đình có sẵn</button>
              <button type="button" className={familyMode === "new" ? "active" : ""} aria-pressed={familyMode === "new"} onClick={() => setFamilyMode("new")}>Tạo gia đình mới</button>
            </div>
            {familyMode === "existing" ? (
              <>
                <label htmlFor="admin-family-id">Chọn gia đình</label>
                <select id="admin-family-id" value={familyId} required onChange={(event) => setFamilyId(event.target.value)}>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>{family.name} — {family.memberCount} thành viên</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="admin-family">Tên gia đình mới</label>
                <input id="admin-family" name="familyName" required maxLength={120} />
              </>
            )}
            <label htmlFor="admin-password">Mật khẩu ban đầu</label>
            <input id="admin-password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="form-success" role="status">{notice}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy || blocked}>
              {busy ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-heading">
            <h2>Các gia đình ({families.length})</h2>
            <button className="text-button" type="button" onClick={() => void refresh()}>Làm mới</button>
          </div>
          {loading ? <p>Đang tải...</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Tên gia đình</th><th>Thành viên</th><th>Ngày tạo</th><th /></tr>
                </thead>
                <tbody>
                  {families.map((family) => (
                    <tr key={family.id}>
                      <td>{family.name}</td>
                      <td>{family.memberCount}</td>
                      <td>{formatDate(family.createdAt.slice(0, 10))}</td>
                      <td>
                        <button type="button" className="transaction-edit-button" onClick={() => onViewFamily({ id: family.id, name: family.name })}>
                          Xem dữ liệu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="section-heading">
            <h2>Tài khoản hiện có ({users.length})</h2>
          </div>
          {resetNotice && <div className="form-success" role="status">{resetNotice}</div>}
          {loading ? <p>Đang tải...</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Gia đình</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th><th /></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <Fragment key={user.id}>
                      <tr>
                        <td>{user.username}</td>
                        <td>{user.name}</td>
                        <td>{user.familyName ?? <em>Chưa có</em>}</td>
                        <td>{user.email ?? "—"}</td>
                        <td>{user.phoneNumber ?? "—"}</td>
                        <td>{user.roles.join(", ")}</td>
                        <td>
                          <button
                            type="button"
                            className="transaction-edit-button"
                            aria-expanded={resetUserId === user.id}
                            onClick={() => openReset(resetUserId === user.id ? null : user.id)}
                          >
                            {resetUserId === user.id ? "Đóng" : "Đổi mật khẩu"}
                          </button>
                        </td>
                      </tr>
                      {resetUserId === user.id && (
                        <tr>
                          <td colSpan={7}>
                            <form className="admin-form" onSubmit={handleResetPassword}>
                              <label htmlFor={`reset-password-${user.id}`}>Mật khẩu mới cho {user.username}</label>
                              <input
                                id={`reset-password-${user.id}`}
                                type="password"
                                value={resetPassword}
                                required
                                minLength={8}
                                maxLength={72}
                                autoComplete="new-password"
                                placeholder="Ít nhất 8 ký tự"
                                autoFocus
                                onChange={(event) => setResetPassword(event.target.value)}
                              />
                              {resetError && <div className="form-error" role="alert">{resetError}</div>}
                              <button className="button button-primary" type="submit" disabled={resetBusy || resetPassword.length < 8}>
                                {resetBusy ? "Đang lưu..." : "Đặt mật khẩu mới"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
