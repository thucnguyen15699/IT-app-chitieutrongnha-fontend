import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import AdminPanel from "./AdminPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import CategoriesPanel from "./CategoriesPanel";
import PlannedExpensesPanel from "./PlannedExpensesPanel";
import SavingsPanel from "./SavingsPanel";
import GoldPanel from "./GoldPanel";
import FamilyPanel from "./FamilyPanel";
import InvitationsInbox from "./InvitationsInbox";
import NoFamilyScreen from "./NoFamilyScreen";
import ProfilePanel from "./ProfilePanel";
import NotificationSettings from "./NotificationSettings";
import { disablePush, resyncPush } from "./push";
import { FieldStatus, hasError, useFieldCheck } from "./FieldCheck";
import Sidebar, { PAGE_TITLE, useDateFromHash, usePage } from "./Sidebar";
import { useAutoRefresh } from "./autoRefresh";
import { formatAmountInput, formatCurrency, toDateInput } from "./format";
import {
  createSpendingTarget,
  createTransaction,
  createTransactionCategory,
  getCurrentUser,
  getMonthlyTransactions,
  getAdminFamilies,
  getMyInvitations,
  getPlannedExpenses,
  getPlanningSummary,
  setViewingFamily,
  getSpendingTargets,
  getTransactionCategories,
  login,
  register,
  updateTransaction,
  verifyEmail,
} from "./api";
import type {
  AuthMode,
  FamilySummary,
  FamilyTransaction,
  IncomingInvitation,
  PlannedExpense,
  PlanningSummary,
  SpendingTarget,
  TransactionCategory,
  TransactionType,
  UserProfile,
} from "./types";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const formatCompactCurrency = (amount: number) => {
  const value = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  if (amount >= 1_000_000_000) return `${value.format(amount / 1_000_000_000)}tỷ`;
  if (amount >= 1_000_000) return `${value.format(amount / 1_000_000)}tr`;
  if (amount >= 1_000) return `${value.format(amount / 1_000)}k`;
  return value.format(amount);
};

const toMonthInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [view, setView] = useState<"dashboard" | "admin">("dashboard");
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("nhaminh_token");
    const verificationToken = new URLSearchParams(window.location.search).get("verify");
    const sessionCheck = savedToken
      ? getCurrentUser(savedToken)
          .then(setUser)
          .catch(() => localStorage.removeItem("nhaminh_token"))
      : Promise.resolve();
    const verificationCheck = verificationToken
      ? verifyEmail(verificationToken)
          .then((response) => setNotice(response.message))
          .catch((verificationError: unknown) => {
            setNotice(verificationError instanceof Error ? verificationError.message : "Không xác minh được email.");
          })
          .finally(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("verify");
            window.history.replaceState({}, "", url.toString());
          })
      : Promise.resolve();
    Promise.all([sessionCheck, verificationCheck]).finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    return () => window.removeEventListener("beforeinstallprompt", onInstallAvailable);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const username = String(form.get("username") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phoneNumber = String(form.get("phoneNumber") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const familyName = String(form.get("familyName") ?? "").trim();

    try {
      if (mode === "login") {
        const result = await login(username, password);
        localStorage.setItem("nhaminh_token", result.token);
        setUser(result.user);
      } else {
        const result = await register(name, username, email, phoneNumber, password, familyName);
        setNotice(result.message);
        setMode("login");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể kết nối máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    // Đăng xuất thì thiết bị này thôi nhận thông báo của gia đình (máy dùng chung).
    const currentToken = localStorage.getItem("nhaminh_token");
    if (currentToken) void disablePush(currentToken).catch(() => undefined);
    localStorage.removeItem("nhaminh_token");
    chooseViewFamily(null);
    setUser(null);
    setView("dashboard");
    setMode("login");
  }

  /** Quản trị viên chọn gia đình để xem (null = gia đình của mình). */
  const [viewFamily, setViewFamily] = useState<{ id: number; name: string } | null>(null);
  function chooseViewFamily(family: { id: number; name: string } | null) {
    setViewingFamily(family?.id ?? null);
    setViewFamily(family);
  }

  /** Tải lại hồ sơ, ví dụ sau khi tạo gia đình hoặc nhận lời mời. */
  function reloadProfile() {
    const token = localStorage.getItem("nhaminh_token");
    if (token) getCurrentUser(token).then(setUser).catch(() => undefined);
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="brand-mark">n</span><p>Đang mở nhà mình...</p></main>;
  }

  const isAdmin = user?.roles.includes("ADMIN") ?? false;
  const token = localStorage.getItem("nhaminh_token") ?? "";

  return user ? (
    view === "admin" && isAdmin ? (
      <AdminPanel
        token={token}
        onBack={() => setView("dashboard")}
        onSignOut={signOut}
        onViewFamily={(family) => {
          // Chọn đúng gia đình của mình thì không cần chế độ "chỉ xem".
          chooseViewFamily(family.id === user.familyId ? null : family);
          setView("dashboard");
        }}
      />
    ) : user.familyId === null && viewFamily === null ? (
      <NoFamilyScreen token={token} user={user} onJoined={reloadProfile} onSignOut={signOut} />
    ) : (
      <Dashboard
        // Đổi gia đình đang xem thì dựng lại toàn bộ để mọi dữ liệu tải lại.
        key={viewFamily?.id ?? "own"}
        token={token}
        user={user}
        viewFamily={viewFamily}
        onChooseFamily={chooseViewFamily}
        onFamilyRenamed={(name) => setUser((current) => current && { ...current, familyName: name })}
        onProfileUpdated={setUser}
        onAdmin={() => setView("admin")}
        onSignOut={signOut}
        onInstall={installApp}
        canInstall={Boolean(installPrompt)}
      />
    )
  ) : (
    <AuthScreen
      mode={mode}
      setMode={setMode}
      onSubmit={handleSubmit}
      error={error}
      notice={notice}
      busy={busy}
    />
  );
}

type AuthScreenProps = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  notice: string;
  busy: boolean;
};

function AuthScreen({ mode, setMode, onSubmit, error, notice, busy }: AuthScreenProps) {
  const isRegister = mode === "register";
  // Chỉ kiểm tra trùng khi đăng ký; lúc đăng nhập thì để trống để không gọi API.
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const usernameCheck = useFieldCheck("username", isRegister ? username : "");
  const emailCheck = useFieldCheck("email", isRegister ? email : "");
  const phoneCheck = useFieldCheck("phoneNumber", isRegister ? phone : "");
  const blocked = isRegister && hasError(usernameCheck, emailCheck, phoneCheck);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand"><span className="brand-mark">n</span><span>NhaMinh</span></div>
        <div className="story-copy">
          <span className="eyebrow">MỘT NHÀ, MỘT KẾ HOẠCH</span>
          <h1>Chi tiêu nhẹ nhàng.<br /><em>Nhà mình an tâm.</em></h1>
          <p>Cùng những người thân yêu theo dõi từng khoản chi, vun vén cho những dự định chung.</p>
        </div>
        <div className="story-note"><span>✦</span> Mọi khoản chi, cả nhà cùng rõ.</div>
        <div className="decor decor-one" /><div className="decor decor-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand brand"><span className="brand-mark">n</span><span>NhaMinh</span></div>
          <span className="eyebrow">{isRegister ? "BẮT ĐẦU CÙNG NHAU" : "CHÀO MỪNG BẠN TRỞ LẠI"}</span>
          <h2>{isRegister ? "Tạo nhà của bạn" : "Đăng nhập nhé"}</h2>
          <p className="auth-subtitle">
            {isRegister ? "Tạo tài khoản để cả gia đình cùng quản lý chi tiêu." : "Đăng nhập để xem tình hình chi tiêu của gia đình."}
          </p>

          <form onSubmit={onSubmit} className="auth-form">
            {isRegister && (
              <>
                <label htmlFor="name">Tên của bạn</label>
                <input id="name" name="name" placeholder="Ví dụ: Minh Anh" autoComplete="name" required maxLength={100} />
                <label htmlFor="familyName">Đặt tên gia đình nhỏ của bạn</label>
                <input id="familyName" name="familyName" placeholder="Ví dụ: Nhà Mình" maxLength={120} />
                <small className="field-hint">
                  Được người thân mời vào gia đình? Bỏ trống ô này, đăng ký bằng đúng email/số điện thoại được mời,
                  rồi đăng nhập để nhận lời mời.
                </small>
              </>
            )}
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              name="username"
              placeholder="Ví dụ: minhanh"
              autoComplete="username"
              required
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9._-]{3,50}"
              value={username}
              aria-describedby={isRegister ? "username-check" : undefined}
              onChange={(event) => setUsername(event.target.value)}
            />
            {isRegister && <FieldStatus check={usernameCheck} id="username-check" />}
            {isRegister && (
              <>
                <label htmlFor="email">Email xác minh</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ban@email.com"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  aria-describedby="email-check"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <FieldStatus check={emailCheck} id="email-check" />
                <label htmlFor="phoneNumber">Số điện thoại (không bắt buộc)</label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  placeholder="Số điện thoại"
                  autoComplete="tel"
                  maxLength={30}
                  value={phone}
                  aria-describedby="phone-check"
                  onChange={(event) => setPhone(event.target.value)}
                />
                <FieldStatus check={phoneCheck} id="phone-check" />
              </>
            )}
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder={isRegister ? "Ít nhất 8 ký tự" : "Nhập mật khẩu của bạn"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : 1}
              maxLength={72}
            />
            {error && <div className="form-error" role="alert">{error}</div>}
            {notice && <div className="form-success" role="status">{notice}</div>}
            {blocked && <div className="form-error" role="alert">Vui lòng sửa các thông tin đang báo đỏ trước khi đăng ký.</div>}
            <button type="submit" className="button button-primary auth-submit" disabled={busy || blocked}>
              {busy ? "Đang xử lý..." : isRegister ? "Tạo tài khoản gia đình" : "Đăng nhập"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? "Đã có tài khoản?" : "Lần đầu đến đây?"}{" "}
            <button type="button" onClick={() => setMode(isRegister ? "login" : "register")}>
              {isRegister ? "Đăng nhập" : "Tạo gia đình"}
            </button>
          </div>
          <p className="privacy-note"><span>⌑</span> Mật khẩu của bạn được bảo vệ an toàn.</p>
        </div>
      </section>
    </main>
  );
}

type DashboardProps = {
  token: string;
  user: UserProfile;
  /** Gia đình quản trị viên đang xem (chỉ đọc); null = gia đình của mình. */
  viewFamily: { id: number; name: string } | null;
  onChooseFamily: (family: { id: number; name: string } | null) => void;
  onFamilyRenamed: (name: string) => void;
  onProfileUpdated: (user: UserProfile) => void;
  onAdmin: () => void;
  onSignOut: () => void;
  onInstall: () => void;
  canInstall: boolean;
};

function Dashboard({
  token,
  user,
  viewFamily,
  onChooseFamily,
  onFamilyRenamed,
  onProfileUpdated,
  onAdmin,
  onSignOut,
  onInstall,
  canInstall,
}: DashboardProps) {
  const isAdmin = user.roles.includes("ADMIN");
  /** Thiếu email (kể cả chưa có email chờ xác minh) hoặc thiếu số điện thoại. */
  const profileIncomplete = (!user.email && !user.pendingEmail) || !user.phoneNumber;
  const [invitations, setInvitations] = useState<IncomingInvitation[]>([]);
  const [adminFamilies, setAdminFamilies] = useState<FamilySummary[]>([]);

  useEffect(() => {
    getMyInvitations(token).then(setInvitations).catch(() => setInvitations([]));
    // Thiết bị đã bật thông báo: gửi lại đăng ký cho server (vd. vừa đổi tài khoản trên cùng máy).
    void resyncPush(token);
    if (isAdmin) getAdminFamilies(token).then(setAdminFamilies).catch(() => setAdminFamilies([]));
  }, [token, isAdmin]);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(new Date()));
  // Bấm thông báo "#/tong-quan?ngay=YYYY-MM-DD" → mở đúng ngày/tháng của giao dịch.
  useDateFromHash((date) => selectDate(date));
  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [targets, setTargets] = useState<SpendingTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState("");
  const [transactions, setTransactions] = useState<FamilyTransaction[]>([]);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [transactionNotice, setTransactionNotice] = useState("");
  const [transactionBusy, setTransactionBusy] = useState(false);
  const [statsVersion, setStatsVersion] = useState(0);
  const [transactionsVersion, setTransactionsVersion] = useState(0);
  const silentRefreshRef = useRef(false);
  const [planningVersion, setPlanningVersion] = useState(0);
  const [planning, setPlanning] = useState<PlanningSummary | null>(null);
  const [plannedItems, setPlannedItems] = useState<PlannedExpense[]>([]);
  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [page, navigate] = usePage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nhaminh_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const amountInputRef = useRef<HTMLInputElement>(null);
  const firstName = user.name.split(" ")[0] || user.name;
  const monthKey = toMonthInput(month);
  const currentMonthKey = toMonthInput(new Date());
  const selectedTransactions = transactions.filter((transaction) => transaction.occurredOn === selectedDate);
  const incomeTotal = transactions
    .filter((transaction) => transaction.type === "INCOME")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expenseTotal = transactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, { income: number; expense: number }>();
    for (const transaction of transactions) {
      const current = totals.get(transaction.occurredOn) ?? { income: 0, expense: 0 };
      if (transaction.type === "INCOME") current.income += transaction.amount;
      else current.expense += transaction.amount;
      totals.set(transaction.occurredOn, current);
    }
    return totals;
  }, [transactions]);
  const selectedDayTotals = dailyTotals.get(selectedDate);
  // Khoản sắp phải chi theo ngày hạn — hiện trên lịch bằng màu cam, khác thu/chi đã ghi.
  const plannedByDay = useMemo(() => {
    const byDay = new Map<string, { total: number; items: PlannedExpense[] }>();
    for (const item of plannedItems) {
      const current = byDay.get(item.dueOn) ?? { total: 0, items: [] };
      current.total += item.amount;
      current.items.push(item);
      byDay.set(item.dueOn, current);
    }
    return byDay;
  }, [plannedItems]);
  const selectedDayPlanned = plannedByDay.get(selectedDate);
  const todayKey = toDateInput(new Date());
  const selectedIsFuture = selectedDate > todayKey;
  // Cho xem trước tối đa 12 tháng tới để thấy các khoản sắp chi.
  const lastViewableMonthKey = toMonthInput(new Date(new Date().getFullYear(), new Date().getMonth() + 12, 1));
  const calendarDays = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, monthIndex + 1, 0).getDate();
    const days: Array<number | null> = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => index + 1),
    ];
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [month]);

  useEffect(() => {
    let active = true;
    // Cập nhật ngầm (xem effect tự cập nhật bên dưới): không xóa/hiện lỗi để khỏi làm phiền form đang nhập.
    const silent = silentRefreshRef.current;
    silentRefreshRef.current = false;
    if (!silent) setTransactionError("");
    getMonthlyTransactions(token, monthKey)
      .then((response) => {
        if (active) setTransactions(response.transactions);
      })
      .catch((requestError: unknown) => {
        if (active && !silent) {
          setTransactionError(requestError instanceof Error ? requestError.message : "Không tải được dữ liệu thu chi.");
        }
      });
    return () => {
      active = false;
    };
  }, [token, monthKey, transactionsVersion]);

  useEffect(() => {
    let active = true;
    getPlanningSummary(token, monthKey)
      .then((summary) => {
        if (active) setPlanning(summary);
      })
      .catch(() => {
        if (active) setPlanning(null);
      });
    return () => {
      active = false;
    };
  }, [token, monthKey, planningVersion, statsVersion]);

  // Tự cập nhật khi người khác trong nhà thêm dữ liệu (chậm nhất ~10 giây), không cần tải lại trang.
  useAutoRefresh(() => {
    silentRefreshRef.current = true;
    setTransactionsVersion((version) => version + 1);
    setStatsVersion((version) => version + 1);
  });

  // Khoản sắp phải chi (chưa chi) để hiện trên lịch; tải lại khi có thay đổi kế hoạch hoặc giao dịch.
  useEffect(() => {
    getPlannedExpenses(token).then(setPlannedItems).catch(() => setPlannedItems([]));
  }, [token, planningVersion, transactionsVersion]);

  // Ngăn kéo trên điện thoại: phím Esc để đóng, khóa cuộn trang phía sau khi đang mở.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-lock");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("drawer-lock");
    };
  }, [drawerOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      try {
        localStorage.setItem("nhaminh_sidebar_collapsed", current ? "0" : "1");
      } catch {
        /* bộ nhớ trình duyệt bị chặn thì chỉ không nhớ được trạng thái */
      }
      return !current;
    });
  }

  function goTo(next: typeof page) {
    navigate(next);
    setDrawerOpen(false);
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setTransactionError("");
    try {
      const created = await createTransactionCategory(token, name, transactionType);
      setCategories((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, "vi")));
      setCategoryId(String(created.id));
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (requestError) {
      setTransactionError(requestError instanceof Error ? requestError.message : "Không thêm được danh mục.");
    }
  }

  /** Khoản sắp chi vừa "Đã chi" thì giao dịch, thống kê và các ô tổng đều phải tải lại. */
  function handlePlannedChanged() {
    setPlanningVersion((version) => version + 1);
    setTransactionsVersion((version) => version + 1);
    setStatsVersion((version) => version + 1);
  }

  const pendingTotal = planning?.pendingTotal ?? 0;
  const savingsNet = planning?.savingsNetInMonth ?? 0;
  const goldSpent = planning?.goldSpentInMonth ?? 0;
  // Tiền gửi tiết kiệm và tiền mua vàng trong tháng đều đã rời khỏi ví.
  const putAside = savingsNet + goldSpent;
  const walletRemaining = incomeTotal - expenseTotal - pendingTotal - putAside;

  useEffect(() => {
    let active = true;
    setCategories([]);
    getTransactionCategories(token, transactionType)
      .then((availableCategories) => {
        if (active) {
          setCategories(availableCategories);
          setCategoryId((current) =>
            availableCategories.some((category) => String(category.id) === current)
              ? current
              : availableCategories[0] ? String(availableCategories[0].id) : "",
          );
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setTransactionError(requestError instanceof Error ? requestError.message : "Không tải được danh mục.");
        }
      });
    return () => {
      active = false;
    };
  }, [token, transactionType, categoriesVersion]);

  useEffect(() => {
    let active = true;
    getSpendingTargets(token)
      .then((availableTargets) => {
        if (!active) return;
        setTargets(availableTargets);
        // Mặc định chọn đối tượng đầu tiên ("Cả nhà").
        setTargetId((current) => current || (availableTargets[0] ? String(availableTargets[0].id) : ""));
      })
      .catch((requestError: unknown) => {
        if (active) {
          setTransactionError(requestError instanceof Error ? requestError.message : "Không tải được đối tượng chi tiêu.");
        }
      });
    return () => {
      active = false;
    };
  }, [token, categoriesVersion]);

  const defaultTargetId = targets[0] ? String(targets[0].id) : "";

  async function handleAddTarget() {
    const name = newTargetName.trim();
    if (!name) return;
    setTransactionError("");
    try {
      const created = await createSpendingTarget(token, name);
      setTargets((current) => [...current, created]);
      setStatsVersion((version) => version + 1);
      setTargetId(String(created.id));
      setNewTargetName("");
      setAddingTarget(false);
    } catch (requestError) {
      setTransactionError(requestError instanceof Error ? requestError.message : "Không thêm được đối tượng.");
    }
  }

  function changeMonth(offset: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(nextMonth);
    const selectedDay = Number(selectedDate.slice(-2));
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const dayLimit = toMonthInput(nextMonth) === currentMonthKey ? new Date().getDate() : lastDay;
    setSelectedDate(toDateInput(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selectedDay, lastDay, dayLimit))));
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    const [year, monthNumber] = date.split("-").map(Number);
    setMonth(new Date(year, monthNumber - 1, 1));
  }

  function startEditing(transaction: FamilyTransaction) {
    setTransactionError("");
    setTransactionNotice("");
    setEditingTransactionId(transaction.id);
    setTransactionType(transaction.type);
    setCategoryId(transaction.categoryId === null ? "" : String(transaction.categoryId));
    setTargetId(transaction.targetId === null ? defaultTargetId : String(transaction.targetId));
    setAmount(formatAmountInput(String(transaction.amount)));
    setNote(transaction.note ?? "");
    selectDate(transaction.occurredOn);
    document.getElementById("transaction-amount")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelEditing() {
    setEditingTransactionId(null);
    setAmount("");
    setNote("");
    setTargetId(defaultTargetId);
    setTransactionError("");
    setTransactionNotice("");
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const rawValue = input.value;
    const cursorPosition = input.selectionStart ?? rawValue.length;
    const digitsBeforeCursor = Math.min(rawValue.slice(0, cursorPosition).replace(/\D/g, "").length, 13);
    const formattedValue = formatAmountInput(rawValue);
    setAmount(formattedValue);
    requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      let nextCursor = 0;
      let digitsSeen = 0;
      while (nextCursor < formattedValue.length && digitsSeen < digitsBeforeCursor) {
        if (/\d/.test(formattedValue[nextCursor])) digitsSeen += 1;
        nextCursor += 1;
      }
      if (rawValue.slice(0, cursorPosition).endsWith(",") && formattedValue[nextCursor] === ",") {
        nextCursor += 1;
      }
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransactionError("");
    setTransactionNotice("");
    setTransactionBusy(true);
    try {
      const request = {
        type: transactionType,
        categoryId: Number(categoryId),
        amount: Number(amount.replaceAll(",", "")),
        note,
        occurredOn: selectedDate,
        targetId: transactionType === "EXPENSE" && targetId ? Number(targetId) : null,
      };
      const saved = editingTransactionId === null
        ? await createTransaction(token, request)
        : await updateTransaction(token, editingTransactionId, request);
      setTransactions((current) =>
        [saved, ...current.filter((transaction) => transaction.id !== saved.id)]
          .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)),
      );
      setEditingTransactionId(null);
      setAmount("");
      setNote("");
      setStatsVersion((version) => version + 1);
      setTransactionNotice(editingTransactionId !== null
        ? "Đã cập nhật giao dịch."
        : transactionType === "INCOME" ? "Đã ghi nhận khoản thu." : "Đã ghi nhận khoản chi.");
    } catch (requestError) {
      setTransactionError(requestError instanceof Error ? requestError.message : "Không lưu được giao dịch.");
    } finally {
      setTransactionBusy(false);
    }
  }

  return (
    <div className={`app-shell${collapsed ? " collapsed" : ""}${drawerOpen ? " drawer-open" : ""}`}>
      <Sidebar
        page={page}
        onNavigate={goTo}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onClose={() => setDrawerOpen(false)}
        familyName={viewFamily?.name ?? user.familyName ?? ""}
        invitationCount={invitations.length}
        profileIncomplete={profileIncomplete}
        userName={user.name}
        isAdmin={user.roles.includes("ADMIN")}
        pendingCount={planning?.pendingCount ?? 0}
        onAdmin={() => { setDrawerOpen(false); onAdmin(); }}
        onInstall={() => {
          setDrawerOpen(false);
          if (canInstall) onInstall();
          else setShowInstallHelp(true);
        }}
        onSignOut={onSignOut}
      />
      <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setDrawerOpen(false)} />

    <main className="dashboard-page">
      <header className="topbar">
        <div className="topbar-title">
          <button
            type="button"
            className="sidebar-icon-button menu-button"
            aria-label="Mở menu"
            aria-controls="app-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <h1>{PAGE_TITLE[page]}</h1>
          {isAdmin && adminFamilies.length > 0 && (
            <select
              className="family-switcher"
              aria-label="Chọn gia đình để xem"
              value={viewFamily?.id ?? ""}
              onChange={(event) => {
                const chosen = adminFamilies.find((family) => String(family.id) === event.target.value);
                onChooseFamily(chosen && chosen.id !== user.familyId ? { id: chosen.id, name: chosen.name } : null);
              }}
            >
              <option value="">Gia đình của tôi</option>
              {adminFamilies
                .filter((family) => family.id !== user.familyId)
                .map((family) => (
                  <option key={family.id} value={family.id}>{family.name} ({family.memberCount})</option>
                ))}
            </select>
          )}
        </div>
        <div className="topbar-actions">
          {canInstall && (
            <button className="button button-install topbar-install" onClick={onInstall}><span>↓</span> Cài ứng dụng</button>
          )}
          <button className="avatar" aria-label={`Đăng xuất ${user.name}`} title="Đăng xuất" onClick={onSignOut}>{firstName.charAt(0).toUpperCase()}</button>
        </div>
      </header>

      {showInstallHelp && (
        <aside className="install-help">
          <button className="close-help" onClick={() => setShowInstallHelp(false)} aria-label="Đóng">×</button>
          <strong>Đưa NhaMinh ra màn hình chính</strong>
          <p>iPhone: chạm <b>Chia sẻ</b> → <b>Thêm vào màn hình chính</b>. Android: mở menu trình duyệt → <b>Cài đặt ứng dụng</b>.</p>
        </aside>
      )}

      <div className="dashboard-content">
        {viewFamily && (
          <div className="admin-view-banner" role="status">
            <span>Đang xem gia đình <b>{viewFamily.name}</b> với quyền quản trị — <b>chỉ xem</b>, không thể thêm hay sửa.</span>
            <button type="button" className="button button-install" onClick={() => onChooseFamily(null)}>Về gia đình của tôi</button>
          </div>
        )}
        {!viewFamily && (
          <InvitationsInbox
            token={token}
            invitations={invitations}
            onAccepted={() => window.location.reload()}
            onDeclined={(id) => setInvitations((current) => current.filter((entry) => entry.id !== id))}
          />
        )}
        {!viewFamily && profileIncomplete && page !== "profile" && (
          <div className="profile-missing profile-missing-banner" role="status">
            <span>
              Tài khoản còn thiếu{" "}
              <b>{[!user.email && !user.pendingEmail ? "email" : null, !user.phoneNumber ? "số điện thoại" : null].filter(Boolean).join(" và ")}</b>.
              Bổ sung để người thân có thể mời bạn và để lấy lại tài khoản khi cần.
            </span>
            <button type="button" className="button button-primary" onClick={() => goTo("profile")}>Bổ sung ngay</button>
          </div>
        )}
        {page === "overview" && !viewFamily && (
          <NotificationSettings token={token} variant="banner" onOpenSettings={() => goTo("profile")} />
        )}
        {page === "overview" && (<>
        <section className="welcome-row">
          <div>
            <span className="eyebrow">GÓC NHỎ CỦA GIA ĐÌNH</span>
            <h1>Chào {firstName}, <span className="wave">☀</span></h1>
            <p>Mình cùng xem tháng này nhà mình thế nào nhé.</p>
          </div>
          <div className="family-pill"><span className="family-icon">⌂</span><span><small>Gia đình</small><strong>{viewFamily?.name ?? user.familyName}</strong></span><span className="pill-dot" /></div>
        </section>

        <section className="summary-grid" aria-label="Tổng quan thu chi tháng">
          <article className="summary-card income-summary">
            <div className="card-heading"><span>Tổng thu tháng này</span><span className="summary-symbol">+</span></div>
            <strong className="amount">{formatCurrency(incomeTotal)}</strong>
            <p className="card-caption">Tổng các nguồn thu của gia đình</p>
          </article>
          <article className="summary-card">
            <div className="card-heading"><span>Tổng chi tháng này</span><span className="summary-symbol expense-symbol">-</span></div>
            <strong className="amount amount-expense">{expenseTotal > 0 ? "-" : ""}{formatCurrency(expenseTotal)}</strong>
            <p className="card-caption">Tổng các khoản chi của gia đình</p>
          </article>
          <article className="summary-card">
            <div className="card-heading"><span>Khoản sắp phải chi</span><span className="summary-symbol planned-symbol">◔</span></div>
            <strong className="amount">{formatCurrency(pendingTotal)}</strong>
            <p className="card-caption">
              {planning?.pendingCount ? `${planning.pendingCount} khoản đã biết trước, chưa chi` : "Chưa có khoản nào sắp chi"}
            </p>
          </article>
          <article className={`summary-card balance-summary${walletRemaining < 0 ? " wallet-negative" : ""}`}>
            <div className="card-heading"><span>Tiền trong ví còn lại</span><span className="icon-tile">◷</span></div>
            <strong className="amount">{formatCurrency(walletRemaining)}</strong>
            <p className="card-caption">
              {walletRemaining < 0
                ? "Không đủ tiền cho các khoản sắp chi!"
                : putAside !== 0
                  ? `Thu − chi − sắp chi − tiết kiệm & vàng (${formatCurrency(putAside)})`
                  : "Thu − đã chi − khoản sắp phải chi"}
            </p>
          </article>
        </section>

        <section className="transaction-layout">
          <article className="content-card calendar-card">
            <div className="section-heading calendar-heading">
              <div><span className="eyebrow">LỊCH SỬ GIA ĐÌNH</span><h2>Lịch thu chi</h2></div>
              <div className="month-navigation">
                <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(-1)}>‹</button>
                <strong>{new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(month)}</strong>
                <button type="button" aria-label="Tháng sau" disabled={monthKey >= lastViewableMonthKey} onClick={() => changeMonth(1)}>›</button>
              </div>
            </div>
            <div className="calendar-grid" role="grid" aria-label="Lịch giao dịch trong tháng">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((weekday) => (
                <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) return <div className="calendar-cell calendar-cell-empty" role="gridcell" key={`empty-${index}`} />;
                const date = toDateInput(new Date(month.getFullYear(), month.getMonth(), day));
                const totals = dailyTotals.get(date);
                const planned = plannedByDay.get(date);
                return (
                  <button
                    className={`calendar-cell${selectedDate === date ? " selected" : ""}${date > todayKey ? " future" : ""}`}
                    type="button"
                    role="gridcell"
                    aria-label={`${date}${totals ? `, thu ${formatCurrency(totals.income)}, chi ${formatCurrency(totals.expense)}` : ""}${planned ? `, sắp phải chi ${formatCurrency(planned.total)}` : ""}`}
                    aria-pressed={selectedDate === date}
                    key={date}
                    onClick={() => selectDate(date)}
                  >
                    <span className="calendar-day-number">{day}</span>
                    {totals?.income ? <span className="calendar-day-total income-total">+{formatCompactCurrency(totals.income)}</span> : null}
                    {totals?.expense ? <span className="calendar-day-total expense-total">-{formatCompactCurrency(totals.expense)}</span> : null}
                    {planned ? <span className="calendar-day-total planned-total" title="Khoản sắp phải chi">◷{formatCompactCurrency(planned.total)}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="calendar-legend">
              <span><i className="legend-dot income-dot" /> Thu</span>
              <span><i className="legend-dot expense-dot" /> Chi</span>
              <span><i className="legend-dot planned-dot" /> ◷ Sắp phải chi <small>(đến hạn tự ghi thành khoản chi)</small></span>
            </div>
          </article>

          <article className="content-card transaction-form-card">
            <span className="eyebrow">{editingTransactionId === null ? "GHI LẠI GIAO DỊCH" : "CHỈNH SỬA GIAO DỊCH"}</span>
            <h2>{editingTransactionId === null ? "Thêm khoản thu hoặc chi" : "Sửa thông tin giao dịch"}</h2>
            <div className="transaction-type-switch" role="group" aria-label="Loại giao dịch">
              <button
                type="button"
                className={transactionType === "EXPENSE" ? "active expense-choice" : ""}
                aria-pressed={transactionType === "EXPENSE"}
                onClick={() => setTransactionType("EXPENSE")}
              >Khoản chi</button>
              <button
                type="button"
                className={transactionType === "INCOME" ? "active income-choice" : ""}
                aria-pressed={transactionType === "INCOME"}
                onClick={() => setTransactionType("INCOME")}
              >Khoản thu</button>
            </div>
            <form className="transaction-form" onSubmit={handleTransactionSubmit}>
              <label htmlFor="transaction-date">Ngày giao dịch</label>
              <input
                id="transaction-date"
                type="date"
                value={selectedDate}
                max={toDateInput(new Date())}
                required
                onChange={(event) => selectDate(event.target.value)}
              />
              <div className="label-row">
                <label htmlFor="transaction-category">
                  {transactionType === "INCOME" ? "Nguồn thu" : "Danh mục chi"}
                </label>
                {!addingCategory && (
                  <button type="button" className="link-button" onClick={() => setAddingCategory(true)}>+ Danh mục mới</button>
                )}
              </div>
              <select
                id="transaction-category"
                value={categoryId}
                required
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
              {addingCategory && (
                <div className="target-add-row">
                  <input
                    autoFocus
                    value={newCategoryName}
                    maxLength={100}
                    placeholder={transactionType === "INCOME" ? "Nguồn thu mới" : "Danh mục chi mới, ví dụ: Thú cưng"}
                    aria-label="Tên danh mục mới"
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAddCategory();
                      } else if (event.key === "Escape") {
                        setAddingCategory(false);
                      }
                    }}
                  />
                  <button type="button" className="button button-primary" onClick={() => void handleAddCategory()} disabled={!newCategoryName.trim()}>Thêm</button>
                  <button type="button" className="button button-install" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}>Hủy</button>
                </div>
              )}
              {transactionType === "EXPENSE" && (
                <>
                  <span className="transaction-field-label" id="transaction-target-label">Chi cho ai?</span>
                  <div className="target-chips" role="radiogroup" aria-labelledby="transaction-target-label">
                    {targets.map((target) => (
                      <button
                        type="button"
                        role="radio"
                        key={target.id}
                        className={`target-chip${String(target.id) === targetId ? " active" : ""}`}
                        aria-checked={String(target.id) === targetId}
                        onClick={() => setTargetId(String(target.id))}
                      >{target.name}</button>
                    ))}
                    {!addingTarget && (
                      <button type="button" className="target-chip target-chip-add" onClick={() => setAddingTarget(true)}>
                        + Thêm
                      </button>
                    )}
                  </div>
                  {addingTarget && (
                    <div className="target-add-row">
                      <input
                        autoFocus
                        value={newTargetName}
                        maxLength={60}
                        placeholder="Ví dụ: Con lớn, Ông bà..."
                        aria-label="Tên đối tượng mới"
                        onChange={(event) => setNewTargetName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAddTarget();
                          } else if (event.key === "Escape") {
                            setAddingTarget(false);
                          }
                        }}
                      />
                      <button type="button" className="button button-primary" onClick={() => void handleAddTarget()} disabled={!newTargetName.trim()}>Thêm</button>
                      <button type="button" className="button button-install" onClick={() => { setAddingTarget(false); setNewTargetName(""); }}>Hủy</button>
                    </div>
                  )}
                </>
              )}
              <label htmlFor="transaction-amount">Số tiền (₫)</label>
              <input
                id="transaction-amount"
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                value={amount}
                required
                maxLength={17}
                autoComplete="off"
                placeholder="Ví dụ: 100,000"
                onChange={handleAmountChange}
              />
              <label htmlFor="transaction-note">
                Ghi chú {transactionType === "EXPENSE" ? "(món đã mua hoặc việc đã chi)" : "(không bắt buộc)"}
              </label>
              <input
                id="transaction-note"
                value={note}
                required={transactionType === "EXPENSE"}
                maxLength={500}
                placeholder={transactionType === "EXPENSE" ? "Ví dụ: mua thịt, đóng học..." : "Ví dụ: lương tháng 11"}
                onChange={(event) => setNote(event.target.value)}
              />
              {transactionError && <div className="form-error" role="alert">{transactionError}</div>}
              {transactionNotice && <div className="form-success" role="status">{transactionNotice}</div>}
              {selectedIsFuture && (
                <div className="future-date-hint" role="status">
                  Ngày này chưa tới nên chưa ghi được khoản đã chi. Khoản biết trước sẽ phải chi hãy thêm ở{" "}
                  <button type="button" className="link-button inline" onClick={() => goTo("planned")}>Khoản sắp phải chi</button>.
                </div>
              )}
              <div className="transaction-form-actions">
                <button
                  className="button button-primary transaction-submit"
                  type="submit"
                  disabled={transactionBusy || selectedIsFuture || !categories.some((category) => String(category.id) === categoryId)}
                >
                  {transactionBusy ? "Đang lưu..." : editingTransactionId !== null ? "Lưu thay đổi" : transactionType === "INCOME" ? "Lưu khoản thu" : "Lưu khoản chi"}
                </button>
                {editingTransactionId !== null && (
                  <button className="button button-install transaction-cancel" type="button" onClick={cancelEditing} disabled={transactionBusy}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>
          </article>
        </section>

        <section className="content-card daily-transactions">
          <div className="section-heading">
            <div><span className="eyebrow">GIAO DỊCH TRONG NGÀY</span><h2>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date(`${selectedDate}T00:00:00`))}</h2></div>
          </div>
          {transactionError && !transactions.length ? <p className="transaction-empty" role="alert">{transactionError}</p> : null}
          {selectedTransactions.length ? (
            <div className="transaction-list">
              {selectedTransactions.map((transaction) => (
                <article className="transaction-row" key={transaction.id}>
                  <div className={`transaction-type-mark ${transaction.type === "INCOME" ? "income-mark" : "expense-mark"}`}>
                    {transaction.type === "INCOME" ? "+" : "-"}
                  </div>
                  <div className="transaction-description">
                    <strong>
                      {transaction.categoryName}
                      {transaction.targetName && <em className="transaction-target-tag">{transaction.targetName}</em>}
                    </strong>
                    <span>{transaction.note || (transaction.type === "INCOME" ? "Khoản thu gia đình" : "Khoản chi gia đình")}</span>
                  </div>
                  <strong className={`transaction-amount ${transaction.type === "INCOME" ? "income-total" : "expense-total"}`}>
                    {transaction.type === "INCOME" ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </strong>
                  <button
                    className="transaction-edit-button"
                    type="button"
                    aria-label={`Sửa giao dịch ${transaction.categoryName}`}
                    onClick={() => startEditing(transaction)}
                  >Sửa</button>
                </article>
              ))}
            </div>
          ) : !selectedDayPlanned ? (
            <p className="transaction-empty">Chưa có giao dịch trong ngày này.</p>
          ) : null}
          {selectedDayPlanned && (
            <div className="transaction-list planned-day-list">
              {selectedDayPlanned.items.map((item) => (
                <article className="transaction-row planned-day-row" key={`planned-${item.id}`}>
                  <div className="transaction-type-mark planned-mark" aria-hidden="true">◷</div>
                  <div className="transaction-description">
                    <strong>
                      {item.categoryName}
                      <em className="transaction-target-tag">{item.targetName}</em>
                      <em className="planned-tag">{item.dueOn <= todayKey ? "Đến hạn hôm nay" : "Sắp phải chi"}</em>
                    </strong>
                    <span>{item.note} · tự ghi thành khoản chi vào ngày này</span>
                  </div>
                  <strong className="transaction-amount planned-total">-{formatCurrency(item.amount)}</strong>
                  <button className="transaction-edit-button" type="button" onClick={() => goTo("planned")}>Xem</button>
                </article>
              ))}
            </div>
          )}
          {(selectedDayTotals || selectedDayPlanned) && (
            <div className="daily-total-row">
              <span>Tổng ngày</span>
              {selectedDayTotals && selectedDayTotals.income > 0 && <strong className="income-total">+{formatCurrency(selectedDayTotals.income)}</strong>}
              {selectedDayTotals && selectedDayTotals.expense > 0 && <strong className="expense-total">-{formatCurrency(selectedDayTotals.expense)}</strong>}
              {selectedDayPlanned && <strong className="planned-total">◷ sắp chi -{formatCurrency(selectedDayPlanned.total)}</strong>}
            </div>
          )}
        </section>
        </>)}

        {page === "planned" && <PlannedExpensesPanel token={token} onChanged={handlePlannedChanged} />}
        {page === "savings" && (
          <>
            <SavingsPanel token={token} onChanged={() => setPlanningVersion((version) => version + 1)} />
            <GoldPanel token={token} onChanged={() => setPlanningVersion((version) => version + 1)} />
          </>
        )}
        {page === "analytics" && <AnalyticsPanel token={token} refreshKey={statsVersion} />}
        {page === "family" && (
          <FamilyPanel token={token} section="members" onRenamed={onFamilyRenamed} onGoInvite={() => goTo("invite")} />
        )}
        {page === "invite" && (
          <FamilyPanel token={token} section="invite" onRenamed={onFamilyRenamed} onGoInvite={() => goTo("invite")} />
        )}
        {page === "profile" && (
          <>
            <ProfilePanel token={token} user={user} onUpdated={onProfileUpdated} />
            <NotificationSettings token={token} />
          </>
        )}
        {page === "categories" && (
          <CategoriesPanel token={token} onChanged={() => setCategoriesVersion((version) => version + 1)} />
        )}
        <footer className="dashboard-footer">Một kế hoạch nhỏ, thêm nhiều ngày vui <span>♡</span></footer>
      </div>
    </main>
    </div>
  );
}

export default App;
