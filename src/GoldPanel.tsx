import { useEffect, useState, type FormEvent } from "react";
import { addGoldPurchase, deleteGoldPurchase, getGold, setGoldPrice, updateGoldPurchase } from "./api";
import { useAutoRefresh } from "./autoRefresh";
import { daysFromToday, formatAmountInput, formatCurrency, formatDate, parseAmountInput, toDateInput } from "./format";
import type { GoldOverview, GoldPurchase } from "./types";

type GoldPanelProps = {
  token: string;
  /** Mua/sửa/xóa vàng xong: Dashboard tải lại "Tiền trong ví còn lại". */
  onChanged: () => void;
};

/** "0,5" hoặc "0.5" → 0.5 (người Việt hay gõ dấu phẩy thập phân). */
const parseChi = (value: string) => Number(value.replace(",", "."));
const formatChi = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
const formatPercent = (value: number) =>
  `${value > 0 ? "+" : ""}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;

function ProfitText({ profit, percent }: { profit: number | null; percent: number | null }) {
  if (profit === null) return <span className="gold-profit gold-profit-unknown">Chưa có giá hiện tại</span>;
  const tone = profit > 0 ? "up" : profit < 0 ? "down" : "flat";
  return (
    <span className={`gold-profit gold-profit-${tone}`}>
      {profit > 0 ? "+" : ""}{formatCurrency(profit)}{percent !== null ? ` (${formatPercent(percent)})` : ""}
    </span>
  );
}

export default function GoldPanel({ token, onChanged }: GoldPanelProps) {
  const [gold, setGold] = useState<GoldOverview | null>(null);
  const [priceDate, setPriceDate] = useState(() => toDateInput(new Date()));
  const [price, setPrice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [purchasedOn, setPurchasedOn] = useState(() => toDateInput(new Date()));
  const [quantity, setQuantity] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getGold(token)
      .then(setGold)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Không tải được dữ liệu vàng."));
  }, [token]);

  // Người khác mua vàng / cập nhật giá → tự hiện (chậm nhất ~10 giây). Lỗi mạng khi tải ngầm thì bỏ qua.
  useAutoRefresh(() => {
    getGold(token).then(setGold).catch(() => undefined);
  });

  const current = gold?.currentPrice ?? null;
  const priceAge = current ? daysFromToday(current.priceDate) : null;
  const quantityNumber = parseChi(quantity);
  const costNumber = parseAmountInput(totalCost);
  const previewPerChi = quantityNumber > 0 && costNumber > 0 ? Math.round(costNumber / quantityNumber) : null;

  async function run(action: () => Promise<GoldOverview>, success: string, affectsWallet: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setGold(await action());
      setNotice(success);
      if (affectsWallet) onChanged();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không lưu được.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handlePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => setGoldPrice(token, priceDate, parseAmountInput(price)), "Đã cập nhật giá vàng. Lãi/lỗ đã được tính lại.", false);
    if (ok) setPrice("");
  }

  function resetForm() {
    setEditingId(null);
    setPurchasedOn(toDateInput(new Date()));
    setQuantity("");
    setTotalCost("");
    setNote("");
  }

  function startEdit(purchase: GoldPurchase) {
    setEditingId(purchase.id);
    setPurchasedOn(purchase.purchasedOn);
    setQuantity(String(purchase.quantityChi).replace(".", ","));
    setTotalCost(formatAmountInput(String(purchase.totalCost)));
    setNote(purchase.note ?? "");
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function handlePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(quantityNumber > 0)) {
      setError("Số chỉ phải lớn hơn 0 (ví dụ 2 hoặc 0,5).");
      return;
    }
    const input = { purchasedOn, quantityChi: quantityNumber, totalCost: costNumber, note };
    const ok = await run(
      () => (editingId === null ? addGoldPurchase(token, input) : updateGoldPurchase(token, editingId, input)),
      editingId === null ? "Đã ghi lần mua vàng." : "Đã cập nhật lần mua vàng.",
      true,
    );
    if (ok) {
      resetForm();
      setFormOpen(false);
    }
  }

  async function handleDelete(purchase: GoldPurchase) {
    if (!window.confirm(`Xóa lần mua ${formatChi(purchase.quantityChi)} chỉ ngày ${formatDate(purchase.purchasedOn)}?`)) return;
    await run(() => deleteGoldPurchase(token, purchase.id), "Đã xóa lần mua vàng.", true);
  }

  if (!gold) {
    return error ? <p className="transaction-empty" role="alert">{error}</p> : null;
  }

  const totals = gold.totals;

  return (
    <section className="content-card gold-card" aria-label="Mua vàng">
      <div className="section-heading planning-heading">
        <div>
          <span className="eyebrow">TÍCH TRỮ VÀNG</span>
          <h2>Mua vàng</h2>
        </div>
        {!formOpen && (
          <button type="button" className="button button-install" onClick={() => { resetForm(); setFormOpen(true); }}>+ Ghi lần mua</button>
        )}
      </div>

      {/* ---- Giá vàng hiện tại (nhập tay) ---- */}
      <div className="gold-price-box">
        <div className="gold-price-now">
          <span>Giá vàng hiện tại (1 chỉ)</span>
          {current ? (
            <>
              <strong>{formatCurrency(current.pricePerChi)}</strong>
              <small>
                Nhập ngày {formatDate(current.priceDate)}
                {priceAge !== null && priceAge < 0 ? ` · hôm nay chưa nhập, đang dùng giá ${-priceAge} ngày trước` : " · hôm nay"}
              </small>
            </>
          ) : (
            <strong className="gold-price-missing">Chưa nhập giá</strong>
          )}
        </div>
        <form className="gold-price-form" onSubmit={handlePrice}>
          <input type="date" value={priceDate} max={toDateInput(new Date())} required aria-label="Ngày của giá vàng" onChange={(event) => setPriceDate(event.target.value)} />
          <input
            inputMode="numeric"
            value={price}
            required
            maxLength={17}
            placeholder="Giá 1 chỉ, vd 14,000,000"
            aria-label="Giá vàng 1 chỉ"
            onChange={(event) => setPrice(formatAmountInput(event.target.value))}
          />
          <button className="button button-primary" type="submit" disabled={busy || !price}>Cập nhật giá</button>
        </form>
      </div>

      {/* ---- Form ghi / sửa lần mua ---- */}
      {formOpen && (
        <form className="transaction-form planning-form" onSubmit={handlePurchase}>
          <div className="planning-form-grid">
            <div>
              <label htmlFor="gold-date">Ngày mua</label>
              <input id="gold-date" type="date" value={purchasedOn} max={toDateInput(new Date())} required onChange={(event) => setPurchasedOn(event.target.value)} />
            </div>
            <div>
              <label htmlFor="gold-qty">Số chỉ</label>
              <input id="gold-qty" inputMode="decimal" value={quantity} required maxLength={10} placeholder="vd 2 hoặc 0,5" onChange={(event) => setQuantity(event.target.value.replace(/[^\d.,]/g, ""))} />
            </div>
          </div>
          <label htmlFor="gold-cost">Tổng tiền đã trả (₫)</label>
          <input id="gold-cost" inputMode="numeric" value={totalCost} required maxLength={17} placeholder="vd 30,000,000" onChange={(event) => setTotalCost(formatAmountInput(event.target.value))} />
          <p className="field-hint">
            {previewPerChi ? <>Tương đương <b>{formatCurrency(previewPerChi)}</b> / chỉ.</> : "1 lượng = 10 chỉ."}
          </p>
          <label htmlFor="gold-note">Ghi chú (không bắt buộc)</label>
          <input id="gold-note" value={note} maxLength={255} placeholder="vd nhẫn 9999, tiệm Bảo Tín" onChange={(event) => setNote(event.target.value)} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="transaction-form-actions">
            <button className="button button-primary transaction-submit" type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : editingId === null ? "Lưu lần mua" : "Lưu thay đổi"}
            </button>
            <button className="button button-install transaction-cancel" type="button" disabled={busy} onClick={() => { resetForm(); setFormOpen(false); setError(""); }}>Hủy</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      {/* ---- Danh sách lần mua + lãi/lỗ ---- */}
      {gold.purchases.length === 0 ? (
        <p className="transaction-empty">Chưa có lần mua vàng nào.</p>
      ) : (
        <>
          <div className="transaction-list gold-list">
            {gold.purchases.map((purchase) => {
              const tone = purchase.profit === null ? "flat" : purchase.profit > 0 ? "up" : purchase.profit < 0 ? "down" : "flat";
              return (
                <article className="transaction-row gold-row" key={purchase.id}>
                  <div className="transaction-type-mark gold-mark" aria-hidden="true">Au</div>
                  <div className="transaction-description">
                    <strong>
                      {formatChi(purchase.quantityChi)} chỉ vàng
                      {purchase.profit !== null && (
                        <em className={`gold-tag gold-tag-${tone}`}>{tone === "up" ? "Lãi" : tone === "down" ? "Lỗ" : "Hòa vốn"}</em>
                      )}
                    </strong>
                    <span>
                      Mua {formatDate(purchase.purchasedOn)} · {formatCurrency(purchase.costPerChi)}/chỉ
                      {purchase.note ? ` · ${purchase.note}` : ""}
                    </span>
                  </div>
                  <div className="gold-figures">
                    <strong>{formatCurrency(purchase.totalCost)}</strong>
                    <ProfitText profit={purchase.profit} percent={purchase.profitPercent} />
                    {purchase.currentValue !== null && <small>Giá trị nay {formatCurrency(purchase.currentValue)}</small>}
                  </div>
                  <div className="gold-actions">
                    <button className="transaction-edit-button" type="button" aria-label={`Sửa lần mua ngày ${formatDate(purchase.purchasedOn)}`} onClick={() => startEdit(purchase)}>Sửa</button>
                    <button className="transaction-edit-button planned-delete" type="button" aria-label={`Xóa lần mua ngày ${formatDate(purchase.purchasedOn)}`} onClick={() => void handleDelete(purchase)}>Xóa</button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="gold-totals">
            <div><span>Tổng số vàng</span><strong>{formatChi(totals.quantityChi)} chỉ</strong></div>
            <div><span>Tổng vốn</span><strong>{formatCurrency(totals.totalCost)}</strong></div>
            <div><span>Giá trị hiện tại</span><strong>{totals.currentValue === null ? "—" : formatCurrency(totals.currentValue)}</strong></div>
            <div><span>Lãi / lỗ</span><ProfitText profit={totals.profit} percent={totals.profitPercent} /></div>
          </div>
        </>
      )}

      {gold.recentPrices.length > 1 && (
        <details className="gold-history">
          <summary>Lịch sử giá đã nhập</summary>
          <ul>
            {gold.recentPrices.map((entry) => (
              <li key={entry.priceDate}><span>{formatDate(entry.priceDate)}</span><b>{formatCurrency(entry.pricePerChi)}</b></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
