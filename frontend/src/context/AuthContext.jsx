import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";
import { API_URL } from "../lib/api";
import { useToast } from "../components/ui/feedback";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const userRef = useRef(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        async function loadUser() {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    credentials: "include"
                });

                if (response.ok) {
                    const result = await response.json();
                    setUser(result.data ?? result.user ?? null);
                }
            } catch (error) {
                console.error("Unable to load user:", error);
            } finally {
                setLoading(false);
            }
        }

        loadUser();
    }, []);

    // Sign out locally when the server reports the session has ended.
    useEffect(() => {
        function handleExpired(event) {
            if (!userRef.current) return;

            userRef.current = null;
            setUser(null);
            toast.warning(event.detail || "Please sign in again.", {
                title: "Session ended"
            });
        }

        window.addEventListener("auth:expired", handleExpired);
        return () => window.removeEventListener("auth:expired", handleExpired);
    }, [toast]);

    const login = useCallback(async (email, password) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || "Login failed");
        }

        setUser(result.data ?? result.user ?? null);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: "POST",
                credentials: "include"
            });
        } finally {
            // Clear local state even if the network call failed; the
            // server-side session is revoked whenever the request lands.
            setUser(null);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
