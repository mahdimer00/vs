import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Unhandled application error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
          <div className="surface-card flex max-w-md flex-col items-center gap-4 p-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-slate-950">Something went wrong</h1>
            <p className="text-sm leading-7 text-slate-600">
              An unexpected error occurred. Please refresh the page or return to the homepage.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => window.location.reload()} className="primary-button">
                Reload page
              </button>
              <a href="/" className="ghost-button">
                Go to homepage
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
