import { MessageCircle } from "lucide-react";
import { cn } from "../utils/cn";
import { branding } from "../config/app";

export function BrandMark({ size = 32, className, withName = false, subtitle = "" }) {
    return (
        <span className={cn("inline-flex items-center gap-2.5", className)}>
            <span
                className="flex items-center justify-center rounded-[8px] bg-accent text-white shadow-sm"
                style={{ width: size, height: size }}
                aria-hidden="true"
            >
                {branding.logoUrl ? (
                    <img
                        src={branding.logoUrl}
                        alt=""
                        className="size-full rounded-[8px] object-cover"
                    />
                ) : (
                    <MessageCircle style={{ width: size * 0.52, height: size * 0.52 }} />
                )}
            </span>
            {withName ? (
                <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold leading-tight">
                        {branding.name}
                    </span>
                    {subtitle ? (
                        <span className="block truncate text-2xs font-medium text-muted">
                            {subtitle}
                        </span>
                    ) : null}
                </span>
            ) : null}
        </span>
    );
}
