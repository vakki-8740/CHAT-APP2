import { Loader2 } from "lucide-react";
import { cn } from "../utils/cn";

export function Spinner({ className }) {
    return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
}

export function LoadingScreen({ label = "Loading…", inline = false }) {
    if (inline) {
        return (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
                <Spinner className="size-4" />
                <span>{label}</span>
            </div>
        );
    }
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <Spinner className="size-6 text-accent" />
            <p className="text-sm text-muted">{label}</p>
        </div>
    );
}

export function ListSkeleton({ rows = 6 }) {
    return (
        <div className="divide-y divide-line" aria-hidden="true">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-11 animate-pulse rounded-full bg-line/70" />
                    <div className="flex-1 space-y-2">
                        <span className="block h-3 w-1/3 animate-pulse rounded bg-line/70" />
                        <span className="block h-2.5 w-2/3 animate-pulse rounded bg-line/50" />
                    </div>
                </div>
            ))}
        </div>
    );
}
