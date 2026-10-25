import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../utils/cn";

const MASK_CHAR = "•";

export function decodeMaskedPinInput(prevPin, rawValue, selectionStart, visible, maxLength = 6) {
    const cleanPrev = String(prevPin || "").replace(/\D/g, "").slice(0, maxLength);
    const raw = String(rawValue || "");

    if (visible) {
        const digits = raw.replace(/\D/g, "").slice(0, maxLength);
        const caret =
            typeof selectionStart === "number"
                ? Math.min(digits.length, raw.slice(0, selectionStart).replace(/\D/g, "").length)
                : digits.length;
        return { nextPin: digits, nextCaret: caret };
    }

    if (!raw) {
        return { nextPin: "", nextCaret: 0 };
    }

    // Pure bullets remain -> user deleted characters (Backspace / Delete / Cut) or moved caret
    let allBullets = true;
    for (let i = 0; i < raw.length; i += 1) {
        if (raw[i] !== MASK_CHAR) {
            allBullets = false;
            break;
        }
    }

    if (allBullets) {
        if (raw.length >= cleanPrev.length) {
            return { nextPin: cleanPrev, nextCaret: cleanPrev.length };
        }
        const removedCount = cleanPrev.length - raw.length;
        const cutIndex =
            typeof selectionStart === "number"
                ? Math.min(Math.max(0, selectionStart), raw.length)
                : raw.length;
        const nextPin = (
            cleanPrev.slice(0, cutIndex) + cleanPrev.slice(cutIndex + removedCount)
        ).slice(0, maxLength);
        return { nextPin, nextCaret: Math.min(cutIndex, nextPin.length) };
    }

    // Count preserved leading & trailing bullets around newly typed/pasted characters
    let prefixDots = 0;
    while (prefixDots < raw.length && raw[prefixDots] === MASK_CHAR) {
        prefixDots += 1;
    }

    let suffixDots = 0;
    while (
        suffixDots < raw.length - prefixDots &&
        raw[raw.length - 1 - suffixDots] === MASK_CHAR
    ) {
        suffixDots += 1;
    }

    const clampedPrefix = Math.min(prefixDots, cleanPrev.length);
    const clampedSuffix = Math.min(suffixDots, Math.max(0, cleanPrev.length - clampedPrefix));
    const insertedMiddle = raw
        .slice(prefixDots, raw.length - suffixDots)
        .replace(/\D/g, "");

    const availableRoom = Math.max(0, maxLength - clampedPrefix - clampedSuffix);
    const acceptedInsert = insertedMiddle.slice(0, availableRoom);

    const nextPin = (
        cleanPrev.slice(0, clampedPrefix) +
        acceptedInsert +
        cleanPrev.slice(cleanPrev.length - clampedSuffix)
    ).slice(0, maxLength);

    return {
        nextPin,
        nextCaret: Math.min(clampedPrefix + acceptedInsert.length, nextPin.length)
    };
}

export const PinInputField = forwardRef(function PinInputField(
    {
        label,
        error,
        hint,
        className,
        value = "",
        onChange,
        onEnter,
        maxLength = 6,
        disabled = false,
        placeholder,
        autoFocus = false
    },
    forwardedRef
) {
    const id = useId();
    const safeToken = id.replace(/[^a-zA-Z0-9]/g, "");
    const [visible, setVisible] = useState(false);
    const innerRef = useRef(null);
    const desiredCaretRef = useRef(null);

    function setRefs(node) {
        innerRef.current = node;
        if (typeof forwardedRef === "function") {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    }

    const cleanValue = String(value || "").replace(/\D/g, "").slice(0, maxLength);
    const displayValue = visible ? cleanValue : MASK_CHAR.repeat(cleanValue.length);

    useLayoutEffect(() => {
        const el = innerRef.current;
        const caret = desiredCaretRef.current;
        if (!el || caret === null) return;
        desiredCaretRef.current = null;
        if (document.activeElement === el) {
            try {
                el.setSelectionRange(caret, caret);
            } catch {
                // Ignore selection errors on unsupported engines
            }
        }
    });

    function handleInputChange(event) {
        const { nextPin, nextCaret } = decodeMaskedPinInput(
            cleanValue,
            event.target.value,
            event.target.selectionStart,
            visible,
            maxLength
        );
        desiredCaretRef.current = nextCaret;
        onChange?.(nextPin);
    }

    function handlePaste(event) {
        const pasted = event.clipboardData?.getData("text") || "";
        const pastedDigits = pasted.replace(/\D/g, "");
        event.preventDefault();
        if (!pastedDigits) return;

        const el = innerRef.current;
        const start = typeof el?.selectionStart === "number" ? el.selectionStart : cleanValue.length;
        const end = typeof el?.selectionEnd === "number" ? el.selectionEnd : start;
        const room = Math.max(0, maxLength - (cleanValue.length - (end - start)));
        const accepted = pastedDigits.slice(0, room);
        const nextPin = (cleanValue.slice(0, start) + accepted + cleanValue.slice(end)).slice(
            0,
            maxLength
        );
        desiredCaretRef.current = Math.min(start + accepted.length, nextPin.length);
        onChange?.(nextPin);
    }

    function handleKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            if (!disabled) {
                onEnter?.();
            }
        }
    }

    return (
        <div className={cn("w-full", className)}>
            {label ? (
                <label htmlFor={id} className="field-label">
                    {label}
                </label>
            ) : null}
            <div className="relative">
                <input
                    ref={setRefs}
                    id={id}
                    name={`pin_code_${safeToken}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="go"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="input pr-11"
                    aria-invalid={error ? "true" : undefined}
                    value={displayValue}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                />
                <button
                    type="button"
                    onClick={() => setVisible((prev) => !prev)}
                    className="absolute right-1 top-1 flex size-9 items-center justify-center rounded text-muted hover:text-accent"
                    aria-label={visible ? "Hide PIN" : "Show PIN"}
                    aria-pressed={visible}
                    tabIndex={-1}
                >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </div>
            {error ? <p className="field-error mt-1">{error}</p> : null}
            {!error && hint ? <p className="mt-1 text-2xs text-muted">{hint}</p> : null}
        </div>
    );
});
