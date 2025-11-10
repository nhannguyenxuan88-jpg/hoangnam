import React from "react";
import { showToast } from "../../utils/toast";

type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, errorInfo);
    showToast.error("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.");
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl text-center max-w-md">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Có lỗi xảy ra
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Vui lòng tải lại trang hoặc quay lại sau.
              </p>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
