/**
 * Onyx - Login Page
 * User authentication for Streaming mode
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, User, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get("returnUrl") || "/";

    const { login, register, checkAuth } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    // Form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (mode === "login") {
                await login(email, password);
                toast.success("Welcome back!");
            } else {
                await register(username, email, password);
                toast.success("Account created!");
            }

            await checkAuth();

            // Redirect back to where user came from
            // If returnUrl is /streaming, go to profile selector first
            if (returnUrl === "/streaming" || returnUrl === "/streaming/home") {
                navigate("/streaming");
            } else {
                navigate(returnUrl);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Authentication failed";

            // Special handling for 401 on login (suggest reset/re-register)
            if (mode === "login" && (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("401"))) {
                toast.error("Login failed. If you previously had an account, it might have been reset by the server. Try signing up again!", {
                    duration: 6000,
                });
            } else {
                toast.error(message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px]" />
            </div>
            {/* Back button */}
            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate("/")}
                className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
            </motion.button>

            {/* Logo */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <img
                    src="/onyx-prism-v3.png"
                    alt="Onyx"
                    className="w-16 h-16 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                />
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-8 w-full max-w-md"
            >
                <h1 className="text-3xl md:text-4xl font-bold mb-3 text-center tracking-tight">
                    {mode === "login" ? (
                        <>Welcome <span className="text-primary">Back</span></>
                    ) : (
                        <>Create <span className="text-primary">Account</span></>
                    )}
                </h1>
                <p className="text-muted-foreground text-center mb-6">
                    {mode === "login"
                        ? "Sign in to access Streaming mode"
                        : "Join Onyx Streaming"}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "register" && (
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                            <Input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10 input-glow bg-surface-2 border-white/10 focus:border-primary"
                                required
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 input-glow bg-surface-2 border-white/10 focus:border-primary"
                            required
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 input-glow bg-surface-2 border-white/10 focus:border-primary"
                            required
                            minLength={6}
                        />
                    </div>

                    {mode === "login" && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                            />
                            Remember me
                        </label>
                    )}

                    <Button
                        type="submit"
                        className="w-full gradient-accent"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : mode === "login" ? (
                            "Sign In"
                        ) : (
                            "Create Account"
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                        {" "}
                        <button
                            onClick={() => setMode(mode === "login" ? "register" : "login")}
                            className="text-primary hover:underline"
                        >
                            {mode === "login" ? "Sign up" : "Sign in"}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
