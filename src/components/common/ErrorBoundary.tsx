import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logSystemError } from '../../utils/telemetry/crashLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    try {
      logSystemError(
        'runtime',
        error.message || String(error),
        { componentStack: errorInfo.componentStack },
        error.stack
      );
    } catch {
      // Ignore telemetry failure during crash handling
    }
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen w-full flex items-center justify-center p-6 bg-[#06120F] text-white font-sans select-none"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#0B1F1A]/95 border border-emerald-500/40 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 text-2xl shadow-[0_0_20px_rgba(244,63,94,0.35)]">
              ⚠️
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white">خطای غیرمنتظره در اجرای ترمینال</h2>
              <p className="text-xs text-emerald-200/70">
                سیستم از کرش کلی برنامه جلوگیری کرد. می‌توانید صفحه را بازیابی یا مجدداً بارگذاری کنید.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-right text-[11px] font-mono text-rose-300 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#164538] hover:bg-[#1E5D4C] text-emerald-100 border border-emerald-400/30 transition cursor-pointer"
              >
                تلاش مجدد و بازگشت
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition cursor-pointer"
              >
                بارگذاری مجدد ترمینال
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
