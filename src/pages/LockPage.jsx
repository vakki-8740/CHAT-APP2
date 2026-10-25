import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { PinKeypad } from "../components/PinKeypad";
import { APP_LOCK_PIN } from "../config/app";

export default function LockPage({ onUnlock }) {
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    function handlePinChange(nextPin) {
        setPin(nextPin);
        if (error) setError("");
    }

    function handleUnlock() {
        if (!pin) {
            setError("Enter the 6-digit PIN.");
            return;
        }
        if (pin !== APP_LOCK_PIN) {
            setError("Incorrect PIN. Please try again.");
            setPin("");
            return;
        }
        setPin("");
        setError("");
        onUnlock?.();
    }

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <header className="safe-top flex items-center justify-between px-4 py-3">
                <BrandMark size={32} withName />
                <ThemeToggle />
            </header>

            <main className="flex flex-1 items-center justify-center px-4 pb-8">
                <div className="animate-fade-in w-full max-w-xs">
                    <div className="mb-5 text-center">
                        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <LockKeyhole className="size-5" />
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight">App Locked</h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Enter your 6-digit PIN manually to continue.
                        </p>
                    </div>

                    <PinKeypad
                        value={pin}
                        onChange={handlePinChange}
                        onSubmit={handleUnlock}
                        length={6}
                        maxLength={6}
                        error={error}
                        submitLabel="Unlock"
                    />
                </div>
            </main>
        </div>
    );
}
