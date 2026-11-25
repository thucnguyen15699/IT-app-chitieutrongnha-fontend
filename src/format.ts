export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);

/** Định dạng ô nhập tiền: chỉ giữ chữ số, thêm dấu phẩy hàng nghìn. */
export const formatAmountInput = (value: string) =>
  value.replace(/\D/g, "").slice(0, 13).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const parseAmountInput = (value: string) => Number(value.replaceAll(",", ""));

export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${isoDate}T00:00:00`));

/** Số ngày từ hôm nay tới ngày đó (âm nếu đã qua). */
export const daysFromToday = (isoDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${isoDate}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
};
