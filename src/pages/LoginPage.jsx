import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, LockKeyhole, Smartphone } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Field } from "../components/Field";
import { PasswordInput } from "../components/PasswordInput";
import { Spinner } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { isValidMobile } from "../utils/validation";

export default function LoginPage() {
    const navigate = useNavigate();
    const { firebaseUser, authLoading } = useAuth();
    const [mobileNumber, setMobileNumber] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!authLoading && firebaseUser) return <Navigate to="/" replace />;

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!isValidMobile(mobileNumber)) {
            setError("Enter a valid mobile number (7–15 digits).");
            return;
        }
        if (!password) {
            setError("Enter your password.");
            return;
        }

        setSubmitting(true);
        try {
            await authService.login({ mobileNumber, password });
            navigate("/", { replace: true });
        } catch (nextError) {
            setError(nextError.message || "Could not sign in.");
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

            <main className="flex flex-1 items-center justify-center px-4 pb-10">
                <div className="w-full max-w-sm">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            Sign in with your mobile number and password to continue.
                        </p>
                    </div>

                    <form className="panel space-y-4 p-5" onSubmit={handleSubmit} noValidate>
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
                                label="Password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                className="[&_input]:pl-9"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
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
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={submitting}
                        >
                            {submitting ? <Spinner className="size-4" /> : null}
                            {submitting ? "Signing in…" : "Login"}
                        </button>

                        <p className="text-center text-sm text-muted">
                            New here?{" "}
                            <Link
                                to="/register"
                                className="font-semibold text-accent hover:underline"
                            >
                                Create an account
                            </Link>
                        </p>
                    </form>

                    <p className="mt-4 px-2 text-center text-2xs leading-relaxed text-muted">
                        Passwords are hashed and stored by Firebase Authentication. They are never
                        saved in the database.
                    </p>
                </div>
            </main>
        </div>
    );
}
