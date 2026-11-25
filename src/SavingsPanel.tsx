import { useEffect, useState, type FormEvent } from "react";
import {
  addSavingsContribution,
  createSavingsGoal,
  deleteSavingsGoal,
  getSavingsGoals,
  updateSavingsGoal,
} from "./api";
import { daysFromToday, formatAmountInput, formatCurrency, formatDate, parseAmountInput, toDateInput } from "./format";
import type { ContributionType, SavingsGoal } from "./types";

/** Mục đích gợi ý sẵn; người dùng vẫn gõ được mục đích khác. */
const PURPOSES = ["Du lịch", "Học tập", "Mua nhà", "Mua xe", "Quỹ khẩn cấp", "Sức khỏe", "Cưới hỏi", "Mua sắm lớn"];

type SavingsPanelProps = {
  token: string;
  /** Gọi sau khi gửi/rút để Dashboard cập nhật "Tiền trong ví còn lại". */
  onChanged: () => void;
};

type ContributionDraft = { goalId: number; type: ContributionType; amount: string; occurredOn: string; note: string };

export default function SavingsPanel({ token, onChanged }: SavingsPanelProps) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [draft, setDraft] = useState<ContributionDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSavingsGoals(token)
      .then((result) => {
        if (active) setGoals(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Không tải được mục tiết kiệm.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const totalSaved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const isCustomPurpose = !PURPOSES.includes(purpose);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPurpose(PURPOSES[0]);
    setCustomPurpose("");
    setTargetAmount("");
    setDeadline("");
  }

  function startEdit(goal: SavingsGoal) {
    setError("");
    setEditingId(goal.id);
    setName(goal.name);
    if (PURPOSES.includes(goal.purpose)) {
      setPurpose(goal.purpose);
      setCustomPurpose("");
    } else {
      setPurpose("");
      setCustomPurpose(goal.purpose);
    }
    setTargetAmount(formatAmountInput(String(goal.targetAmount)));
    setDeadline(goal.deadline ?? "");
    setFormOpen(true);
  }

  function replaceGoal(updated: SavingsGoal) {
    setGoals((current) => current.map((goal) => (goal.id === updated.id ? updated : goal)));
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = {
        name,
        purpose: isCustomPurpose ? customPurpose.trim() : purpose,
        targetAmount: parseAmountInput(targetAmount),
        deadline: deadline || null,
      };
      if (editingId === null) {
        const created = await createSavingsGoal(token, input);
        setGoals((current) => [...current, created]);
      } else {
        replaceGoal(await updateSavingsGoal(token, editingId, input));
      }
      resetForm();
      setFormOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được mục tiết kiệm.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(goal: SavingsGoal) {
    const warning = goal.savedAmount > 0
      ? `Xóa mục "${goal.name}"? Số đã tiết kiệm ${formatCurrency(goal.savedAmount)} sẽ không còn được tính nữa.`
      : `Xóa mục "${goal.name}"?`;
    if (!window.confirm(warning)) return;
    setError("");
    try {
      await deleteSavingsGoal(token, goal.id);
      setGoals((current) => current.filter((entry) => entry.id !== goal.id));
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không xóa được.");
    }
  }

  async function handleContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      replaceGoal(await addSavingsContribution(token, draft.goalId, {
        type: draft.type,
        amount: parseAmountInput(draft.amount),
        occurredOn: draft.occurredOn,
        note: draft.note,
      }));
      setDraft(null);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không ghi được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card planning-card" aria-label="Mục tiết kiệm">
      <div className="section-heading planning-heading">
        <div>
          <span className="eyebrow">VUN VÉN CHO DỰ ĐỊNH</span>
          <h2>Mục tiết kiệm</h2>
          {goals.length > 0 && <p className="planning-subtitle">Đã tiết kiệm tổng cộng <b>{formatCurrency(totalSaved)}</b></p>}
        </div>
        {!formOpen && (
          <button type="button" className="button button-install" onClick={() => { resetForm(); setFormOpen(true); }}>+ Mục mới</button>
        )}
      </div>

      {formOpen && (
        <form className="transaction-form planning-form" onSubmit={handleGoalSubmit}>
          <span className="transaction-field-label" id="savings-purpose-label">Tiết kiệm để làm gì?</span>
          <div className="target-chips" role="radiogroup" aria-labelledby="savings-purpose-label">
            {PURPOSES.map((option) => (
              <button
                type="button"
                role="radio"
                key={option}
                className={`target-chip${purpose === option ? " active" : ""}`}
                aria-checked={purpose === option}
                onClick={() => setPurpose(option)}
              >{option}</button>
            ))}
            <button
              type="button"
              role="radio"
              className={`target-chip target-chip-add${isCustomPurpose ? " active" : ""}`}
              aria-checked={isCustomPurpose}
              onClick={() => setPurpose("")}
            >Khác...</button>
          </div>
          {isCustomPurpose && (
            <input
              className="planning-custom-purpose"
              value={customPurpose}
              required
              maxLength={60}
              placeholder="Mục đích khác, ví dụ: Sửa nhà"
              aria-label="Mục đích khác"
              onChange={(event) => setCustomPurpose(event.target.value)}
            />
          )}
          <label htmlFor="savings-name">Tên mục tiết kiệm</label>
          <input
            id="savings-name"
            value={name}
            required
            maxLength={100}
            placeholder="Ví dụ: Hè 2027 đi Đà Nẵng"
            onChange={(event) => setName(event.target.value)}
          />
          <div className="planning-form-grid">
            <div>
              <label htmlFor="savings-target">Số tiền cần đạt (₫)</label>
              <input
                id="savings-target"
                inputMode="numeric"
                value={targetAmount}
                required
                maxLength={17}
                autoComplete="off"
                placeholder="Ví dụ: 20,000,000"
                onChange={(event) => setTargetAmount(formatAmountInput(event.target.value))}
              />
            </div>
            <div>
              <label htmlFor="savings-deadline">Hạn (không bắt buộc)</label>
              <input id="savings-deadline" type="date" value={deadline} min={toDateInput(new Date())} onChange={(event) => setDeadline(event.target.value)} />
            </div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="transaction-form-actions">
            <button className="button button-primary transaction-submit" type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : editingId === null ? "Tạo mục tiết kiệm" : "Lưu thay đổi"}
            </button>
            <button className="button button-install transaction-cancel" type="button" disabled={busy} onClick={() => { resetForm(); setFormOpen(false); setError(""); }}>Hủy</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className="form-error" role="alert">{error}</div>}

      {goals.length === 0 && !formOpen ? (
        <p className="transaction-empty">Chưa có mục tiết kiệm nào. Tạo một mục cho chuyến du lịch hay khoản học phí sắp tới nhé.</p>
      ) : (
        <div className="savings-list">
          {goals.map((goal) => {
            const progress = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
            const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
            const daysLeft = goal.deadline ? daysFromToday(goal.deadline) : null;
            const monthsLeft = daysLeft !== null ? Math.max(1, Math.ceil(daysLeft / 30)) : null;
            const isDrafting = draft?.goalId === goal.id;
            return (
              <article className="savings-goal" key={goal.id}>
                <div className="savings-goal-head">
                  <div>
                    <span className="savings-purpose">{goal.purpose}</span>
                    <strong>{goal.name}</strong>
                  </div>
                  <div className="savings-goal-tools">
                    <button type="button" className="transaction-edit-button" onClick={() => startEdit(goal)}>Sửa</button>
                    <button type="button" className="transaction-edit-button planned-delete" onClick={() => void handleDelete(goal)}>Xóa</button>
                  </div>
                </div>

                <div className="savings-figures">
                  <strong>{formatCurrency(goal.savedAmount)}</strong>
                  <span>/ {formatCurrency(goal.targetAmount)}</span>
                  <b>{progress}%</b>
                </div>
                <div
                  className="savings-meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label={`${goal.name}: đã đạt ${progress}%`}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p className="savings-hint">
                  {remaining === 0
                    ? "Đã đạt mục tiêu!"
                    : daysLeft === null
                      ? `Còn thiếu ${formatCurrency(remaining)}`
                      : daysLeft < 0
                        ? `Đã quá hạn ${formatDate(goal.deadline!)} · còn thiếu ${formatCurrency(remaining)}`
                        : `Còn thiếu ${formatCurrency(remaining)} · hạn ${formatDate(goal.deadline!)} · cần ~${formatCurrency(Math.ceil(remaining / monthsLeft!))}/tháng`}
                </p>

                {isDrafting ? (
                  <form className="savings-contribution-form" onSubmit={handleContribution}>
                    <input
                      autoFocus
                      inputMode="numeric"
                      value={draft.amount}
                      required
                      maxLength={17}
                      placeholder={draft.type === "DEPOSIT" ? "Số tiền gửi" : "Số tiền rút"}
                      aria-label={draft.type === "DEPOSIT" ? "Số tiền gửi" : "Số tiền rút"}
                      onChange={(event) => setDraft({ ...draft, amount: formatAmountInput(event.target.value) })}
                    />
                    <input
                      type="date"
                      value={draft.occurredOn}
                      max={toDateInput(new Date())}
                      required
                      aria-label="Ngày"
                      onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })}
                    />
                    <input
                      value={draft.note}
                      maxLength={255}
                      placeholder="Ghi chú (không bắt buộc)"
                      aria-label="Ghi chú"
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                    />
                    <button className="button button-primary" type="submit" disabled={busy || !draft.amount}>
                      {draft.type === "DEPOSIT" ? "Gửi vào" : "Rút ra"}
                    </button>
                    <button className="button button-install" type="button" onClick={() => setDraft(null)}>Hủy</button>
                  </form>
                ) : (
                  <div className="savings-actions">
                    <button type="button" className="planned-pay" onClick={() => setDraft({ goalId: goal.id, type: "DEPOSIT", amount: "", occurredOn: toDateInput(new Date()), note: "" })}>+ Gửi tiền</button>
                    {goal.savedAmount > 0 && (
                      <button type="button" className="transaction-edit-button" onClick={() => setDraft({ goalId: goal.id, type: "WITHDRAW", amount: "", occurredOn: toDateInput(new Date()), note: "" })}>Rút tiền</button>
                    )}
                  </div>
                )}

                {goal.recentContributions.length > 0 && (
                  <ul className="savings-history">
                    {goal.recentContributions.map((entry) => (
                      <li key={entry.id}>
                        <span>{formatDate(entry.occurredOn)}{entry.note ? ` · ${entry.note}` : ""}</span>
                        <b className={entry.type === "DEPOSIT" ? "income-total" : "expense-total"}>
                          {entry.type === "DEPOSIT" ? "+" : "-"}{formatCurrency(entry.amount)}
                        </b>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
