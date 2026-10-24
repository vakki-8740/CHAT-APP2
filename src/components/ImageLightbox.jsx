import { useEffect } from "react";
import { Download, X } from "lucide-react";

export function ImageLightbox({ src, onClose }) {
    useEffect(() => {
        if (!src) return undefined;
        const onKey = (event) => {
            if (event.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [src, onClose]);

    if (!src) return null;
    const downloadable = /^https?:\/\//i.test(src);

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Photo preview"
            onMouseDown={onClose}
        >
            <div className="absolute right-3 top-3 flex gap-2">
                {downloadable ? (
                    <a
                        href={src}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label="Open image in a new tab"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <Download className="size-5" />
                    </a>
                ) : null}
                <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    onClick={onClose}
                    aria-label="Close photo"
                >
                    <X className="size-5" />
                </button>
            </div>
            <img
                src={src}
                alt="Shared photo preview"
                className="max-h-[85dvh] max-w-full rounded-lg object-contain"
                onMouseDown={(event) => event.stopPropagation()}
            />
        </div>
    );
}
