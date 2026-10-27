import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CallProvider } from "./context/CallContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { CallOverlay } from "./components/CallOverlay";
import { OpeningAnimation } from "./components/OpeningAnimation";
import { ProtectedLayout, TabLayout } from "./components/Layouts";
import { isFirebaseConfigured, isStorageConfigured } from "./config/env";
import LockPage from "./pages/LockPage";
import SetupPage from "./pages/SetupPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import VoicePackPage from "./pages/VoicePackPage";
import VoiceChatPage from "./pages/VoiceChatPage";
import VideoPackPage from "./pages/VideoPackPage";
import VideoChatPage from "./pages/VideoChatPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
    const [unlocked, setUnlocked] = useState(false);
    const [showOpeningAnimation, setShowOpeningAnimation] = useState(false);

    useEffect(() => {
        function handlePageShow(event) {
            if (event.persisted) {
                setUnlocked(false);
                setShowOpeningAnimation(false);
            }
        }
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

    function handleUnlock() {
        setUnlocked(true);
        setShowOpeningAnimation(true);
    }

    return (
        <ThemeProvider>
            <ToastProvider>
                {!unlocked ? (
                    <LockPage onUnlock={handleUnlock} />
                ) : !isFirebaseConfigured ? (
                    <SetupPage />
                ) : (
                    <AuthProvider>
                        <CallProvider>
                            <BrowserRouter>
                                <Routes>
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/register" element={<RegisterPage />} />
                                    <Route element={<ProtectedLayout />}>
                                        <Route element={<TabLayout />}>
                                            <Route path="/" element={<HomePage />} />
                                            {isStorageConfigured ? (
                                                <>
                                                    <Route
                                                        path="/voice"
                                                        element={<VoicePackPage />}
                                                    />
                                                    <Route
                                                        path="/video"
                                                        element={<VideoPackPage />}
                                                    />
                                                </>
                                            ) : null}
                                            <Route path="/profile" element={<ProfilePage />} />
                                        </Route>
                                        <Route path="/chat/:uid" element={<ChatPage />} />
                                        {isStorageConfigured ? (
                                            <>
                                                <Route
                                                    path="/voice/:uid"
                                                    element={<VoiceChatPage />}
                                                />
                                                <Route
                                                    path="/video/:uid"
                                                    element={<VideoChatPage />}
                                                />
                                            </>
                                        ) : null}
                                    </Route>
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </BrowserRouter>
                            <CallOverlay />
                        </CallProvider>
                    </AuthProvider>
                )}
                {showOpeningAnimation ? (
                    <OpeningAnimation onComplete={() => setShowOpeningAnimation(false)} />
                ) : null}
            </ToastProvider>
        </ThemeProvider>
    );
}
