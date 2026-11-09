const STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478"
];

// STUN addresses are public connection-discovery servers. TURN credentials
// are fetched at call time from the authenticated server endpoint and must
// never be embedded in Vite's public client bundle.
export const stunIceServers = [{ urls: STUN_URLS }];
