import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { extensionForMime } from "../utils/files";
import { dataUrlToObjectUrl } from "../utils/media";

function downloadExtension(src) {
    if (typeof src !== "string" || !src.startsWith("data:")) return "jpg";
    const mime = src.slice(5).split(";")[0];
    const ext = extensionForMime(mime);
    return ext === "img" || ext === "bin" ? "jpg" : ext;
}

export function ImageLightbox({ src, onClose }) {
    const [downloadHref, setDownloadHref] = useState("");

    useEffect(() => {
        if (!src) {
            setDownloadHref("");
            return undefined;
        }
        if (/^https?:\/\//i.test(src)) {
            setDownloadHref(src);
            return undefined;
        }
        if (src.startsWith("data:image/")) {
            const objectUrl = dataUrlToObjectUrl(src);
            setDownloadHref(objectUrl || src);
            return () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            };
        }
        setDownloadHref("");
        return undefined;
    }, [src]);

    useEffect(() => {
        if (!src) return undefined;
        const onKey = (event) => {
            if (event.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [src, onClose]);

    if (!src) return null;
    const isHttp = /^https?:\/\//i.test(src);

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Photo preview"
            onMouseDown={onClose}
        >
            <div className="absolute right-3 top-3 flex gap-2">
                {downloadHref ? (
                    <a
                        href={downloadHref}
                        download={`photo.${downloadExtension(src)}`}
                        target={isHttp ? "_blank" : undefined}
                        rel={isHttp ? "noreferrer" : undefined}
                        className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label="Download image"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <Download className="size-5" />
                    </a>
                ) : null}
                <button
                    type="button"
                    onClick={onClose}
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
