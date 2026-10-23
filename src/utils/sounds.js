const SOURCES = {
    messageReceived: "/sounds/message-received.m4a",
    voiceReceived: "/sounds/voice-pack-received.mp3",
    messageSent: "/sounds/message-sent.mp3"
};

const POOL_SIZE = 4;
const pools = new Map();
let unlockInstalled = false;
let unlocked = false;

function createPool(name) {
    const list = Array.from({ length: POOL_SIZE }, () => {
        const audio = new Audio(SOURCES[name]);
        audio.preload = "auto";
        audio.volume = 0.9;
        audio.load();
        return audio;
    });
    const pool = { list, next: 0 };
    pools.set(name, pool);
    return pool;
}

function getPool(name) {
    return pools.get(name) || createPool(name);
}

export function preloadSounds() {
    if (typeof window === "undefined") return;
    for (const name of Object.keys(SOURCES)) getPool(name);
}

export function playSound(name) {
    if (typeof window === "undefined" || !SOURCES[name]) return;
    const pool = getPool(name);
    let audio = pool.list.find((item) => item.paused || item.ended);
    if (!audio) {
        audio = pool.list[pool.next % POOL_SIZE];
        pool.next += 1;
        audio.pause();
    }
    try {
        audio.currentTime = 0;
        const result = audio.play();
        if (result?.catch) result.catch(() => {});
    } catch {}
}

function unlock() {
    if (unlocked) return;
    let attempts = 0;
    let finished = 0;
    const done = () => {
        finished += 1;
        if (finished >= attempts) unlocked = true;
    };
    for (const name of Object.keys(SOURCES)) {
        const audio = getPool(name).list[0];
        const volume = audio.volume;
        audio.volume = 0;
        attempts += 1;
        let result;
        try {
            audio.currentTime = 0;
            result = audio.play();
        } catch {
            audio.volume = volume;
            done();
            continue;
        }
        if (!result?.then) {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = volume;
            done();
            continue;
        }
        result
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = volume;
                done();
            })
            .catch(() => {
                audio.volume = volume;
                done();
            });
    }
}

export function installSoundUnlock() {
    if (unlocked || unlockInstalled || typeof window === "undefined") return;
    unlockInstalled = true;
    const events = ["pointerdown", "touchstart", "keydown"];
    const handler = () => {
        for (const event of events) {
            window.removeEventListener(event, handler, true);
        }
        unlockInstalled = false;
        unlock();
    };
    for (const event of events) {
        window.addEventListener(event, handler, { capture: true, passive: true });
    }
}
