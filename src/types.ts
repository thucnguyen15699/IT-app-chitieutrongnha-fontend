export type UserProfile = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  /** null khi người dùng chưa thuộc gia đình nào (đang chờ lời mời). */
  familyId: number | null;
  familyName: string | null;
  roles: string[];
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type RegistrationResponse = {
  message: string;
};

export type AdminUser = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  familyId: number | null;
  familyName: string | null;
  roles: string[];
};

/** Gán vào gia đình có sẵn (familyId) hoặc tạo gia đình mới (familyName). */
export type AdminCreateUser = {
  name: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  familyId: number | null;
  familyName: string | null;
};

export type FamilySummary = { id: number; name: string; memberCount: number; createdAt: string };

export type FamilyMember = { userId: number; name: string; username: string; role: string; joinedAt: string; me: boolean };

export type SentInvitation = {
  id: number;
  email: string | null;
  phoneNumber: string | null;
  message: string | null;
  invitedByName: string;
  createdAt: string;
};

export type FamilyDetails = {
  id: number;
  name: string;
  /** OWNER / MEMBER, hoặc ADMIN_VIEW khi quản trị viên đang xem gia đình khác. */
  myRole: string;
  canManage: boolean;
  canInvite: boolean;
  members: FamilyMember[];
  pendingInvitations: SentInvitation[];
};

export type InviteResult = { invitation: SentInvitation; emailSent: boolean; note: string };

export type IncomingInvitation = {
  id: number;
  familyId: number;
  familyName: string;
  invitedByName: string;
  message: string | null;
  createdAt: string;
  matchedBy: "EMAIL" | "PHONE";
  /** Gia đình hiện tại sẽ rời đi nếu đồng ý (null nếu chưa có). */
  currentFamilyName: string | null;
};

export type TransactionType = "INCOME" | "EXPENSE";

export type TransactionCategory = {
  /** true nếu gia đình tự tạo (xóa được khi chưa dùng). */
  custom: boolean;
  id: number;
  name: string;
  type: TransactionType;
};

/** Đối tượng hưởng khoản chi: Cả nhà, Bố, Mẹ, Con... */
export type SpendingTarget = {
  id: number;
  name: string;
  custom: boolean;
};

export type FamilyTransaction = {
  id: number;
  type: TransactionType;
  categoryId: number | null;
  categoryName: string;
  targetId: number | null;
  targetName: string | null;
  amount: number;
  note: string | null;
  occurredOn: string;
};

export type CreateTransaction = {
  type: TransactionType;
  categoryId: number;
  amount: number;
  note: string;
  occurredOn: string;
  targetId: number | null;
};

export type StatsPart = { name: string; amount: number };

export type StatsGroup = {
  name: string;
  amount: number;
  count: number;
  /** Phân chia theo chiều còn lại: mục → ai, hoặc ai → mục. */
  breakdown: StatsPart[];
};

export type MonthTotal = { month: number; income: number; expense: number };

export type SpendingStats = {
  period: string;
  totalIncome: number;
  totalExpense: number;
  expenseCount: number;
  byCategory: StatsGroup[];
  byTarget: StatsGroup[];
  months: MonthTotal[];
};

/** Khoản đã biết trước sẽ phải chi. */
export type PlannedExpense = {
  id: number;
  categoryId: number;
  categoryName: string;
  targetId: number | null;
  targetName: string;
  amount: number;
  note: string;
  dueOn: string;
  overdue: boolean;
};

export type PlannedExpenseInput = {
  categoryId: number;
  targetId: number | null;
  amount: number;
  note: string;
  dueOn: string;
};

export type ContributionType = "DEPOSIT" | "WITHDRAW";

export type SavingsContribution = {
  id: number;
  type: ContributionType;
  amount: number;
  occurredOn: string;
  note: string | null;
};

export type SavingsGoal = {
  id: number;
  name: string;
  purpose: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  recentContributions: SavingsContribution[];
};

export type SavingsGoalInput = {
  name: string;
  purpose: string;
  targetAmount: number;
  deadline: string | null;
};

export type PlanningSummary = {
  pendingTotal: number;
  pendingCount: number;
  /** Tiền gửi tiết kiệm trừ tiền rút trong tháng. */
  savingsNetInMonth: number;
  totalSaved: number;
};

export type AuthMode = "login" | "register";
