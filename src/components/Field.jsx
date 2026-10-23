import { useId } from "react";
import { cn } from "../utils/cn";

export function Field({
    label,
    error,
    hint,
    className,
    inputClassName,
    as = "input",
    ...props
}) {
    const id = useId();
    const Element = as === "textarea" ? "textarea" : "input";

    return (
        <div className={cn("w-full", className)}>
            {label ? (
                <label htmlFor={id} className="field-label">
                    {label}
                </label>
            ) : null}
            <Element
                id={id}
                className={cn(as === "textarea" ? "input textarea" : "input", inputClassName)}
                aria-invalid={error ? "true" : undefined}
                {...props}
            />
            {error ? <p className="field-error mt-1">{error}</p> : null}
            {!error && hint ? <p className="mt-1 text-2xs text-muted">{hint}</p> : null}
        </div>
    );
}
