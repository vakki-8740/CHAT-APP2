import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../utils/cn";

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
};

const TONES = {
    success: "text-success",
    error: "text-danger",
    info: "text-accent"
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const remove = useCallback((id) => {
        setToasts((list) => list.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback(
        (message, type = "info") => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setToasts((list) => [...list.slice(-2), { id, message, type }]);
            window.setTimeout(() => remove(id), 4200);
            return id;
        },
        [remove]
    );

    const value = useMemo(
        () => ({
            push,
            success: (message) => push(message, "success"),
            error: (message) => push(message, "error"),
            info: (message) => push(message, "info")
        }),
        [push]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3"
                role="status"
                aria-live="polite"
            >
                {toasts.map((toast) => {
                    const Icon = ICONS[toast.type] || Info;
                    return (
                        <div
                            key={toast.id}
                            className="animate-fade-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5 shadow-card"
                        >
                            <Icon
                                className={cn("mt-0.5 size-4 shrink-0", TONES[toast.type])}
                                aria-hidden="true"
                            />
                            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
                            <button
                                type="button"
                                onClick={() => remove(toast.id)}
                                className="rounded p-0.5 text-muted hover:text-ink"
                                aria-label="Dismiss notification"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used inside ToastProvider");
    return context;
}
