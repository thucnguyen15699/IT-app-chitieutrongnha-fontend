import { useEffect, useState, type FormEvent } from "react";
import {
  createSpendingTarget,
  createTransactionCategory,
  deleteTransactionCategory,
  getSpendingTargets,
  getTransactionCategories,
} from "./api";
import type { SpendingTarget, TransactionCategory, TransactionType } from "./types";

type CategoriesPanelProps = {
  token: string;
  /** Gọi khi danh mục/đối tượng thay đổi để form nhập giao dịch tải lại. */
  onChanged: () => void;
};

export default function CategoriesPanel({ token, onChanged }: CategoriesPanelProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [targets, setTargets] = useState<SpendingTarget[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getTransactionCategories(token, type)
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Không tải được danh mục.");
      });
    return () => {
      active = false;
    };
  }, [token, type]);

  useEffect(() => {
    getSpendingTargets(token).then(setTargets).catch(() => undefined);
  }, [token]);

  function showResult(message: string) {
    setError("");
    setNotice(message);
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createTransactionCategory(token, name, type);
      setCategories((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, "vi")));
      setNewCategory("");
      showResult(`Đã thêm danh mục "${created.name}".`);
      onChanged();
    } catch (requestError) {
      setNotice("");
      setError(requestError instanceof Error ? requestError.message : "Không thêm được danh mục.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(category: TransactionCategory) {
    if (!window.confirm(`Xóa danh mục "${category.name}"?`)) return;
    try {
      await deleteTransactionCategory(token, category.id);
      setCategories((current) => current.filter((entry) => entry.id !== category.id));
      showResult(`Đã xóa danh mục "${category.name}".`);
      onChanged();
    } catch (requestError) {
      setNotice("");
      setError(requestError instanceof Error ? requestError.message : "Không xóa được danh mục.");
    }
  }

  async function handleAddTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTarget.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createSpendingTarget(token, name);
      setTargets((current) => [...current, created]);
      setNewTarget("");
      showResult(`Đã thêm đối tượng "${created.name}".`);
      onChanged();
    } catch (requestError) {
      setNotice("");
      setError(requestError instanceof Error ? requestError.message : "Không thêm được đối tượng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="categories-layout">
      <section className="content-card" aria-label="Danh mục thu chi">
        <div className="section-heading planning-heading">
          <div><span className="eyebrow">PHÂN LOẠI GIAO DỊCH</span><h2>Danh mục thu chi</h2></div>
          <div className="segmented" role="group" aria-label="Loại danh mục">
            <button type="button" className={type === "EXPENSE" ? "active" : ""} aria-pressed={type === "EXPENSE"} onClick={() => setType("EXPENSE")}>Danh mục chi</button>
            <button type="button" className={type === "INCOME" ? "active" : ""} aria-pressed={type === "INCOME"} onClick={() => setType("INCOME")}>Nguồn thu</button>
          </div>
        </div>

        <form className="inline-add-form" onSubmit={handleAddCategory}>
          <input
            value={newCategory}
            maxLength={100}
            placeholder={type === "EXPENSE" ? "Tên danh mục chi mới, ví dụ: Thú cưng" : "Nguồn thu mới, ví dụ: Cho thuê nhà"}
            aria-label="Tên danh mục mới"
            onChange={(event) => setNewCategory(event.target.value)}
          />
          <button className="button button-primary" type="submit" disabled={busy || !newCategory.trim()}>+ Thêm</button>
        </form>
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}

        <ul className="manage-list">
          {categories.map((category) => (
            <li key={category.id}>
              <span className={`manage-dot ${type === "EXPENSE" ? "expense-dot" : "income-dot"}`} aria-hidden="true" />
              <strong>{category.name}</strong>
              {category.custom ? (
                <>
                  <span className="manage-badge manage-badge-custom">Nhà mình tạo</span>
                  <button type="button" className="transaction-edit-button planned-delete" onClick={() => void handleDeleteCategory(category)}>Xóa</button>
                </>
              ) : (
                <span className="manage-badge">Mặc định</span>
              )}
            </li>
          ))}
        </ul>
        <p className="manage-hint">Danh mục mặc định dùng chung, không xóa được. Danh mục nhà mình tạo chỉ xóa được khi chưa có giao dịch nào dùng.</p>
      </section>

      <section className="content-card" aria-label="Đối tượng chi tiêu">
        <div className="section-heading planning-heading">
          <div><span className="eyebrow">CHI CHO AI</span><h2>Đối tượng chi tiêu</h2></div>
        </div>
        <form className="inline-add-form" onSubmit={handleAddTarget}>
          <input
            value={newTarget}
            maxLength={60}
            placeholder="Ví dụ: Con lớn, Ông bà..."
            aria-label="Tên đối tượng mới"
            onChange={(event) => setNewTarget(event.target.value)}
          />
          <button className="button button-primary" type="submit" disabled={busy || !newTarget.trim()}>+ Thêm</button>
        </form>
        <ul className="manage-list">
          {targets.map((target) => (
            <li key={target.id}>
              <span className="manage-dot target-dot" aria-hidden="true" />
              <strong>{target.name}</strong>
              <span className={`manage-badge${target.custom ? " manage-badge-custom" : ""}`}>{target.custom ? "Nhà mình tạo" : "Mặc định"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
