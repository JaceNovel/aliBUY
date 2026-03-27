export type AdminPermission =
  | "dashboard.read"
  | "users.read"
  | "users.manage"
  | "orders.read"
  | "products.read"
  | "products.manage"
  | "promotions.manage"
  | "support.read"
  | "imports.read"
  | "sourcing.manage"
  | "settings.manage"
  | "admin.manage";

export type AdminRole = "superadmin" | "operations" | "support" | "catalog" | "marketing";

export type AdminAccessRecord = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_ROLE_PRESETS: Record<AdminRole, { label: string; permissions: AdminPermission[] }> = {
  superadmin: {
    label: "Superadmin",
    permissions: ["dashboard.read", "users.read", "users.manage", "orders.read", "products.read", "products.manage", "promotions.manage", "support.read", "imports.read", "sourcing.manage", "settings.manage", "admin.manage"],
  },
  operations: {
    label: "Opérations",
    permissions: ["dashboard.read", "users.read", "orders.read", "support.read", "imports.read", "sourcing.manage"],
  },
  support: {
    label: "Support",
    permissions: ["dashboard.read", "users.read", "orders.read", "support.read"],
  },
  catalog: {
    label: "Catalogue",
    permissions: ["dashboard.read", "products.read", "products.manage", "promotions.manage"],
  },
  marketing: {
    label: "Marketing",
    permissions: ["dashboard.read", "products.read", "promotions.manage"],
  },
};