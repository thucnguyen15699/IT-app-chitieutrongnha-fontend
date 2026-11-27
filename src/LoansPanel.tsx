import { useEffect, useState, type FormEvent } from "react";
import { createLoan, deleteLoan, deleteLoanRepayment, getLoans, repayLoan, updateLoan } from "./api";
import { useAutoRefresh } from "./autoRefresh";
import { daysFromToday, formatAmountInput, formatCurrency, formatDate, parseAmountInput, toDateInput } from "./format";
import type { LenderType, Loan, LoanOverview, RepaymentMode } from "./types";

/** Vay ai: hiện thành các nút chọn nhanh. */
export const LENDER_TYPES: Array<{ value: LenderType; label: string }> = [
  { value: "FRIEND", label: "Bạn bè" },
  { value: "PARENT", label: "Bố mẹ" },
  { value: "SIBLING", label: "Anh chị em" },
  { value: "RELATIVE", label: "Họ hàng" },
  { value: "COLLEAGUE", label: "Đồng nghiệp" },
  { value: "BANK", label: "Ngân hàng" },
  { value: "OTHER", label: "Khác" },
];
const lenderLabel = (type: LenderType) => LENDER_TYPES.find((entry) => entry.value === type)?.label ?? "Khác";

type LoansPanelProps = {
  token: string;
  /** Vay/trả xong: Dashboard tải lại "Tổng nợ" và "Tiền trong ví còn lại". */
  onChanged: () => void;
};

type RepayDraft = { loanId: number; amount: string; paidOn: string; note: string };

export default function LoansPanel({ token, onChanged }: LoansPanelProps) {
  const [overview, setOverview] = useState<LoanOverview | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lenderType, setLenderType] = useState<LenderType>("FRIEND");
  const [lenderName, setLenderName] = useState("");
  const [amount, setAmount] = useState("");
  const [borrowedOn, setBorrowedOn] = useState(() => toDateInput(new Date()));
  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>("INSTALLMENT");
  const [installment, setInstallment] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<RepayDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getLoans(token)
      .then(setOverview)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Không tải được khoản vay."));
  }, [token]);

  // Người khác trong nhà ghi vay/trả → tự hiện (chậm nhất ~10 giây). Lỗi mạng khi tải ngầm thì bỏ qua.
  useAutoRefresh(() => {
    getLoans(token).then(setOverview).catch(() => undefined);
  });

  async function run(action: () => Promise<LoanOverview>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setOverview(await action());
      setNotice(success);
      onChanged();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setLenderType("FRIEND");
    setLenderName("");
    setAmount("");
    setBorrowedOn(toDateInput(new Date()));
    setRepaymentMode("INSTALLMENT");
    setInstallment("");
    setDueOn("");
    setNote("");
  }

  function startEdit(loan: Loan) {
    setEditingId(loan.id);
    setLenderType(loan.lenderType);
    setLenderName(loan.lenderName);
    setAmount(formatAmountInput(String(loan.amount)));
    setBorrowedOn(loan.borrowedOn);
    setRepaymentMode(loan.repaymentMode);
    setInstallment(loan.installmentAmount ? formatAmountInput(String(loan.installmentAmount)) : "");
    setDueOn(loan.dueOn ?? "");
    setNote(loan.note ?? "");
    setDraft(null);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      lenderType,
      lenderName: lenderName.trim() || lenderLabel(lenderType),
      amount: parseAmountInput(amount),
      borrowedOn,
      repaymentMode,
      installmentAmount: repaymentMode === "INSTALLMENT" && installment ? parseAmountInput(installment) : null,
      dueOn: dueOn || null,
      note,
    };
    const ok = await run(
      () => (editingId === null ? createLoan(token, input) : updateLoan(token, editingId, input)),
      editingId === null ? "Đã ghi khoản vay. Tiền vay đã được cộng vào ví." : "Đã cập nhật khoản vay.",
    );
    if (ok) {
      resetForm();
      setFormOpen(false);
    }
  }

  async function handleDelete(loan: Loan) {
    if (!window.confirm(`Xóa khoản vay ${formatCurrency(loan.amount)} của ${loan.lenderName}? Mọi lần trả của khoản này cũng bị xóa.`)) return;
    await run(() => deleteLoan(token, loan.id), "Đã xóa khoản vay.");
  }

  function startRepay(loan: Loan) {
    // Trả dần: gợi ý sẵn số tiền mỗi lần (không quá số còn nợ). Trả một lần: gợi ý trả hết.
    const suggested = loan.repaymentMode === "INSTALLMENT" && loan.installmentAmount
      ? Math.min(loan.installmentAmount, loan.remaining)
      : loan.remaining;
    setDraft({ loanId: loan.id, amount: formatAmountInput(String(suggested)), paidOn: toDateInput(new Date()), note: "" });
    setError("");
    setNotice("");
  }

  async function handleRepay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const ok = await run(
      () => repayLoan(token, draft.loanId, { amount: parseAmountInput(draft.amount), paidOn: draft.paidOn, note: draft.note }),
      "Đã ghi lần trả nợ. Số còn nợ đã được trừ.",
    );
    if (ok) setDraft(null);
  }

  async function handleDeleteRepayment(loan: Loan, repaymentId: number, repaymentAmount: number) {
    if (!window.confirm(`Xóa lần trả ${formatCurrency(repaymentAmount)} cho ${loan.lenderName}? Số còn nợ sẽ tăng lại.`)) return;
    await run(() => deleteLoanRepayment(token, loan.id, repaymentId), "Đã xóa lần trả.");
  }

  if (!overview) {
    return error ? <p className="transaction-empty" role="alert">{error}</p> : null;
  }

  return (
    <section className="content-card planning-card" aria-label="Khoản vay">
      <div className="section-heading planning-heading">
        <div><span className="eyebrow">TIỀN ĐANG NỢ</span><h2>Khoản vay</h2></div>
        {!formOpen && (
          <button type="button" className="button button-install" onClick={() => { resetForm(); setDraft(null); setFormOpen(true); }}>+ Ghi khoản vay</button>
        )}
      </div>

      <div className="gold-totals loan-totals">
        <div><span>Tổng nợ hiện tại</span><strong className="expense-total">{formatCurrency(overview.totalDebt)}</strong></div>
        <div><span>Đã vay</span><strong>{formatCurrency(overview.totalBorrowed)}</strong></div>
        <div><span>Đã trả</span><strong className="income-total">{formatCurrency(overview.totalRepaid)}</strong></div>
        <div><span>Số khoản còn nợ</span><strong>{overview.loans.filter((loan) => !loan.paidOff).length}</strong></div>
      </div>

      {formOpen && (
        <form className="transaction-form planning-form" onSubmit={handleSubmit}>
          <span className="transaction-field-label" id="loan-lender-label">Vay ai?</span>
          <div className="target-chips" role="radiogroup" aria-labelledby="loan-lender-label">
            {LENDER_TYPES.map((option) => (
              <button
                type="button"
                role="radio"
                key={option.value}
                className={`target-chip${lenderType === option.value ? " active" : ""}`}
                aria-checked={lenderType === option.value}
                onClick={() => setLenderType(option.value)}
              >{option.label}</button>
            ))}
          </div>
          <label htmlFor="loan-lender">Tên người cho vay</label>
          <input
            id="loan-lender"
            value={lenderName}
            maxLength={100}
            placeholder={`Ví dụ: Anh Tuấn (bỏ trống thì ghi "${lenderLabel(lenderType)}")`}
            onChange={(event) => setLenderName(event.target.value)}
          />
          <div className="planning-form-grid">
            <div>
              <label htmlFor="loan-amount">Số tiền vay (₫)</label>
              <input
                id="loan-amount"
                inputMode="numeric"
                value={amount}
                required
                maxLength={17}
                autoComplete="off"
                placeholder="Ví dụ: 5,000,000"
                onChange={(event) => setAmount(formatAmountInput(event.target.value))}
              />
            </div>
            <div>
              <label htmlFor="loan-date">Ngày vay</label>
              <input id="loan-date" type="date" value={borrowedOn} max={toDateInput(new Date())} required onChange={(event) => setBorrowedOn(event.target.value)} />
            </div>
          </div>
          <span className="transaction-field-label" id="loan-mode-label">Cách trả</span>
          <div className="segmented" role="radiogroup" aria-labelledby="loan-mode-label">
            <button type="button" role="radio" aria-checked={repaymentMode === "INSTALLMENT"} className={repaymentMode === "INSTALLMENT" ? "active" : ""} onClick={() => setRepaymentMode("INSTALLMENT")}>Trả dần</button>
            <button type="button" role="radio" aria-checked={repaymentMode === "LUMP_SUM"} className={repaymentMode === "LUMP_SUM" ? "active" : ""} onClick={() => setRepaymentMode("LUMP_SUM")}>Trả một lần</button>
          </div>
          <div className="planning-form-grid">
            {repaymentMode === "INSTALLMENT" && (
              <div>
                <label htmlFor="loan-installment">Mỗi lần trả (không bắt buộc)</label>
                <input
                  id="loan-installment"
                  inputMode="numeric"
                  value={installment}
                  maxLength={17}
                  autoComplete="off"
                  placeholder="Ví dụ: 1,000,000"
                  onChange={(event) => setInstallment(formatAmountInput(event.target.value))}
                />
              </div>
            )}
            <div>
              <label htmlFor="loan-due">Hạn trả hết (không bắt buộc)</label>
              <input id="loan-due" type="date" value={dueOn} min={borrowedOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
          </div>
          <label htmlFor="loan-note">Vay để làm gì? (ghi chú cho dễ nhớ)</label>
          <input
            id="loan-note"
            value={note}
            maxLength={500}
            placeholder="Ví dụ: sửa xe, đóng học phí cho con, mua tủ lạnh..."
            onChange={(event) => setNote(event.target.value)}
          />
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="transaction-form-actions">
            <button className="button button-primary transaction-submit" type="submit" disabled={busy || !amount}>
              {busy ? "Đang lưu..." : editingId === null ? "Lưu khoản vay" : "Lưu thay đổi"}
            </button>
            <button className="button button-install transaction-cancel" type="button" disabled={busy} onClick={() => { resetForm(); setFormOpen(false); setError(""); }}>Hủy</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      {overview.loans.length === 0 ? (
        <p className="transaction-empty">Chưa có khoản vay nào. Ghi lại các khoản vay để biết nhà mình đang nợ bao nhiêu.</p>
      ) : (
        <div className="savings-list">
          {overview.loans.map((loan) => {
            const progress = Math.min(100, Math.round((loan.repaid / loan.amount) * 100));
            const daysLeft = loan.dueOn ? daysFromToday(loan.dueOn) : null;
            const isRepaying = draft?.loanId === loan.id;
            return (
              <article className={`savings-goal${loan.paidOff ? " loan-paid-off" : ""}`} key={loan.id}>
                <div className="savings-goal-head">
                  <div>
                    <span className="savings-purpose">
                      {lenderLabel(loan.lenderType)} · {loan.repaymentMode === "INSTALLMENT" ? "Trả dần" : "Trả một lần"}
                    </span>
                    <strong>Vay {loan.lenderName}{loan.note ? ` · ${loan.note}` : ""}</strong>
                  </div>
                  <div className="savings-goal-tools">
                    <button type="button" className="transaction-edit-button" onClick={() => startEdit(loan)}>Sửa</button>
                    <button type="button" className="transaction-edit-button planned-delete" onClick={() => void handleDelete(loan)}>Xóa</button>
                  </div>
                </div>

                <div className="savings-figures">
                  <strong className={loan.paidOff ? "income-total" : "expense-total"}>
                    {loan.paidOff ? "Đã trả hết" : `Còn nợ ${formatCurrency(loan.remaining)}`}
                  </strong>
                  <span>/ vay {formatCurrency(loan.amount)}</span>
                  <b>{progress}%</b>
                </div>
                <div
                  className="savings-meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label={`Vay ${loan.lenderName}: đã trả ${progress}%`}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p className="savings-hint">
                  Vay ngày {formatDate(loan.borrowedOn)} · đã trả {formatCurrency(loan.repaid)}
                  {loan.installmentAmount && !loan.paidOff ? ` · mỗi lần ${formatCurrency(loan.installmentAmount)}` : ""}
                  {loan.dueOn && !loan.paidOff
                    ? daysLeft !== null && daysLeft < 0
                      ? ` · đã quá hạn ${formatDate(loan.dueOn)}!`
                      : ` · hạn ${formatDate(loan.dueOn)}`
                    : ""}
                </p>

                {isRepaying ? (
                  <form className="savings-contribution-form" onSubmit={handleRepay}>
                    <input
                      autoFocus
                      inputMode="numeric"
                      value={draft.amount}
                      required
                      maxLength={17}
                      placeholder="Số tiền trả"
                      aria-label="Số tiền trả"
                      onChange={(event) => setDraft({ ...draft, amount: formatAmountInput(event.target.value) })}
                    />
                    <input
                      type="date"
                      value={draft.paidOn}
                      min={loan.borrowedOn}
                      max={toDateInput(new Date())}
                      required
                      aria-label="Ngày trả"
                      onChange={(event) => setDraft({ ...draft, paidOn: event.target.value })}
                    />
                    <input
                      value={draft.note}
                      maxLength={255}
                      placeholder="Ghi chú (không bắt buộc)"
                      aria-label="Ghi chú"
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                    />
                    <button className="button button-primary" type="submit" disabled={busy || !draft.amount}>Trả</button>
                    <button className="button button-install" type="button" onClick={() => setDraft(null)}>Hủy</button>
                  </form>
                ) : (
                  !loan.paidOff && (
                    <div className="savings-actions">
                      <button type="button" className="planned-pay" onClick={() => startRepay(loan)}>
                        {loan.repaymentMode === "INSTALLMENT" ? "+ Trả một phần" : "Trả nợ"}
                      </button>
                    </div>
                  )
                )}

                {loan.repayments.length > 0 && (
                  <ul className="savings-history">
                    {loan.repayments.map((entry) => (
                      <li key={entry.id}>
                        <span>Trả {formatDate(entry.paidOn)}{entry.note ? ` · ${entry.note}` : ""}</span>
                        <b className="income-total">
                          -{formatCurrency(entry.amount)}
                          <button
                            type="button"
                            className="loan-repayment-delete"
                            aria-label={`Xóa lần trả ngày ${formatDate(entry.paidOn)}`}
                            title="Xóa lần trả này"
                            onClick={() => void handleDeleteRepayment(loan, entry.id, entry.amount)}
                          >×</button>
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
