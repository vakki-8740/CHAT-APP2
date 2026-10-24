import { env } from "./env";

const STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478"
];

const turnUrls = env.call.turnUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

export const turnConfigured = Boolean(
    turnUrls.length && env.call.turnUsername && env.call.turnCredential
);

export const iceServers = [
    { urls: STUN_URLS },
    ...(turnConfigured
        ? [
              {
                  urls: turnUrls,
                  username: env.call.turnUsername,
                  credential: env.call.turnCredential
              }
          ]
        : [])
];
