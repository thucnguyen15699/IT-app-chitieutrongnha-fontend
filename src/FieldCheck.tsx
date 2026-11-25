import { useEffect, useState } from "react";
import { checkAvailability } from "./api";

export type CheckKind = "username" | "email" | "phoneNumber";
export type FieldCheckState = { status: "idle" | "checking" | "ok" | "error"; message: string };

const IDLE: FieldCheckState = { status: "idle", message: "" };

/**
 * Tự kiểm tra định dạng & trùng lặp sau khi người dùng ngừng gõ ~0,45 giây.
 * - token: đang sửa thông tin của chính mình → không báo trùng với chính mình.
 * - unchanged: giá trị hiện tại của tài khoản; gõ lại đúng giá trị này thì không cần kiểm tra.
 */
export function useFieldCheck(
  kind: CheckKind,
  value: string,
  options: { token?: string; unchanged?: string | null } = {},
): FieldCheckState {
  const [state, setState] = useState<FieldCheckState>(IDLE);
  const { token, unchanged } = options;

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || (unchanged && trimmed.toLowerCase() === unchanged.toLowerCase())) {
      setState(IDLE);
      return;
    }
    let active = true;
    setState({ status: "checking", message: "Đang kiểm tra..." });
    const timer = window.setTimeout(() => {
      checkAvailability({ [kind]: trimmed }, token)
        .then((result) => {
          const check = result[kind];
          if (!active || !check) return;
          setState({ status: check.valid && check.available ? "ok" : "error", message: check.message });
        })
        .catch(() => {
          // Mất mạng thì bỏ qua; backend vẫn kiểm tra lại khi bấm Lưu.
          if (active) setState(IDLE);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [kind, value, token, unchanged]);

  return state;
}

/** Dòng trạng thái dưới ô nhập: ✓ xanh khi dùng được, đỏ khi trùng/sai định dạng. */
export function FieldStatus({ check, id }: { check: FieldCheckState; id?: string }) {
  if (check.status === "idle") return null;
  return (
    <p id={id} className={`field-check field-check-${check.status}`} role={check.status === "error" ? "alert" : undefined} aria-live="polite">
      {check.status === "ok" ? "✓ " : check.status === "error" ? "✕ " : ""}
      {check.message}
    </p>
  );
}

export const hasError = (...checks: FieldCheckState[]) => checks.some((check) => check.status === "error");
export const isChecking = (...checks: FieldCheckState[]) => checks.some((check) => check.status === "checking");
