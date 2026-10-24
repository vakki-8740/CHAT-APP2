import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { initialsFrom } from "../utils/format";

const GRADIENTS = [
    "from-[#4f6bed] to-[#8b5cf6]",
    "from-[#22a06b] to-[#0ea5e9]",
    "from-[#e5484d] to-[#f0b543]",
    "from-[#0ea5e9] to-[#4f6bed]",
    "from-[#db2777] to-[#f97316]",
    "from-[#7c3aed] to-[#ec4899]"
];

const SIZES = {
    xs: "size-7 text-[10px]",
    sm: "size-9 text-[11px]",
    md: "size-11 text-sm",
    lg: "size-16 text-lg",
    xl: "size-24 text-2xl"
};

function gradientFor(seed) {
    const value = String(seed || "");
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 997;
    }
    return GRADIENTS[hash % GRADIENTS.length];
}

export function Avatar({ name, src, uid, size = "md", online = false, className }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [src]);

    const showImage = Boolean(src) && !failed;

    return (
        <span className={cn("relative inline-flex shrink-0", className)}>
            <span
                className={cn(
                    "flex items-center justify-center overflow-hidden rounded-full font-bold text-white select-none",
                    SIZES[size] || SIZES.md,
                    showImage
                        ? "bg-card"
                        : cn("bg-gradient-to-br", gradientFor(uid || name))
                )}
                aria-hidden="true"
            >
                {showImage ? (
                    <img
                        src={src}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    initialsFrom(name)
                )}
            </span>
            {online ? (
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" />
            ) : null}
        </span>
    );
}
