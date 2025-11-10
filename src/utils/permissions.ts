import type { UserRole } from "../contexts/AuthContext";

export type AppAction =
  | "sale.delete"
  | "part.update_price"
  | "settings.update"
  | "finance.view"
  | "payroll.view"
  | "analytics.view"
  | "reports.view"
  | "employees.view"
  | "debt.view";

const POLICIES: Record<AppAction, UserRole[]> = {
  "sale.delete": ["owner", "manager"],
  "part.update_price": ["owner", "manager"],
  "settings.update": ["owner", "manager"],
  "finance.view": ["owner", "manager"],
  "payroll.view": ["owner", "manager"],
  "analytics.view": ["owner", "manager"],
  "reports.view": ["owner", "manager", "staff"],
  "employees.view": ["owner", "manager"],
  "debt.view": ["owner", "manager"],
};

export function canDo(role: UserRole | undefined, action: AppAction): boolean {
  if (!role) return false;
  return POLICIES[action].includes(role);
}
