import type {
  AdminCreateUser,
  AdminUser,
  AuthResponse,
  CreateTransaction,
  FamilyDetails,
  FamilySummary,
  GoldOverview,
  GoldPurchaseInput,
  FamilyTransaction,
  IncomingInvitation,
  InviteResult,
  ContributionType,
  PlannedExpense,
  PlannedExpenseInput,
  PlanningSummary,
  RegistrationResponse,
  SavingsGoal,
  SavingsGoalInput,
  SpendingStats,
  SpendingTarget,
  TransactionCategory,
  TransactionType,
  UserProfile,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Gia đình quản trị viên đang chọn để xem (chỉ đọc). null = gia đình của chính mình.
 * Backend chỉ chấp nhận header này với tài khoản ADMIN.
 */
let viewingFamilyId: number | null = null;
export function setViewingFamily(familyId: number | null) {
  viewingFamilyId = familyId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    // Không dùng bản lưu tạm (Safari/iOS, Cloudflare): luôn lấy dữ liệu mới nhất từ server.
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(viewingFamilyId !== null ? { "X-Family-Id": String(viewingFamilyId) } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Có lỗi xảy ra. Vui lòng thử lại.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function login(username: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function register(
  name: string,
  username: string,
  email: string,
  phoneNumber: string,
  password: string,
  familyName: string,
) {
  return request<RegistrationResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, username, email, phoneNumber, password, familyName }),
  });
}

export function verifyEmail(token: string) {
  return request<{ message: string }>(`/auth/verify?token=${encodeURIComponent(token)}`);
}

export function getCurrentUser(token: string) {
  return request<UserProfile>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAdminUsers(token: string) {
  return request<AdminUser[]>("/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createAdminUser(token: string, user: AdminCreateUser) {
  return request<AdminUser>("/admin/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(user),
  });
}

export function getTransactionCategories(token: string, type: TransactionType) {
  return request<TransactionCategory[]>(`/transactions/categories?type=${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getSpendingTargets(token: string) {
  return request<SpendingTarget[]>("/transactions/targets", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createSpendingTarget(token: string, name: string) {
  return request<SpendingTarget>("/transactions/targets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

/** period: "YYYY-MM" để xem theo tháng, "YYYY" để xem theo năm. */
export function getSpendingStats(token: string, period: string) {
  const query = period.length === 4 ? `year=${period}` : `month=${encodeURIComponent(period)}`;
  return request<SpendingStats>(`/transactions/stats?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getMonthlyTransactions(token: string, month: string) {
  return request<{ transactions: FamilyTransaction[] }>(`/transactions?month=${encodeURIComponent(month)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createTransaction(token: string, transaction: CreateTransaction) {
  return request<FamilyTransaction>("/transactions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(transaction),
  });
}

export function updateTransaction(token: string, id: number, transaction: CreateTransaction) {
  return request<FamilyTransaction>(`/transactions/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(transaction),
  });
}

export function deleteTransaction(token: string, id: number) {
  return request<void>(`/transactions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

// ----- Tổng hợp kế hoạch (khoản sắp chi + tiết kiệm) -----

export function getPlanningSummary(token: string, month: string) {
  return request<PlanningSummary>(`/planning/summary?month=${encodeURIComponent(month)}`, { headers: authHeader(token) });
}

// ----- Khoản sắp phải chi -----

export function getPlannedExpenses(token: string) {
  return request<PlannedExpense[]>("/planned-expenses", { headers: authHeader(token) });
}

export function createPlannedExpense(token: string, input: PlannedExpenseInput) {
  return request<PlannedExpense>("/planned-expenses", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updatePlannedExpense(token: string, id: number, input: PlannedExpenseInput) {
  return request<PlannedExpense>(`/planned-expenses/${id}`, {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function deletePlannedExpense(token: string, id: number) {
  return request<void>(`/planned-expenses/${id}`, { method: "DELETE", headers: authHeader(token) });
}

/** Đánh dấu đã chi: backend tạo giao dịch chi thật vào hôm nay. */
export function payPlannedExpense(token: string, id: number) {
  return request<FamilyTransaction>(`/planned-expenses/${id}/pay`, { method: "POST", headers: authHeader(token) });
}

// ----- Tiết kiệm -----

export function getSavingsGoals(token: string) {
  return request<SavingsGoal[]>("/savings-goals", { headers: authHeader(token) });
}

export function createSavingsGoal(token: string, input: SavingsGoalInput) {
  return request<SavingsGoal>("/savings-goals", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateSavingsGoal(token: string, id: number, input: SavingsGoalInput) {
  return request<SavingsGoal>(`/savings-goals/${id}`, {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function deleteSavingsGoal(token: string, id: number) {
  return request<void>(`/savings-goals/${id}`, { method: "DELETE", headers: authHeader(token) });
}

export function addSavingsContribution(
  token: string,
  goalId: number,
  contribution: { type: ContributionType; amount: number; occurredOn: string; note: string },
) {
  return request<SavingsGoal>(`/savings-goals/${goalId}/contributions`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(contribution),
  });
}

// ----- Danh mục thu chi -----

export function createTransactionCategory(token: string, name: string, type: TransactionType) {
  return request<TransactionCategory>("/transactions/categories", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ name, type }),
  });
}

export function deleteTransactionCategory(token: string, id: number) {
  return request<void>(`/transactions/categories/${id}`, { method: "DELETE", headers: authHeader(token) });
}

// ----- Gia đình & lời mời -----

export function getMyFamily(token: string) {
  return request<FamilyDetails>("/family", { headers: authHeader(token) });
}

/** Tạo gia đình cho người dùng chưa thuộc gia đình nào. */
export function createFamily(token: string, name: string) {
  return request<FamilyDetails>("/family", { method: "POST", headers: authHeader(token), body: JSON.stringify({ name }) });
}

export function renameFamily(token: string, name: string) {
  return request<FamilyDetails>("/family", { method: "PUT", headers: authHeader(token), body: JSON.stringify({ name }) });
}

export function inviteToFamily(token: string, invite: { email: string; phoneNumber: string; message: string }) {
  return request<InviteResult>("/family/invitations", { method: "POST", headers: authHeader(token), body: JSON.stringify(invite) });
}

export function cancelFamilyInvitation(token: string, id: number) {
  return request<void>(`/family/invitations/${id}`, { method: "DELETE", headers: authHeader(token) });
}

export function getMyInvitations(token: string) {
  return request<IncomingInvitation[]>("/invitations/mine", { headers: authHeader(token) });
}

export function acceptInvitation(token: string, id: number) {
  return request<{ message: string }>(`/invitations/${id}/accept`, { method: "POST", headers: authHeader(token) });
}

export function declineInvitation(token: string, id: number) {
  return request<{ message: string }>(`/invitations/${id}/decline`, { method: "POST", headers: authHeader(token) });
}

// ----- Quản trị -----

export function getAdminFamilies(token: string) {
  return request<FamilySummary[]>("/admin/families", { headers: authHeader(token) });
}

// ----- Thông tin cá nhân -----

/** Lưu họ tên, email, SĐT. Email mới chỉ có hiệu lực sau khi xác minh qua thư. */
export function updateProfile(token: string, profile: { name: string; email: string; phoneNumber: string }) {
  return request<{ user: UserProfile; message: string }>("/profile", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify(profile),
  });
}

/** Tự đổi mật khẩu: cần mật khẩu hiện tại. */
export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return request<{ message: string }>("/profile/password", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Chỉ quản trị viên: đặt mật khẩu mới cho tài khoản khác. */
export function resetUserPassword(token: string, userId: number, newPassword: string) {
  return request<{ message: string }>(`/admin/users/${userId}/password`, {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ newPassword }),
  });
}

export function resendEmailVerification(token: string) {
  return request<{ message: string }>("/profile/resend-verification", { method: "POST", headers: authHeader(token) });
}

// ----- Kiểm tra trùng khi đang gõ -----

export type FieldCheckResult = { valid: boolean; available: boolean; message: string };
export type AvailabilityResult = {
  username: FieldCheckResult | null;
  email: FieldCheckResult | null;
  phoneNumber: FieldCheckResult | null;
};

/** Có token (đang sửa thông tin của mình) thì backend bỏ qua chính tài khoản đó khi so trùng. */
export function checkAvailability(params: { username?: string; email?: string; phoneNumber?: string }, token?: string) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return request<AvailabilityResult>(`/auth/check-availability?${query.toString()}`, {
    headers: token ? authHeader(token) : {},
  });
}

// ----- Vàng -----

export function getGold(token: string) {
  return request<GoldOverview>("/gold", { headers: authHeader(token) });
}

export function addGoldPurchase(token: string, input: GoldPurchaseInput) {
  return request<GoldOverview>("/gold/purchases", { method: "POST", headers: authHeader(token), body: JSON.stringify(input) });
}

export function updateGoldPurchase(token: string, id: number, input: GoldPurchaseInput) {
  return request<GoldOverview>(`/gold/purchases/${id}`, { method: "PUT", headers: authHeader(token), body: JSON.stringify(input) });
}

export function deleteGoldPurchase(token: string, id: number) {
  return request<GoldOverview>(`/gold/purchases/${id}`, { method: "DELETE", headers: authHeader(token) });
}

/** Nhập giá vàng (1 chỉ) cho một ngày; nhập lại cùng ngày thì ghi đè. */
export function setGoldPrice(token: string, priceDate: string, pricePerChi: number) {
  return request<GoldOverview>("/gold/price", {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ priceDate, pricePerChi }),
  });
}
