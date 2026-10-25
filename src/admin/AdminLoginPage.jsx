import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { PinKeypad } from "../components/PinKeypad";
import { signInAdmin } from "./adminAuth";

export default function AdminLoginPage({ onAuthenticated }) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function handlePinChange(nextPin) {
        setPin(nextPin);
        if (error) setError("");
    }

    async function handleUnlock() {
        if (!pin) {
            setError("Enter the Admin PIN.");
            return;
        }
        setError("");
        setBusy(true);
        try {
            const adminUser = await signInAdmin(pin);
            setPin("");
            onAuthenticated?.(adminUser);
        } catch (err) {
            setError(err?.message || "Could not unlock Admin Panel.");
            setPin("");
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

            <main className="flex flex-1 items-center justify-center px-4 pb-8">
                <div className="animate-fade-in w-full max-w-xs">
                    <div className="mb-5 text-center">
                        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <ShieldCheck className="size-5" />
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Admin Control Panel
                        </h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Enter the Admin PIN manually to open the vault.
                        </p>
                    </div>

                    <PinKeypad
                        value={pin}
                        onChange={handlePinChange}
                        onSubmit={handleUnlock}
                        length={6}
                        maxLength={12}
                        busy={busy}
                        error={error}
                        submitLabel="Open Admin Panel"
                        busyLabel="Verifying Admin…"
                    />
                </div>
            </main>
        </div>
    );
}
