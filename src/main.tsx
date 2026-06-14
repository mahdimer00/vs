import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { RouterProvider } from "react-router-dom";
import { AppProvider } from "@/features/app/AppProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { router } from "@/app/router";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
