import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { callService } from "../services/callService";
import { iceServers } from "../config/call";
import { toDate } from "../utils/format";

const CallContext = createContext(null);
const RING_TIMEOUT_MS = 45000;
const CONNECT_TIMEOUT_MS = 30000;

const TERMINAL_STATUSES = [
    "declined",
    "missed",
    "cancelled",
    "ended",
    "failed",
    "busy"
];

const STATUS_MESSAGES = {
    declined: "Call declined.",
    missed: "No answer.",
    cancelled: "Call cancelled.",
    ended: "Call ended.",
    failed: "Call could not connect.",
    busy: "The other person is on another call."
};

function mediaConstraints(type) {
    return {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video:
            type === "video"
                ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
                : false
    };
}

function mediaErrorMessage(error) {
    if (error?.name === "NotAllowedError") {
        return "Camera or microphone permission was denied.";
    }
    if (error?.name === "NotFoundError") {
        return "No camera or microphone was found.";
    }
    if (error?.name === "NotReadableError") {
        return "The camera or microphone is being used by another app.";
    }
    return "Could not access the camera or microphone.";
}

export function CallProvider({ children }) {
    const { uid, profile } = useAuth();
    const toast = useToast();

    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [acceptingCall, setAcceptingCall] = useState(false);

    const sessionRef = useRef(null);
    const incomingRef = useRef(null);
    const incomingTimerRef = useRef(null);
    const startingRef = useRef(false);
    const acceptingRef = useRef(false);

    function patchActive(session, patch) {
        if (sessionRef.current !== session || session.closed) return;
        setActiveCall((current) => (current ? { ...current, ...patch } : current));
    }

    function clearIncoming() {
        window.clearTimeout(incomingTimerRef.current);
        incomingTimerRef.current = null;
        incomingRef.current = null;
        setIncomingCall(null);
    }

    function disposeSession(session, { updateState = true } = {}) {
        if (!session || session.closed) return;
        session.closed = true;
        window.clearTimeout(session.ringTimer);
        window.clearTimeout(session.connectTimer);
        session.unsubCall?.();
        session.unsubRemoteCandidates?.();
        try {
            session.pc?.close();
        } catch {
            /* already closed */
        }
        session.localStream?.getTracks().forEach((track) => track.stop());
        if (sessionRef.current === session) sessionRef.current = null;
        if (updateState) setActiveCall(null);
    }

    async function flushCandidates(session) {
        if (!session.pc.remoteDescription) return;
        while (session.pendingCandidates.length) {
            const item = session.pendingCandidates.shift();
            try {
                await session.pc.addIceCandidate(
                    new RTCIceCandidate({
                        candidate: item.candidate,
                        sdpMid: item.sdpMid || null,
                        sdpMLineIndex: item.sdpMLineIndex,
                        usernameFragment: item.usernameFragment || undefined
                    })
                );
            } catch (error) {
                console.warn("Could not apply an ICE candidate.", error);
            }
        }
    }

    function handleCandidates(session, candidates) {
        for (const item of candidates) {
            if (session.seenCandidates.has(item.id)) continue;
            session.seenCandidates.add(item.id);
            if (session.pc.remoteDescription) {
                session.pc
                    .addIceCandidate(
                        new RTCIceCandidate({
                            candidate: item.candidate,
                            sdpMid: item.sdpMid || null,
                            sdpMLineIndex: item.sdpMLineIndex,
                            usernameFragment: item.usernameFragment || undefined
                        })
                    )
                    .catch((error) =>
                        console.warn("Could not apply an ICE candidate.", error)
                    );
            } else {
                session.pendingCandidates.push(item);
            }
        }
    }

    function attachPeer(session) {
        const { pc, localStream } = session;

        pc.onicecandidate = (event) => {
            if (!event.candidate || session.closed) return;
            const candidate = event.candidate.toJSON();
            if (!session.signalingReady) {
                session.localCandidates.push(candidate);
                return;
            }
            callService
                .addCandidate(session.callId, session.role, candidate)
                .catch(() => {});
        };

        pc.ontrack = (event) => {
            if (!session.remoteStream) {
                session.remoteStream = event.streams[0] || new MediaStream();
            }
            if (!event.streams[0] && !session.remoteStream.getTracks().includes(event.track)) {
                session.remoteStream.addTrack(event.track);
            }
            patchActive(session, { remoteStream: session.remoteStream });
        };

        pc.onconnectionstatechange = () => {
            if (session.closed) return;
            if (pc.connectionState === "connected") {
                window.clearTimeout(session.connectTimer);
                session.status = "connected";
                session.connectedAt = session.connectedAt || Date.now();
                patchActive(session, {
                    status: "connected",
                    connectedAt: session.connectedAt
                });
            } else if (pc.connectionState === "disconnected") {
                session.status = "reconnecting";
                patchActive(session, { status: "reconnecting" });
            } else if (pc.connectionState === "failed") {
                session.status = "failed";
                toast.error("The call connection failed.");
                disposeSession(session);
                callService
                    .finishCall(session.callId, "failed", uid)
                    .catch(() => {});
            }
        };

        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    function startConnectTimer(session) {
        window.clearTimeout(session.connectTimer);
        session.connectTimer = window.setTimeout(() => {
            if (session.closed || session.status === "connected") return;
            toast.error("The call took too long to connect.");
            disposeSession(session);
            callService.finishCall(session.callId, "failed", uid).catch(() => {});
        }, CONNECT_TIMEOUT_MS);
    }

    async function handleCallDoc(session, call) {
        if (!call || session.closed || sessionRef.current !== session) return;

        if (
            session.role === "caller" &&
            call.answer &&
            !session.answerApplied
        ) {
            session.answerApplied = true;
            try {
                await session.pc.setRemoteDescription(
                    new RTCSessionDescription(call.answer)
                );
                await flushCandidates(session);
                startConnectTimer(session);
            } catch (error) {
                console.warn("Could not apply the call answer.", error);
                toast.error("The call could not be connected.");
                disposeSession(session);
                callService.finishCall(session.callId, "failed", uid).catch(() => {});
                return;
            }
        }

        if (call.status === "accepted" && session.status === "ringing") {
            session.status = "connecting";
            window.clearTimeout(session.ringTimer);
            patchActive(session, { status: "connecting" });
        }

        if (TERMINAL_STATUSES.includes(call.status)) {
            const message =
                call.status === "cancelled" && session.role === "callee"
                    ? "The caller cancelled."
                    : STATUS_MESSAGES[call.status] || "Call ended.";
            toast.info(message);
            disposeSession(session);
        }
    }

    async function startCall(peer, type) {
        if (!uid || !peer?.uid || startingRef.current) return false;
        if (sessionRef.current || incomingRef.current) {
            toast.info("Finish the current call first.");
            return false;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            toast.error("Calling is not supported in this browser.");
            return false;
        }

        startingRef.current = true;
        let localStream;
        try {
            localStream = await navigator.mediaDevices.getUserMedia(
                mediaConstraints(type)
            );
        } catch (error) {
            startingRef.current = false;
            toast.error(mediaErrorMessage(error));
            return false;
        }

        let callId;
        try {
            callId = callService.newCallId();
        } catch (error) {
            localStream.getTracks().forEach((track) => track.stop());
            startingRef.current = false;
            toast.error(error.message);
            return false;
        }

        const pc = new RTCPeerConnection({ iceServers });
        const session = {
            callId,
            role: "caller",
            type,
            peer: {
                uid: peer.uid,
                name: peer.displayName || "User",
                photoURL: peer.photoURL || ""
            },
            pc,
            localStream,
            remoteStream: null,
            pendingCandidates: [],
            localCandidates: [],
            seenCandidates: new Set(),
            signalingReady: false,
            facingMode: "user",
            status: "ringing",
            connectedAt: null,
            muted: false,
            cameraOff: false,
            closed: false,
            answerApplied: false
        };
        sessionRef.current = session;

        setActiveCall({
            callId,
            role: "caller",
            type,
            peer: session.peer,
            status: "ringing",
            localStream,
            remoteStream: null,
            connectedAt: null,
            muted: false,
            cameraOff: false,
            facingMode: "user"
        });

        try {
            attachPeer(session);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await callService.createCall({
                callId,
                callerId: uid,
                calleeId: peer.uid,
                type,
                offer: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp
                },
                callerName: profile?.displayName || "User",
                callerPhotoURL: profile?.photoURL || ""
            });
            session.signalingReady = true;
            for (const candidate of session.localCandidates) {
                callService.addCandidate(callId, "caller", candidate).catch(() => {});
            }
            session.localCandidates = [];
        } catch (error) {
            disposeSession(session);
            startingRef.current = false;
            toast.error(error.message || "Could not start the call.");
            return false;
        }

        session.unsubCall = callService.subscribeCall(
            callId,
            (call) => {
                handleCallDoc(session, call).catch(() => {});
            },
            (error) => {
                toast.error(error.message);
                disposeSession(session);
            }
        );

        session.unsubRemoteCandidates = callService.subscribeCandidates(
            callId,
            "callee",
            (candidates) => handleCandidates(session, candidates),
            () => {}
        );

        session.ringTimer = window.setTimeout(() => {
            if (session.closed || session.status !== "ringing") return;
            toast.info("No answer.");
            disposeSession(session);
            callService.finishCall(callId, "missed", uid).catch(() => {});
        }, RING_TIMEOUT_MS);

        startingRef.current = false;
        return true;
    }

    async function acceptCall(call) {
        const target = call || incomingRef.current;
        if (!target || !uid || sessionRef.current || acceptingRef.current) return false;
        if (!navigator.mediaDevices?.getUserMedia) {
            toast.error("Calling is not supported in this browser.");
            return false;
        }

        acceptingRef.current = true;
        setAcceptingCall(true);
        let localStream;
        try {
            localStream = await navigator.mediaDevices.getUserMedia(
                mediaConstraints(target.type)
            );
        } catch (error) {
            toast.error(mediaErrorMessage(error));
            await declineCall(target, "declined", { silent: true });
            acceptingRef.current = false;
            setAcceptingCall(false);
            return false;
        }

        const pc = new RTCPeerConnection({ iceServers });
        const session = {
            callId: target.id,
            role: "callee",
            type: target.type,
            peer: {
                uid: target.callerId,
                name: target.callerName || "User",
                photoURL: target.callerPhotoURL || ""
            },
            pc,
            localStream,
            remoteStream: null,
            pendingCandidates: [],
            localCandidates: [],
            seenCandidates: new Set(),
            signalingReady: true,
            facingMode: "user",
            status: "connecting",
            connectedAt: null,
            muted: false,
            cameraOff: false,
            closed: false,
            answerApplied: false
        };
        sessionRef.current = session;
        clearIncoming();

        setActiveCall({
            callId: target.id,
            role: "callee",
            type: target.type,
            peer: session.peer,
            status: "connecting",
            localStream,
            remoteStream: null,
            connectedAt: null,
            muted: false,
            cameraOff: false,
            facingMode: "user"
        });

        try {
            attachPeer(session);
            await pc.setRemoteDescription(new RTCSessionDescription(target.offer));
            await flushCandidates(session);

            session.unsubRemoteCandidates = callService.subscribeCandidates(
                target.id,
                "caller",
                (candidates) => handleCandidates(session, candidates),
                () => {}
            );

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await callService.updateCall(target.id, {
                status: "accepted",
                answer: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp
                }
            });
            startConnectTimer(session);
        } catch (error) {
            console.warn("Could not accept the call.", error);
            disposeSession(session);
            toast.error("Could not accept the call.");
            callService.finishCall(target.id, "declined", uid).catch(() => {});
            acceptingRef.current = false;
            setAcceptingCall(false);
            return false;
        }

        session.unsubCall = callService.subscribeCall(
            target.id,
            (nextCall) => {
                handleCallDoc(session, nextCall).catch(() => {});
            },
            (error) => {
                toast.error(error.message);
                disposeSession(session);
            }
        );

        acceptingRef.current = false;
        setAcceptingCall(false);
        return true;
    }

    async function declineCall(call, status = "declined", { silent = false } = {}) {
        const target = call || incomingRef.current;
        if (!target) return;
        if (incomingRef.current?.id === target.id) clearIncoming();
        try {
            await callService.finishCall(target.id, status, uid);
        } catch (error) {
            if (!silent) toast.error(error.message);
        }
    }

    async function endCall() {
        const session = sessionRef.current;
        if (!session) return;
        const status =
            session.role === "caller" && session.status === "ringing"
                ? "cancelled"
                : "ended";
        disposeSession(session);
        callService.finishCall(session.callId, status, uid).catch(() => {});
    }

    function toggleMute() {
        const session = sessionRef.current;
        if (!session) return;
        const track = session.localStream.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        session.muted = !track.enabled;
        patchActive(session, { muted: session.muted });
    }

    function toggleCamera() {
        const session = sessionRef.current;
        if (!session || session.type !== "video") return;
        const track = session.localStream.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        session.cameraOff = !track.enabled;
        patchActive(session, { cameraOff: session.cameraOff });
    }

    async function switchCamera() {
        const session = sessionRef.current;
        if (!session || session.type !== "video" || session.closed) return;
        const nextFacing = session.facingMode === "user" ? "environment" : "user";
        try {
            const nextStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: nextFacing } }
            });
            const nextTrack = nextStream.getVideoTracks()[0];
            if (!nextTrack) return;

            const sender = session.pc
                .getSenders()
                .find((item) => item.track?.kind === "video");
            if (sender) await sender.replaceTrack(nextTrack);

            const oldTrack = session.localStream.getVideoTracks()[0];
            if (oldTrack) {
                session.localStream.removeTrack(oldTrack);
                oldTrack.stop();
            }
            nextTrack.enabled = !session.cameraOff;
            session.localStream.addTrack(nextTrack);
            session.facingMode = nextFacing;

            const nextLocalStream = new MediaStream(session.localStream.getTracks());
            session.localStream = nextLocalStream;
            patchActive(session, {
                localStream: nextLocalStream,
                facingMode: nextFacing
            });
        } catch (error) {
            toast.error(mediaErrorMessage(error));
        }
    }

    useEffect(() => {
        if (!uid) return undefined;

        const unsubscribe = callService.subscribeIncoming(
            uid,
            (calls) => {
                if (sessionRef.current) return;
                const live = calls
                    .filter((call) => {
                        const created = toDate(call.createdAt);
                        return (
                            call.callerId !== uid &&
                            (!created || Date.now() - created.getTime() < 60000)
                        );
                    })
                    .sort((a, b) => {
                        const left = toDate(a.createdAt)?.getTime() || 0;
                        const right = toDate(b.createdAt)?.getTime() || 0;
                        return right - left;
                    });

                if (!live.length) {
                    if (incomingRef.current) clearIncoming();
                    return;
                }
                if (incomingRef.current) return;

                const next = live[0];
                incomingRef.current = next;
                setIncomingCall(next);
                navigator.vibrate?.([200, 100, 200]);
                incomingTimerRef.current = window.setTimeout(() => {
                    if (incomingRef.current?.id === next.id) {
                        declineCall(next, "missed", { silent: true });
                    }
                }, RING_TIMEOUT_MS + 10000);
            },
            (error) => console.warn(error.message)
        );

        return unsubscribe;
    }, [uid]);

    useEffect(() => {
        if (uid) return;
        const session = sessionRef.current;
        if (session) disposeSession(session);
        clearIncoming();
    }, [uid]);

    useEffect(
        () => () => {
            const session = sessionRef.current;
            if (session) disposeSession(session, { updateState: false });
            window.clearTimeout(incomingTimerRef.current);
        },
        []
    );

    const value = {
        incomingCall,
        activeCall,
        acceptingCall,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleCamera,
        switchCamera
    };

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
    const context = useContext(CallContext);
    if (!context) throw new Error("useCall must be used inside CallProvider");
    return context;
}
