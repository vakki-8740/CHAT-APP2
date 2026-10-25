import { useRef, useState } from "react";
import { AlertCircle, KeyRound, LockKeyhole } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { PasswordInput } from "../components/PasswordInput";
import { APP_LOCK_PIN } from "../config/app";

export default function LockPage({ onUnlock }) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const inputWrapRef = useRef(null);

    function handleChange(event) {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
        setPin(digits);
        if (error) setError("");
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!pin) {
            setError("Enter the 6-digit PIN.");
            return;
        }
        if (pin !== APP_LOCK_PIN) {
            setError("Incorrect PIN. Please try again.");
            setPin("");
            inputWrapRef.current?.querySelector("input")?.focus();
            return;
        }
        setError("");
        onUnlock?.();
    }

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <header className="safe-top flex items-center justify-between px-4 py-3">
                <BrandMark size={32} withName />
                <ThemeToggle />
            </header>

            <main className="flex flex-1 items-center justify-center px-4 pb-10">
                <div className="animate-fade-in w-full max-w-sm">
                    <div className="mb-6">
                        <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <LockKeyhole className="size-5" />
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight">App Locked</h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Enter your PIN to unlock and continue.
                        </p>
                    </div>

                    <form className="panel space-y-4 p-5" onSubmit={handleSubmit} noValidate>
                        <div ref={inputWrapRef} className="relative">
                            <KeyRound className="pointer-events-none absolute left-3 top-[38px] size-4 text-muted" />
                            <PasswordInput
                                label="PIN"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="off"
                                autoFocus
                                placeholder="Enter 6-digit PIN"
                                className="[&_input]:pl-9 [&_input]:tracking-[0.25em] [&_input]:placeholder:tracking-normal"
                                value={pin}
                                onChange={handleChange}
                            />
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

                        <button type="submit" className="btn btn-primary btn-full">
                            Unlock
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
