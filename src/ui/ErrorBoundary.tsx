import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
};

type State = { error: Error | null };

// Catches throws during render of the subtree (suspense rejections,
// asset-load failures, R3F init errors). Without this around the
// Canvas, a single failed glTF or HDR fetch leaves a black canvas.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
