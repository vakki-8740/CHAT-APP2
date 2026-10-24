import { AlertTriangle, X } from "lucide-react";
import { Spinner } from "./LoadingScreen";

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "danger",
    busy = false,
    onConfirm,
    onCancel
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-3 pb-3 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={() => !busy && onCancel?.()}
        >
            <div
                className="animate-fade-in w-full max-w-sm rounded-xl border border-line bg-card p-5 shadow-sheet"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                            tone === "danger"
                                ? "bg-danger/10 text-danger"
                                : "bg-accent-soft text-accent"
                        }`}
                    >
                        <AlertTriangle className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-[15px] font-bold">{title}</h2>
                        {description ? (
                            <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"
                        aria-label="Close"
                        disabled={busy}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="mt-5 flex gap-2">
                    <button
                        type="button"
                        className="btn btn-secondary flex-1"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn flex-1 ${
                            tone === "danger" ? "btn-danger" : "btn-primary"
                        }`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? <Spinner className="size-4" /> : null}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
