import { AdminShell } from "@/components/admin-shell";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) {
    return children;
  }

  return <AdminShell>{children}</AdminShell>;
}