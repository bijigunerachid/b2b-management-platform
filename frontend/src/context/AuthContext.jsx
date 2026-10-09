
import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

const AuthContext = createContext(null);

const API_URL = "http://localhost:5000/api";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadUser() {
            try {
                const response = await fetch(
                    `${API_URL}/auth/me`,
                    { credentials: "include" }
                );

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

    async function login(email, password) {
        const response = await fetch(
            `${API_URL}/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ email, password })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Login failed"
            );
        }

        setUser(result.data ?? result.user ?? null);
    }

    async function logout() {
        const response = await fetch(
            `${API_URL}/auth/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Logout failed");
        }

        setUser(null);
    }

    return (
        <AuthContext.Provider
            value={{ user, loading, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}