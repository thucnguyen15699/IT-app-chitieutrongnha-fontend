import type {
  AdminCreateUser,
  AdminUser,
  AuthResponse,
  CreateTransaction,
  FamilyTransaction,
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
