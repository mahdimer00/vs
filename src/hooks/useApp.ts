import { useContext } from "react";
import { AppContext } from "@/features/app/AppProvider";

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return context;
}
