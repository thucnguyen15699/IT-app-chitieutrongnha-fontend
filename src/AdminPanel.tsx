import { useEffect, useState, type FormEvent } from "react";
import { createAdminUser, getAdminUsers } from "./api";
import type { AdminUser } from "./types";

type AdminPanelProps = {
  token: string;
  onBack: () => void;
  onSignOut: () => void;
};

export default function AdminPanel({ token, onBack, onSignOut }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshUsers() {
    setError("");
    try {
      setUsers(await getAdminUsers(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshUsers();
  }, [token]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(formElement);
    try {
      await createAdminUser(token, {
        name: String(form.get("name") ?? "").trim(),
        username: String(form.get("username") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        phoneNumber: String(form.get("phoneNumber") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        familyName: String(form.get("familyName") ?? "").trim(),
      });
      formElement.reset();
      setNotice("Đã tạo tài khoản. Người dùng có thể đăng nhập bằng tên đăng nhập.");
      await refreshUsers();
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
        <h1>Quản lý tài khoản</h1>
        <p className="admin-intro">Tạo tài khoản thành viên. Email không bắt buộc khi quản trị viên tạo tài khoản.</p>

        <section className="admin-card">
          <h2>Tạo tài khoản</h2>
          <form className="admin-form" onSubmit={handleCreate}>
            <label htmlFor="admin-name">Họ tên</label>
            <input id="admin-name" name="name" required maxLength={100} />
            <label htmlFor="admin-username">Tên đăng nhập</label>
            <input id="admin-username" name="username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]{3,50}" />
            <label htmlFor="admin-email">Email (không bắt buộc)</label>
            <input id="admin-email" name="email" type="email" maxLength={254} />
            <label htmlFor="admin-phone">Số điện thoại (không bắt buộc)</label>
            <input id="admin-phone" name="phoneNumber" type="tel" maxLength={30} />
            <label htmlFor="admin-family">Tên gia đình</label>
            <input id="admin-family" name="familyName" required maxLength={120} />
            <label htmlFor="admin-password">Mật khẩu ban đầu</label>
            <input id="admin-password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="form-success" role="status">{notice}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>
              {busy ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-heading">
            <h2>Tài khoản hiện có</h2>
            <button className="text-button" type="button" onClick={() => void refreshUsers()}>Làm mới</button>
          </div>
          {loading ? <p>Đang tải...</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.name}</td>
                      <td>{user.email ?? "—"}</td>
                      <td>{user.phoneNumber ?? "—"}</td>
                      <td>{user.roles.join(", ")}</td>
                    </tr>
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
