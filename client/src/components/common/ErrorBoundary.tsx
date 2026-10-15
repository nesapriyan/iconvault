import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in [${this.props.name || 'Component'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 m-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-foreground">Something went wrong rendering this view</h3>
          <p className="text-xs text-muted-foreground max-w-lg font-mono bg-background/80 p-3 rounded-xl border border-border text-left overflow-auto max-h-32">
            {this.state.error?.message || 'Unknown error occurred'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors border border-border"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
