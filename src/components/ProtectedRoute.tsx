import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import type { UserRole } from "@/types";

export function ProtectedRoute({
  roles,
  area,
  children,
}: {
  roles: UserRole[];
  area: "admin" | "affiliate";
  children: React.ReactNode;
}) {
  const { adminSession, affiliateSession } = useApp();
  const location = useLocation();
  const session = area === "admin" ? adminSession : affiliateSession;

  if (!session) {
    return <Navigate to={area === "admin" ? "/admin/login" : "/affiliate/login"} replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(session.user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
