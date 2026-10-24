import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, LockKeyhole, Smartphone, UserRound } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Field } from "../components/Field";
import { PasswordInput } from "../components/PasswordInput";
import { Spinner } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import {
    getPasswordStrength,
    isValidMobile,
    validateDisplayName,
    validatePassword
} from "../utils/validation";
import { cn } from "../utils/cn";

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export default function RegisterPage() {
    const navigate = useNavigate();
    const { firebaseUser, authLoading } = useAuth();
    const [displayName, setDisplayName] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!authLoading && firebaseUser) return <Navigate to="/" replace />;

    const strength = getPasswordStrength(password);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        const nameError = validateDisplayName(displayName);
        if (nameError) {
            setError(nameError);
            return;
        }
        if (!isValidMobile(mobileNumber)) {
            setError("Enter a valid mobile number (7–15 digits).");
            return;
        }
        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        setSubmitting(true);
        try {
            await authService.register({ displayName, mobileNumber, password });
            navigate("/", { replace: true });
        } catch (nextError) {
            setError(nextError.message || "Could not create the account.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <header className="safe-top flex items-center justify-between px-4 py-3">
                <BrandMark size={32} withName />
                <ThemeToggle />
            </header>

            <main className="flex flex-1 items-center justify-center px-4 py-6">
                <div className="w-full max-w-sm">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Your name and mobile number are visible to other users so they can
                            start a chat with you.
                        </p>
                    </div>

                    <form className="panel space-y-4 p-5" onSubmit={handleSubmit} noValidate>
                        <div className="relative">
                            <UserRound className="pointer-events-none absolute left-3 top-[38px] size-4 text-muted" />
                            <Field
                                label="User name"
                                autoComplete="name"
                                placeholder="Your display name"
                                inputClassName="pl-9"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                maxLength={40}
                            />
                        </div>

                        <div className="relative">
                            <Smartphone className="pointer-events-none absolute left-3 top-[38px] size-4 text-muted" />
                            <Field
                                label="Mobile number"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                placeholder="98765 43210"
                                inputClassName="pl-9"
                                value={mobileNumber}
                                onChange={(event) => setMobileNumber(event.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3 top-[38px] size-4 text-muted" />
                            <PasswordInput
                                label="Set password"
                                autoComplete="new-password"
                                placeholder="At least 8 characters"
                                className="[&_input]:pl-9"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </div>

                        {password ? (
                            <div>
                                <div className="flex gap-1" aria-hidden="true">
                                    {[0, 1, 2, 3].map((index) => (
                                        <span
                                            key={index}
                                            className={cn(
                                                "h-1 flex-1 rounded-full transition-colors",
                                                index < strength
                                                    ? strength >= 3
                                                        ? "bg-success"
                                                        : strength === 2
                                                          ? "bg-warn"
                                                          : "bg-danger"
                                                    : "bg-line"
                                            )}
                                        />
                                    ))}
                                </div>
                                <p className="mt-1 text-2xs text-muted">
                                    {STRENGTH_LABELS[strength]} — use 8+ characters with a number.
                                </p>
                            </div>
                        ) : null}

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
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={submitting}
                        >
                            {submitting ? <Spinner className="size-4" /> : null}
                            {submitting ? "Creating account…" : "Register"}
                        </button>

                        <p className="text-center text-sm text-muted">
                            Already have an account?{" "}
                            <Link to="/login" className="font-semibold text-accent hover:underline">
                                Login
                            </Link>
                        </p>
                    </form>
                </div>
            </main>
        </div>
    );
}
