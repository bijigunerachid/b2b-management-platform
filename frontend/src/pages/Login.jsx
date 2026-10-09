import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import { InlineAlert } from "../components/ui/primitives";

const highlights = [
    { icon: "customers", title: "Customer directory", text: "Every account, contact, and order history in one place." },
    { icon: "products", title: "Live inventory", text: "Stock alerts before you run out, not after." },
    { icon: "revenue", title: "Revenue insights", text: "Track monthly performance and top-selling products." },
];

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

    const redirectTo = location.state?.from || "/";

    if (user) {
        return <Navigate to={redirectTo} replace />;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            await login(email.trim(), password);
            navigate(redirectTo, { replace: true });
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
            {/* Brand panel */}
            <section
                className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
                style={{ background: "linear-gradient(145deg, #1e3a8a 0%, #2563eb 48%, #7c3aed 100%)" }}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                        maskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%)",
                    }}
                />
                <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />

                <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                        <Icon name="box" size={22} strokeWidth={2} />
                    </div>
                    <div>
                        <p className="font-bold">B2B Platform</p>
                        <p className="text-xs text-white/70">Business Management</p>
                    </div>
                </div>

                <div className="relative max-w-lg">
                    <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                        Run your wholesale business from one workspace.
                    </h2>
                    <p className="mt-4 text-base leading-7 text-white/75">
                        Customers, catalog, orders, and your team — organized, secure, and always up to date.
                    </p>

                    <div className="stagger mt-10 space-y-3">
                        {highlights.map((item) => (
                            <div
                                key={item.title}
                                className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                                    <Icon name={item.icon} size={19} />
                                </div>
                                <div>
                                    <p className="font-semibold">{item.title}</p>
                                    <p className="mt-0.5 text-sm text-white/70">{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative text-xs text-white/60">
                    © {new Date().getFullYear()} B2B Management Platform
                </p>
            </section>

            {/* Sign-in form */}
            <section className="relative flex items-center justify-center px-5 py-12 sm:px-8">
                <ThemeToggle className="absolute right-5 top-5" />

                <div className="w-full max-w-[400px] animate-rise">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                            style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
                        >
                            <Icon name="box" size={22} strokeWidth={2} />
                        </div>
                        <p className="text-lg font-bold app-text">B2B Platform</p>
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight app-text">Welcome back</h1>
                    <p className="mt-2 text-sm app-text-secondary">Sign in to your account to continue.</p>

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
                            {submitting ? "Signing in…" : "Sign in"}
                        </Button>
                    </form>

                    <div
                        className="mt-8 flex items-center gap-3 rounded-xl border p-3.5 text-xs app-text-secondary"
                        style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
                    >
                        <Icon name="users" size={18} style={{ color: "var(--success)" }} />
                        Secure session with an HttpOnly cookie. Access is limited to authorized team members.
                    </div>
                </div>
            </section>
        </main>
    );
}
