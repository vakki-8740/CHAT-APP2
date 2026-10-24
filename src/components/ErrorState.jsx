import { AlertTriangle } from "lucide-react";

export function ErrorState({ title = "Something went wrong", message, onRetry, retryLabel = "Try again" }) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle className="size-7" strokeWidth={1.8} />
            </span>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {message ? (
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{message}</p>
            ) : null}
            {onRetry ? (
                <button type="button" className="btn btn-outline btn-sm mt-4" onClick={onRetry}>
                    {retryLabel}
                </button>
            ) : null}
        </div>
    );
}
