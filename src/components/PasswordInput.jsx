import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../utils/cn";

export function PasswordInput({ label, error, hint, className, ...props }) {
    const id = useId();
    const [visible, setVisible] = useState(false);

    return (
        <div className={cn("w-full", className)}>
            {label ? (
                <label htmlFor={id} className="field-label">
                    {label}
                </label>
            ) : null}
            <div className="relative">
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    className="input pr-11"
                    aria-invalid={error ? "true" : undefined}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setVisible((value) => !value)}
                    className="absolute right-1 top-1 flex size-9 items-center justify-center rounded text-muted hover:text-accent"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </div>
            {error ? <p className="field-error mt-1">{error}</p> : null}
            {!error && hint ? <p className="mt-1 text-2xs text-muted">{hint}</p> : null}
        </div>
    );
}
