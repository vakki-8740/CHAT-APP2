import { Component } from "react";
import { AlertTriangle } from "lucide-react";

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Unhandled UI error", error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="app-frame flex min-h-[100dvh] items-center justify-center p-6">
                <div className="panel w-full max-w-sm p-6 text-center">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                        <AlertTriangle className="size-6" />
                    </span>
                    <h1 className="mt-4 text-lg font-bold">Something went wrong</h1>
                    <p className="mt-1 text-sm text-muted">
                        The screen could not be rendered. Reloading usually fixes it.
                    </p>
                    <p className="mt-3 break-words rounded-md bg-bg px-3 py-2 text-left text-2xs text-muted">
                        {String(this.state.error?.message || this.state.error)}
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary btn-full mt-4"
                        onClick={() => window.location.reload()}
                    >
                        Reload app
                    </button>
                </div>
            </div>
        );
    }
}
