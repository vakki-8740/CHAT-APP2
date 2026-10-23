import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedLayout, TabLayout } from "./components/Layouts";
import { isFirebaseConfigured } from "./config/env";
import SetupPage from "./pages/SetupPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import VoicePackPage from "./pages/VoicePackPage";
import VoiceChatPage from "./pages/VoiceChatPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
    if (!isFirebaseConfigured) {
        return (
            <ThemeProvider>
                <ToastProvider>
                    <SetupPage />
                </ToastProvider>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route element={<ProtectedLayout />}>
                                <Route element={<TabLayout />}>
                                    <Route path="/" element={<HomePage />} />
                                    <Route path="/voice" element={<VoicePackPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                </Route>
                                <Route path="/chat/:uid" element={<ChatPage />} />
                                <Route path="/voice/:uid" element={<VoiceChatPage />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
