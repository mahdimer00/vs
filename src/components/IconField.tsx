import type { ComponentType, ReactNode } from "react";

interface IconFieldProps {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}

export function IconField({ icon: Icon, children, className = "" }: IconFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Icon className="pointer-events-none absolute start-4 top-3.5 h-4 w-4 text-slate-400" />
      {children}
    </div>
  );
}
