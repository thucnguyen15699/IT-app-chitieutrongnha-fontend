import { useEffect, useState, type FormEvent } from "react";
import {
  createPlannedExpense,
  deletePlannedExpense,
  getPlannedExpenses,
  getSpendingTargets,
  getTransactionCategories,
  payPlannedExpense,
  updatePlannedExpense,
} from "./api";
import { daysFromToday, formatAmountInput, formatCurrency, formatDate, parseAmountInput, toDateInput } from "./format";
import type { PlannedExpense, SpendingTarget, TransactionCategory } from "./types";

type PlannedExpensesPanelProps = {
  token: string;
  /** Gọi sau mỗi thay đổi để Dashboard tải lại các ô tổng và giao dịch. */
  onChanged: () => void;
};

function dueLabel(dueOn: string) {
  const days = daysFromToday(dueOn);
  if (days < 0) return { text: `Quá hạn ${-days} ngày`, tone: "overdue" };
  if (days === 0) return { text: "Hôm nay", tone: "soon" };
  if (days <= 7) return { text: `Còn ${days} ngày`, tone: "soon" };
  return { text: `Còn ${days} ngày`, tone: "later" };
}

export default function PlannedExpensesPanel({ token, onChanged }: PlannedExpensesPanelProps) {
  const [items, setItems] = useState<PlannedExpense[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [targets, setTargets] = useState<SpendingTarget[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dueOn, setDueOn] = useState(() => toDateInput(new Date()));
  const [categoryId, setCategoryId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getPlannedExpenses(token), getTransactionCategories(token, "EXPENSE"), getSpendingTargets(token)])
      .then(([planned, expenseCategories, availableTargets]) => {
        if (!active) return;
        setItems(planned);
        setCategories(expenseCategories);
        setTargets(availableTargets);
        setCategoryId((current) => current || (expenseCategories[0] ? String(expenseCategories[0].id) : ""));
        setTargetId((current) => current || (availableTargets[0] ? String(availableTargets[0].id) : ""));
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Không tải được khoản sắp chi.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  function resetForm() {
    setEditingId(null);
    setDueOn(toDateInput(new Date()));
    setAmount("");
    setNote("");
    setTargetId(targets[0] ? String(targets[0].id) : "");
  }

  function startEdit(item: PlannedExpense) {
    setError("");
    setNotice("");
    setEditingId(item.id);
    setDueOn(item.dueOn);
    setCategoryId(String(item.categoryId));
    setTargetId(item.targetId === null ? (targets[0] ? String(targets[0].id) : "") : String(item.targetId));
    setAmount(formatAmountInput(String(item.amount)));
    setNote(item.note);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const input = {
        categoryId: Number(categoryId),
        targetId: targetId ? Number(targetId) : null,
        amount: parseAmountInput(amount),
        note,
        dueOn,
      };
      const saved = editingId === null
        ? await createPlannedExpense(token, input)
        : await updatePlannedExpense(token, editingId, input);
      setItems((current) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort((left, right) => left.dueOn.localeCompare(right.dueOn)),
      );
      setNotice(editingId === null ? "Đã thêm khoản sắp chi." : "Đã cập nhật khoản sắp chi.");
      resetForm();
      setFormOpen(false);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được khoản sắp chi.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay(item: PlannedExpense) {
    if (!window.confirm(`Ghi nhận đã chi "${item.note}" (${formatCurrency(item.amount)}) vào hôm nay?`)) return;
    setError("");
    setNotice("");
    try {
      await payPlannedExpense(token, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`Đã chuyển "${item.note}" thành khoản chi hôm nay.`);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không ghi nhận được.");
    }
  }

  async function handleDelete(item: PlannedExpense) {
    if (!window.confirm(`Xóa khoản sắp chi "${item.note}"?`)) return;
    setError("");
    setNotice("");
    try {
      await deletePlannedExpense(token, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) resetForm();
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không xóa được.");
    }
  }

  return (
    <section className="content-card planning-card" aria-label="Khoản sắp phải chi">
      <div className="section-heading planning-heading">
        <div><span className="eyebrow">ĐÃ BIẾT TRƯỚC</span><h2>Khoản sắp phải chi</h2></div>
        {!formOpen && (
          <button type="button" className="button button-install" onClick={() => { resetForm(); setFormOpen(true); }}>+ Thêm khoản</button>
        )}
      </div>

      {formOpen && (
        <form className="transaction-form planning-form" onSubmit={handleSubmit}>
          <div className="planning-form-grid">
            <div>
              <label htmlFor="planned-due">Hạn phải chi</label>
              <input id="planned-due" type="date" value={dueOn} required onChange={(event) => setDueOn(event.target.value)} />
            </div>
            <div>
              <label htmlFor="planned-amount">Số tiền (₫)</label>
              <input
                id="planned-amount"
                inputMode="numeric"
                value={amount}
                required
                maxLength={17}
                autoComplete="off"
                placeholder="Ví dụ: 5,000,000"
                onChange={(event) => setAmount(formatAmountInput(event.target.value))}
              />
            </div>
          </div>
          <label htmlFor="planned-category">Danh mục chi</label>
          <select id="planned-category" value={categoryId} required onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
          <span className="transaction-field-label" id="planned-target-label">Chi cho ai?</span>
          <div className="target-chips" role="radiogroup" aria-labelledby="planned-target-label">
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
          </div>
          <label htmlFor="planned-note">Cần chi cho việc gì?</label>
          <input
            id="planned-note"
            value={note}
            required
            maxLength={500}
            placeholder="Ví dụ: học phí kỳ 2, tiền điện tháng 12, mừng cưới..."
            onChange={(event) => setNote(event.target.value)}
          />
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="transaction-form-actions">
            <button className="button button-primary transaction-submit" type="submit" disabled={busy || !categoryId}>
              {busy ? "Đang lưu..." : editingId === null ? "Lưu khoản sắp chi" : "Lưu thay đổi"}
            </button>
            <button className="button button-install transaction-cancel" type="button" disabled={busy} onClick={() => { resetForm(); setFormOpen(false); setError(""); }}>Hủy</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      {items.length === 0 ? (
        <p className="transaction-empty">Chưa có khoản nào sắp phải chi. Thêm những khoản đã biết trước để ví tiền phản ánh đúng hơn.</p>
      ) : (
        <ul className="planned-list">
          {items.map((item) => {
            const due = dueLabel(item.dueOn);
            return (
              <li className="planned-row" key={item.id}>
                <div className={`planned-due planned-due-${due.tone}`}>
                  <strong>{formatDate(item.dueOn).slice(0, 5)}</strong>
                  <span>{due.text}</span>
                </div>
                <div className="planned-text">
                  <strong>{item.note}</strong>
                  <span>{item.categoryName} · <em className="transaction-target-tag">{item.targetName}</em></span>
                </div>
                <strong className="planned-amount expense-total">{formatCurrency(item.amount)}</strong>
                <div className="planned-actions">
                  <button type="button" className="planned-pay" onClick={() => void handlePay(item)}>Đã chi</button>
                  <button type="button" className="transaction-edit-button" onClick={() => startEdit(item)}>Sửa</button>
                  <button type="button" className="transaction-edit-button planned-delete" aria-label={`Xóa ${item.note}`} onClick={() => void handleDelete(item)}>Xóa</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && (
        <div className="daily-total-row">
          <span>Tổng {items.length} khoản sắp chi</span>
          <strong className="expense-total">{formatCurrency(total)}</strong>
        </div>
      )}
    </section>
  );
}
