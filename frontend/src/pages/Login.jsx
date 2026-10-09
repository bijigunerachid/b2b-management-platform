import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import { InlineAlert } from "../components/ui/primitives";

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const from = location.state?.from;
    const homeFor = (account) => {
        const isClient = account?.role === "Customer";
        const home = isClient ? "/portal" : "/";
        if (!from) return home;
        return from.startsWith("/portal") === isClient ? from : home;
    };
    const redirectTo = homeFor(user);

    if (user) {
        return <Navigate to={redirectTo} replace />;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const account = await login(email.trim(), password);
            navigate(homeFor(account), { replace: true });
        } catch (err) {
            setError(err.message || "Unable to sign in.");
        } finally {
            setSubmitting(false);
        }
    }

    function trackCapsLock(event) {
        setCapsLock(event.getModifierState?.("CapsLock") ?? false);
    }

    return (
        <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]" style={{ backgroundColor: "var(--app-bg)" }}>
            <section className="hidden flex-col justify-between p-12 text-white lg:flex" style={{ backgroundColor: "#1e3a8a" }}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                        <Icon name="box" size={20} strokeWidth={2} />
                    </div>
                    <p className="font-semibold">B2B Platform</p>
                </div>
                <div className="max-w-md">
                    <p className="text-2xl font-semibold leading-snug">Quotes, orders, invoices and stock for your wholesale business.</p>
                    <p className="mt-3 text-sm text-white/70">Clients can sign in here too, to order and see their invoices.</p>
                </div>
                <p className="text-xs text-white/50">© {new Date().getFullYear()} B2B Platform</p>
            </section>

            {/* Sign-in form */}
            <section className="relative flex items-center justify-center px-5 py-12 sm:px-8">
                <ThemeToggle className="absolute right-5 top-5" />

                <div className="w-full max-w-[400px] animate-rise">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                            style={{ backgroundColor: "var(--primary)" }}
                        >
                            <Icon name="box" size={22} strokeWidth={2} />
                        </div>
                        <p className="text-lg font-bold app-text">B2B Platform</p>
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight app-text">Sign in</h1>
                    <p className="mt-1 text-sm app-text-secondary">Use the email address your account was created with.</p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
                        <InlineAlert>{error}</InlineAlert>

                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-sm font-medium app-text">
                                Email address
                            </label>
                            <div className="relative">
                                <Icon name="mail" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 app-text-muted" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    autoComplete="email"
                                    autoFocus
                                    placeholder="you@company.com"
                                    className="app-input h-11 pl-10"
                                    aria-invalid={Boolean(error)}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-1.5 block text-sm font-medium app-text">
                                Password
                            </label>
                            <div className="relative">
                                <Icon name="lock" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 app-text-muted" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    onKeyUp={trackCapsLock}
                                    onKeyDown={trackCapsLock}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="app-input h-11 pl-10 pr-11"
                                    aria-invalid={Boolean(error)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((value) => !value)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition hover:bg-[var(--surface-hover)] app-text-muted"
                                >
                                    <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                                </button>
                            </div>
                            {capsLock && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--warning)" }}>
                                    <Icon name="alert" size={13} /> Caps Lock is on
                                </p>
                            )}
                        </div>

                        <Button type="submit" variant="primary" size="lg" loading={submitting} iconRight="arrowRight" className="w-full">
                            {submitting ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>

                    <p className="mt-6 text-xs app-text-muted">Forgot your password? Ask your administrator to reset it.</p>
                </div>
            </section>
        </main>
    );
}
