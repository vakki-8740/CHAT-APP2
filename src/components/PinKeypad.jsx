import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Delete, Eye, EyeOff } from "lucide-react";
import { Spinner } from "./LoadingScreen";
import { cn } from "../utils/cn";

const DIGIT_ROWS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"]
];

/**
 * Pure button-based PIN pad with zero <input> and zero <form> elements.
 *
 * Why no <input> / <form>:
 * Mobile & desktop password managers (Chrome, Google Password Manager, iOS
 * Keychain, Samsung Pass) ignore `autocomplete="off"` on password inputs and
 * offer "Save password?" + 1-tap autofill chips. Rendering no <input> or
 * <form> makes browser PIN saving and autofill 100% impossible—even if a
 * password was previously saved for this domain.
 */
export function PinKeypad({
    value,
    onChange,
    onSubmit,
    length = 6,
    maxLength = 6,
    busy = false,
    error = "",
    submitLabel = "Unlock",
    busyLabel = "Verifying…"
}) {
    const [visible, setVisible] = useState(false);

    const appendDigit = useCallback(
        (digit) => {
            if (busy) return;
            if (value.length >= maxLength) return;
            onChange(value + digit);
        },
        [busy, value, maxLength, onChange]
    );

    const backspace = useCallback(() => {
        if (busy || !value.length) return;
        onChange(value.slice(0, -1));
    }, [busy, value, onChange]);

    const clearAll = useCallback(() => {
        if (busy || !value.length) return;
        onChange("");
    }, [busy, value, onChange]);

    useEffect(() => {
        function handleKeyDown(event) {
            if (busy) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                appendDigit(event.key);
                return;
            }
            if (event.key === "Backspace") {
                event.preventDefault();
                backspace();
                return;
            }
            if (event.key === "Delete" || event.key === "Escape") {
                event.preventDefault();
                clearAll();
                return;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                onSubmit?.();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [busy, appendDigit, backspace, clearAll, onSubmit]);

    const slotCount = Math.max(length, value.length);

    return (
        <div
            className="panel select-none space-y-4 p-5"
            role="group"
            aria-label="Manual PIN keypad"
        >
            {/* Masked PIN Display */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                        Enter PIN manually
                    </span>
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted hover:bg-bg hover:text-ink disabled:opacity-40"
                        aria-label={visible ? "Hide PIN digits" : "Show PIN digits"}
                    >
                        {visible ? (
                            <>
                                <EyeOff className="size-3.5" /> Hide
                            </>
                        ) : (
                            <>
                                <Eye className="size-3.5" /> Show
                            </>
                        )}
                    </button>
                </div>

                <div
                    className="flex items-center justify-center gap-2 rounded-xl border border-line bg-bg px-3 py-3"
                    aria-live="polite"
                >
                    {Array.from({ length: slotCount }).map((_, idx) => {
                        const char = value[idx] || "";
                        const isActive = idx === value.length && value.length < maxLength;
                        return (
                            <span
                                key={idx}
                                className={cn(
                                    "flex h-10 w-9 items-center justify-center rounded-lg border text-base font-bold transition-colors",
                                    char
                                        ? "border-accent bg-accent-soft text-accent"
                                        : isActive
                                          ? "border-accent/55 bg-card text-muted"
                                          : "border-line bg-card text-muted/40"
                                )}
                            >
                                {char ? (visible ? char : "●") : ""}
                            </span>
                        );
                    })}
                </div>
            </div>

            {error ? (
                <p
                    className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
                    role="alert"
                >
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{error}</span>
                </p>
            ) : null}

            {/* Numeric Touch Keypad */}
            <div className="grid grid-cols-3 gap-2">
                {DIGIT_ROWS.flat().map((digit) => (
                    <button
                        key={digit}
                        type="button"
                        disabled={busy}
                        onClick={() => appendDigit(digit)}
                        className="flex h-12 touch-manipulation items-center justify-center rounded-xl border border-line bg-bg text-lg font-bold text-ink transition-transform hover:border-accent hover:bg-accent-soft hover:text-accent active:scale-95 disabled:opacity-40"
                    >
                        {digit}
                    </button>
                ))}

                <button
                    type="button"
                    disabled={busy || !value.length}
                    onClick={clearAll}
                    className="flex h-12 touch-manipulation items-center justify-center rounded-xl border border-line bg-bg text-xs font-semibold text-muted transition-colors hover:border-danger/50 hover:text-danger active:scale-95 disabled:opacity-35"
                >
                    Clear
                </button>

                <button
                    type="button"
                    disabled={busy}
                    onClick={() => appendDigit("0")}
                    className="flex h-12 touch-manipulation items-center justify-center rounded-xl border border-line bg-bg text-lg font-bold text-ink transition-transform hover:border-accent hover:bg-accent-soft hover:text-accent active:scale-95 disabled:opacity-40"
                >
                    0
                </button>

                <button
                    type="button"
                    disabled={busy || !value.length}
                    onClick={backspace}
                    aria-label="Backspace"
                    className="flex h-12 touch-manipulation items-center justify-center rounded-xl border border-line bg-bg text-muted transition-colors hover:border-accent hover:text-ink active:scale-95 disabled:opacity-35"
                >
                    <Delete className="size-5" />
                </button>
            </div>

            <button
                type="button"
                onClick={onSubmit}
                disabled={busy}
                className="btn btn-primary btn-full"
            >
                {busy ? <Spinner className="size-4" /> : null}
                {busy ? busyLabel : submitLabel}
            </button>
        </div>
    );
}
