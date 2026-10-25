import { useRef, useState } from "react";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { PinInputField } from "../components/PinInputField";
import { Spinner } from "../components/LoadingScreen";
import { signInAdmin } from "./adminAuth";

export default function AdminLoginPage({ onAuthenticated }) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    function handlePinChange(digits) {
        setPin(digits);
        if (error) setError("");
    }

    async function handleSubmit() {
        if (busy) return;
        setError("");
        setBusy(true);
        try {
            const adminUser = await signInAdmin(pin);
            setPin("");
            onAuthenticated?.(adminUser);
        } catch (err) {
            setError(err?.message || "Could not unlock Admin Panel.");
            setPin("");
            inputRef.current?.focus();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <header className="safe-top flex items-center justify-between border-b border-line bg-card/80 px-4 py-3 backdrop-blur">
                <BrandMark size={32} withName subtitle="Admin Vault & Control Panel" />
                <ThemeToggle />
            </header>

            <main className="flex flex-1 items-center justify-center px-4 pb-10">
                <div className="animate-fade-in w-full max-w-sm">
                    <div className="mb-6">
                        <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <ShieldCheck className="size-5" />
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Admin Control Panel
                        </h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Enter the Admin PIN to view all users, permanent chats, images,
                            voice packs and call records.
                        </p>
                    </div>

                    <div className="panel space-y-4 p-5">
                        <div className="relative">
                            <KeyRound className="pointer-events-none absolute left-3 top-[38px] size-4 text-muted" />
                            <PinInputField
                                ref={inputRef}
                                label="Admin PIN"
                                maxLength={12}
                                autoFocus
                                disabled={busy}
                                placeholder="Enter Admin PIN"
                                className="[&_input]:pl-9 [&_input]:tracking-[0.25em] [&_input]:placeholder:tracking-normal"
                                value={pin}
                                onChange={handlePinChange}
                                onEnter={handleSubmit}
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

                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="btn btn-primary btn-full"
                            disabled={busy}
                        >
                            {busy ? <Spinner className="size-4" /> : null}
                            {busy ? "Verifying Admin…" : "Open Admin Panel"}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
