import { useEffect, useMemo, useRef, useState } from "react";
import { getSpendingStats, getSpendingTargets, getTransactionCategories } from "./api";
import type { SpendingStats, StatsGroup } from "./types";

/**
 * Bảng màu phân loại (8 màu, thứ tự cố định, đã kiểm tra phân biệt được cả với người mù màu).
 * Màu gắn theo đối tượng/mục (không theo thứ hạng) nên đổi tháng thì màu vẫn giữ nguyên.
 */
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER_COLOR = "#a3aaa0";

type Dimension = "category" | "target";
type PeriodMode = "month" | "year";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);

const formatCompact = (amount: number) => {
  const value = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  if (amount >= 1_000_000_000) return `${value.format(amount / 1_000_000_000)}tỷ`;
  if (amount >= 1_000_000) return `${value.format(amount / 1_000_000)}tr`;
  if (amount >= 1_000) return `${value.format(amount / 1_000)}k`;
  return value.format(amount);
};

const formatShare = (part: number, total: number) => {
  if (total <= 0) return "0%";
  const share = (part / total) * 100;
  return share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
};

/**
 * Làm tròn % sao cho tổng luôn đúng 100 (phương pháp phần dư lớn nhất).
 * Ví dụ 33.3 / 33.3 / 33.4 → 33 / 33 / 34 thay vì 33 / 33 / 33.
 */
function roundShares(amounts: number[]): number[] {
  const total = amounts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((value) => (value / total) * 100);
  const rounded = raw.map(Math.floor);
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder)
    .forEach(({ index }) => {
      if (remaining > 0) {
        rounded[index] += 1;
        remaining -= 1;
      }
    });
  return rounded;
}

/** Chọn chữ trắng hoặc gần đen, tùy cái nào tương phản hơn với màu nền của đoạn. */
function labelColorOn(hex: string) {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const contrastWhite = 1.05 / (luminance + 0.05);
  const contrastDark = (luminance + 0.05) / 0.0545; // #1f2a20
  return contrastWhite >= contrastDark ? "#ffffff" : "#1f2a20";
}

/** Đoạn hẹp hơn mức này thì không in % (vẫn xem được ở bảng chú thích và khi rê chuột). */
const MIN_LABEL_WIDTH = 34;

const toMonthKey =(date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Bước chia trục tròn số: 1, 2, 5 × 10^n. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * step >= value) return factor * step;
  }
  return 10 * step;
}

type AnalyticsPanelProps = {
  token: string;
  /** Tăng lên mỗi khi có giao dịch mới/sửa để tải lại số liệu. */
  refreshKey: number;
};

export default function AnalyticsPanel({ token, refreshKey }: AnalyticsPanelProps) {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [year, setYear] = useState(now.getFullYear());
  const [dimension, setDimension] = useState<Dimension>("category");
  const [stats, setStats] = useState<SpendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [targetOrder, setTargetOrder] = useState<string[]>([]);

  const period = mode === "year" ? String(year) : toMonthKey(month);
  const isCurrentPeriod = mode === "year" ? year >= now.getFullYear() : toMonthKey(month) >= toMonthKey(now);

  // Thứ tự cố định để gán màu: danh mục theo tên (như backend trả), đối tượng theo thứ tự sắp xếp.
  useEffect(() => {
    let active = true;
    Promise.all([getTransactionCategories(token, "EXPENSE"), getSpendingTargets(token)])
      .then(([categories, targets]) => {
        if (!active) return;
        setCategoryOrder(categories.map((category) => category.name));
        setTargetOrder(targets.map((target) => target.name));
      })
      .catch(() => {
        /* Không có danh sách thì vẫn hiển thị được, chỉ là màu gán theo thứ tự xuất hiện. */
      });
    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  // Kỳ đã tải xong gần nhất: tải lại đúng kỳ đó (tự cập nhật) thì thay số liệu êm, không nháy "Đang tải".
  const loadedPeriodRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const background = loadedPeriodRef.current === period;
    if (!background) {
      setLoading(true);
      setError("");
    }
    getSpendingStats(token, period)
      .then((result) => {
        if (!active) return;
        setStats(result);
        loadedPeriodRef.current = period;
      })
      .catch((requestError: unknown) => {
        if (active && !background) setError(requestError instanceof Error ? requestError.message : "Không tải được thống kê.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, period, refreshKey]);

  const groups: StatsGroup[] = stats ? (dimension === "category" ? stats.byCategory : stats.byTarget) : [];
  const total = stats?.totalExpense ?? 0;
  const shares = useMemo(() => roundShares(groups.map((group) => group.amount)), [groups]);

  // Đo chiều rộng thanh để biết đoạn nào đủ chỗ in %.
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const element = barRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBarWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [groups.length > 0]);

  const colorOf = useMemo(() => {
    const order = dimension === "category" ? categoryOrder : targetOrder;
    // Mục không có trong danh sách (vd. "Khác") xếp sau, theo thứ tự tên để vẫn ổn định.
    const extras = groups.map((group) => group.name).filter((name) => !order.includes(name)).sort();
    const fullOrder = [...order, ...extras];
    return (name: string) => {
      if (name === "Khác") return OTHER_COLOR;
      const index = fullOrder.indexOf(name);
      return index >= 0 && index < SERIES_COLORS.length ? SERIES_COLORS[index] : OTHER_COLOR;
    };
  }, [dimension, categoryOrder, targetOrder, groups]);

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function openMonth(monthNumber: number) {
    setMonth(new Date(year, monthNumber - 1, 1));
    setMode("month");
  }

  const daysInPeriod = mode === "year"
    ? (year === now.getFullYear() ? now.getMonth() + 1 : 12)
    : (toMonthKey(month) === toMonthKey(now) ? now.getDate() : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
  const average = daysInPeriod > 0 ? total / daysInPeriod : 0;
  const periodLabel = mode === "year"
    ? `Năm ${year}`
    : new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(month);
  const hoveredGroup = groups.find((group) => group.name === hovered);

  return (
    <section className="content-card analytics-card" aria-label="Phân tích chi tiêu">
      <div className="section-heading analytics-heading">
        <div><span className="eyebrow">PHÂN TÍCH CHI TIÊU</span><h2>Nhà mình đã chi vào đâu?</h2></div>
        <div className="analytics-controls">
          <div className="segmented" role="group" aria-label="Xem theo">
            <button type="button" className={mode === "month" ? "active" : ""} aria-pressed={mode === "month"} onClick={() => setMode("month")}>Tháng</button>
            <button type="button" className={mode === "year" ? "active" : ""} aria-pressed={mode === "year"} onClick={() => setMode("year")}>Năm</button>
          </div>
          <div className="month-navigation">
            <button
              type="button"
              aria-label={mode === "year" ? "Năm trước" : "Tháng trước"}
              onClick={() => (mode === "year" ? setYear((value) => value - 1) : changeMonth(-1))}
              disabled={mode === "year" && year <= 2000}
            >‹</button>
            <strong>{periodLabel}</strong>
            <button
              type="button"
              aria-label={mode === "year" ? "Năm sau" : "Tháng sau"}
              disabled={isCurrentPeriod}
              onClick={() => (mode === "year" ? setYear((value) => value + 1) : changeMonth(1))}
            >›</button>
          </div>
        </div>
      </div>

      {error ? <p className="transaction-empty" role="alert">{error}</p> : null}

      {stats && (
        <div className={loading ? "analytics-body is-loading" : "analytics-body"}>
          <div className="analytics-tiles">
            <div className="analytics-tile">
              <span>Tổng chi</span>
              <strong className="expense-total">{formatCurrency(stats.totalExpense)}</strong>
            </div>
            <div className="analytics-tile">
              <span>Tổng thu</span>
              <strong className="income-total">{formatCurrency(stats.totalIncome)}</strong>
            </div>
            <div className="analytics-tile">
              <span>Chênh lệch</span>
              <strong>{formatCurrency(stats.totalIncome - stats.totalExpense)}</strong>
            </div>
            <div className="analytics-tile">
              <span>{mode === "year" ? "Chi trung bình / tháng" : "Chi trung bình / ngày"}</span>
              <strong>{formatCurrency(Math.round(average))}</strong>
              <small>{stats.expenseCount} khoản chi</small>
            </div>
          </div>

          {mode === "year" && <MonthlyChart stats={stats} hoveredMonth={hoveredMonth} onHover={setHoveredMonth} onOpen={openMonth} />}

          <div className="analytics-split-heading">
            <h3>Cơ cấu chi tiêu {mode === "year" ? "cả năm" : "trong tháng"}</h3>
            <div className="segmented" role="group" aria-label="Phân tích theo">
              <button type="button" className={dimension === "category" ? "active" : ""} aria-pressed={dimension === "category"} onClick={() => setDimension("category")}>Theo mục đích</button>
              <button type="button" className={dimension === "target" ? "active" : ""} aria-pressed={dimension === "target"} onClick={() => setDimension("target")}>Theo người</button>
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="transaction-empty">Chưa có khoản chi nào trong {mode === "year" ? "năm" : "tháng"} này.</p>
          ) : (
            <>
              <div className="split-bar-wrap">
                <div
                  ref={barRef}
                  className="split-bar"
                  role="img"
                  aria-label={groups.map((group, index) => `${group.name} ${shares[index]}%`).join(", ")}
                >
                  {groups.map((group, index) => {
                    const color = colorOf(group.name);
                    const gaps = 2 * (groups.length - 1);
                    const segmentWidth = total > 0 ? ((barWidth - gaps) * group.amount) / total : 0;
                    return (
                      <span
                        key={group.name}
                        className={`split-segment${hovered && hovered !== group.name ? " dimmed" : ""}`}
                        style={{ flexGrow: group.amount, background: color, color: labelColorOn(color) }}
                        title={`${group.name}: ${formatCurrency(group.amount)} (${shares[index]}%)`}
                        onMouseEnter={() => setHovered(group.name)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {segmentWidth >= MIN_LABEL_WIDTH ? `${shares[index]}%` : null}
                      </span>
                    );
                  })}
                </div>
                {hoveredGroup && (
                  <div className="split-tooltip" role="status">
                    <i style={{ background: colorOf(hoveredGroup.name) }} />
                    <strong>{hoveredGroup.name}</strong>
                    <span>{formatCurrency(hoveredGroup.amount)} · {shares[groups.indexOf(hoveredGroup)]}%</span>
                  </div>
                )}
              </div>

              <ul className="analytics-list">
                {groups.map((group, index) => (
                  <li
                    key={group.name}
                    className={`analytics-row${hovered === group.name ? " highlighted" : ""}${hovered && hovered !== group.name ? " dimmed" : ""}`}
                    onMouseEnter={() => setHovered(group.name)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <i className="analytics-swatch" style={{ background: colorOf(group.name) }} aria-hidden="true" />
                    <div className="analytics-row-text">
                      <strong>{group.name}</strong>
                      <span>
                        {dimension === "category" ? "Chi cho: " : "Chi vào: "}
                        {group.breakdown.slice(0, 3).map((part) => `${part.name} ${formatShare(part.amount, group.amount)}`).join(" · ")}
                        {group.breakdown.length > 3 ? ` · +${group.breakdown.length - 3} khác` : ""}
                      </span>
                    </div>
                    <div className="analytics-row-figures">
                      <strong>{formatCurrency(group.amount)}</strong>
                      <span>{shares[index]}% · {group.count} khoản</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {!stats && loading && <p className="transaction-empty">Đang tải thống kê...</p>}
    </section>
  );
}

type MonthlyChartProps = {
  stats: SpendingStats;
  hoveredMonth: number | null;
  onHover: (month: number | null) => void;
  onOpen: (month: number) => void;
};

/** Biểu đồ cột chi tiêu 12 tháng; rê chuột xem thu/chi, bấm vào cột để mở tháng đó. */
function MonthlyChart({ stats, hoveredMonth, onHover, onOpen }: MonthlyChartProps) {
  const max = niceMax(Math.max(...stats.months.map((month) => month.expense), 0));
  const ticks = [max, max / 2, 0];
  const active = stats.months.find((month) => month.month === hoveredMonth);

  return (
    <div className="monthly-chart">
      <div className="monthly-chart-title">
        <h3>Chi tiêu từng tháng</h3>
        <span>Bấm vào một cột để xem chi tiết tháng đó</span>
      </div>
      <div className="monthly-chart-plot">
        <div className="monthly-axis" aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{formatCompact(tick)}</span>)}
        </div>
        <div className="monthly-bars">
          <div className="monthly-grid" aria-hidden="true"><i /><i /><i /></div>
          {stats.months.map((month) => (
            <button
              type="button"
              key={month.month}
              className={`monthly-column${hoveredMonth === month.month ? " active" : ""}`}
              aria-label={`Tháng ${month.month}: chi ${formatCurrency(month.expense)}, thu ${formatCurrency(month.income)}`}
              onMouseEnter={() => onHover(month.month)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(month.month)}
              onBlur={() => onHover(null)}
              onClick={() => onOpen(month.month)}
            >
              <span className="monthly-bar" style={{ height: `${(month.expense / max) * 100}%` }} />
              <span className="monthly-label">T{month.month}</span>
            </button>
          ))}
          {active && (
            <div
              className="monthly-tooltip"
              style={{
                left: `${((active.month - 0.5) / 12) * 100}%`,
                // Cột ở hai đầu: canh tooltip vào trong để không tràn khỏi khung.
                transform: active.month <= 2 ? "translateX(-15%)" : active.month >= 11 ? "translateX(-85%)" : undefined,
              }}
              role="status"
            >
              <strong>Tháng {active.month}</strong>
              <span>Chi <b className="expense-total">{formatCurrency(active.expense)}</b></span>
              <span>Thu <b className="income-total">{formatCurrency(active.income)}</b></span>
              <span>Chênh lệch <b>{formatCurrency(active.income - active.expense)}</b></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
