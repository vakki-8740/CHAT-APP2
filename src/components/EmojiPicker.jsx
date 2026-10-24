import { EMOJI_PALETTE } from "../utils/emoji";

export function EmojiPicker({ onPick, onClose }) {
    return (
        <div
            className="animate-fade-in absolute bottom-full left-0 mb-2 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-line bg-card p-2 shadow-card"
            role="dialog"
            aria-label="Choose an emoji"
        >
            <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto scrollbar-thin">
                {EMOJI_PALETTE.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                            onPick(emoji);
                            onClose?.();
                        }}
                        className="flex aspect-square items-center justify-center rounded text-xl hover:bg-bg"
                        aria-label={`Insert ${emoji}`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
