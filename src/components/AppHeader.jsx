import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { cn } from "../utils/cn";

export function AppHeader({
    brand = false,
    title,
    subtitle,
    backTo,
    onBack,
    actions,
    className
}) {
    return (
        <header
            className={cn(
                "safe-top sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur",
                className
            )}
        >
            <div className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                {backTo ? (
                    <Link
                        to={backTo}
                        className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft hover:text-accent"
                        aria-label="Back"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                ) : onBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft hover:text-accent"
                        aria-label="Back"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                ) : brand ? (
                    <BrandMark size={34} withName subtitle={subtitle} />
                ) : null}

                {!brand && (title || subtitle) ? (
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-[15px] font-bold leading-tight">{title}</h1>
                        {subtitle ? (
                            <p className="truncate text-2xs text-muted">{subtitle}</p>
                        ) : null}
                    </div>
                ) : (
                    <span className="flex-1" />
                )}

                {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
            </div>
        </header>
    );
}
