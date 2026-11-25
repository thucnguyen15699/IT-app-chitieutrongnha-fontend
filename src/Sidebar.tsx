import { useEffect, useState, type ReactNode } from "react";

export type Page = "overview" | "planned" | "savings" | "analytics" | "categories";

/** Mỗi trang có một địa chỉ #/... để nút Back trên điện thoại hoạt động đúng. */
const PAGE_HASH: Record<Page, string> = {
  overview: "#/tong-quan",
  planned: "#/sap-chi",
  savings: "#/tiet-kiem",
  analytics: "#/phan-tich",
  categories: "#/danh-muc",
};

export const PAGE_TITLE: Record<Page, string> = {
  overview: "Tổng quan",
  planned: "Khoản sắp phải chi",
  savings: "Tiết kiệm",
  analytics: "Phân tích",
  categories: "Danh mục",
};

function pageFromHash(hash: string): Page {
  const match = (Object.entries(PAGE_HASH) as Array<[Page, string]>).find(([, value]) => value === hash);
  return match ? match[0] : "overview";
}

/** Trang hiện tại, đồng bộ với địa chỉ trên thanh URL. */
export function usePage(): [Page, (page: Page) => void] {
  const [page, setPage] = useState<Page>(() => pageFromHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (next: Page) => {
    if (window.location.hash !== PAGE_HASH[next]) window.location.hash = PAGE_HASH[next];
    setPage(next);
    window.scrollTo({ top: 0 });
  };
  return [page, navigate];
}

// ---- Icon nét mảnh, 20×20 ----
const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const icons: Record<Page | "admin" | "logout" | "install", ReactNode> = {
  overview: <Icon><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Icon>,
  planned: <Icon><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M8 14h3" /></Icon>,
  savings: <Icon><path d="M5 11a7 6 0 0 1 13.5-2H20v4l-2 1v3h-3v-2H9v2H6v-3.5A6 6 0 0 1 5 11Z" /><path d="M10 7.5h3" /></Icon>,
  analytics: <Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>,
  categories: <Icon><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><path d="M17.25 14v6.5M14 17.25h6.5" /></Icon>,
  admin: <Icon><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Icon>,
  install: <Icon><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 20h14" /></Icon>,
  logout: <Icon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></Icon>,
};

const NAV_ITEMS: Page[] = ["overview", "planned", "savings", "analytics", "categories"];

type SidebarProps = {
  page: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Chỉ dùng trên điện thoại: đóng ngăn kéo. */
  onClose: () => void;
  familyName: string;
  userName: string;
  isAdmin: boolean;
  pendingCount: number;
  onAdmin: () => void;
  onInstall: () => void;
  onSignOut: () => void;
};

export default function Sidebar({
  page,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  onClose,
  familyName,
  userName,
  isAdmin,
  pendingCount,
  onAdmin,
  onInstall,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className="sidebar" id="app-sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-head">
        <a className="brand" href="#/tong-quan" onClick={(event) => { event.preventDefault(); onNavigate("overview"); }}>
          <span className="brand-mark">n</span><span className="sidebar-label">NhaMinh</span>
        </a>
        <button
          type="button"
          className="sidebar-icon-button sidebar-collapse"
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          title={collapsed ? "Mở rộng" : "Thu gọn"}
          onClick={onToggleCollapsed}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {collapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
          </svg>
        </button>
        <button type="button" className="sidebar-icon-button sidebar-close" aria-label="Đóng menu" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="sidebar-family" title={familyName}>
        <span className="family-icon">⌂</span>
        <span className="sidebar-label"><small>Gia đình</small><strong>{familyName}</strong></span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <a
            key={item}
            href={PAGE_HASH[item]}
            className={`sidebar-link${page === item ? " active" : ""}`}
            aria-current={page === item ? "page" : undefined}
            title={collapsed ? PAGE_TITLE[item] : undefined}
            onClick={(event) => { event.preventDefault(); onNavigate(item); }}
          >
            {icons[item]}
            <span className="sidebar-label">{PAGE_TITLE[item]}</span>
            {item === "planned" && pendingCount > 0 && <span className="sidebar-badge" aria-label={`${pendingCount} khoản`}>{pendingCount}</span>}
          </a>
        ))}
      </nav>

      <div className="sidebar-foot">
        {isAdmin && (
          <button type="button" className="sidebar-link" title={collapsed ? "Quản trị" : undefined} onClick={onAdmin}>
            {icons.admin}<span className="sidebar-label">Quản trị</span>
          </button>
        )}
        <button type="button" className="sidebar-link" title={collapsed ? "Cài lên điện thoại" : undefined} onClick={onInstall}>
          {icons.install}<span className="sidebar-label">Cài lên điện thoại</span>
        </button>
        <button type="button" className="sidebar-link sidebar-logout" title={collapsed ? "Đăng xuất" : undefined} onClick={onSignOut}>
          {icons.logout}<span className="sidebar-label">Đăng xuất <small>{userName}</small></span>
        </button>
      </div>
    </aside>
  );
}
