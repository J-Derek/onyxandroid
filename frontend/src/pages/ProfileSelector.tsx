/**
 * Onyx - Profile Selector
 * Netflix-style profile picker for streaming mode
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, X, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { createProfile, verifyProfilePin, Profile } from "@/lib/auth";
import { toast } from "sonner";

const AVATAR_COLORS = [
    "from-cyan-500 to-blue-600",
    "from-purple-500 to-pink-600",
    "from-green-500 to-emerald-600",
    "from-orange-500 to-red-600",
    "from-yellow-500 to-amber-600",
];

export default function ProfileSelector() {
    const navigate = useNavigate();
    const { profiles, selectProfile, logout, refreshProfiles, user } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // PIN verification
    const [pinProfile, setPinProfile] = useState<Profile | null>(null);
    const [pinInput, setPinInput] = useState("");
    const [isVerifyingPin, setIsVerifyingPin] = useState(false);

    const handleProfileClick = async (profile: Profile) => {
        if (profile.has_pin) {
            setPinProfile(profile);
            setPinInput("");
        } else {
            selectProfile(profile);
            navigate("/streaming/home");
        }
    };

    const handlePinSubmit = async () => {
        if (!pinProfile) return;
        setIsVerifyingPin(true);

        try {
            const valid = await verifyProfilePin(pinProfile.id, pinInput);
            if (valid) {
                selectProfile(pinProfile);
                navigate("/streaming/home");
            } else {
                toast.error("Incorrect PIN");
            }
        } catch {
            toast.error("Failed to verify PIN");
        } finally {
            setIsVerifyingPin(false);
        }
    };

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) {
            toast.error("Please enter a name");
            return;
        }

        setIsCreating(true);
        try {
            await createProfile(newProfileName.trim());
            await refreshProfiles();
            setNewProfileName("");
            setShowCreateModal(false);
            toast.success("Profile created!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create profile");
        } finally {
            setIsCreating(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px]" />
            </div>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 text-center"
            >
                <img
                    src="/onyx-prism-v3.png"
                    alt="Onyx"
                    className="w-20 h-20 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                />
                <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">Who's <span className="text-primary">Listening?</span></h1>
                <p className="text-muted-foreground">
                    Logged in as {user?.username}
                </p>
            </motion.div>

            {/* Profiles Grid */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap justify-center gap-6 max-w-2xl"
            >
                {profiles.map((profile, index) => (
                    <motion.button
                        key={profile.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * index }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleProfileClick(profile)}
                        className="flex flex-col items-center gap-3 group"
                    >
                        {/* Avatar */}
                        <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-white text-3xl font-bold group-hover:ring-4 ring-white/20 transition-all relative`}>
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.name}
                                    className="w-full h-full object-cover rounded-2xl"
                                />
                            ) : (
                                profile.name.charAt(0).toUpperCase()
                            )}
                            {profile.has_pin && (
                                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                                    <Lock className="w-3 h-3" />
                                </div>
                            )}
                        </div>
                        <span className="font-medium">{profile.name}</span>
                    </motion.button>
                ))}

                {/* Add Profile Button */}
                {profiles.length < 5 && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * profiles.length }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCreateModal(true)}
                        className="flex flex-col items-center gap-3 group"
                    >
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 group-hover:border-white/40 group-hover:text-white/60 transition-all">
                            <Plus className="w-10 h-10" />
                        </div>
                        <span className="text-muted-foreground">Add Profile</span>
                    </motion.button>
                )}
            </motion.div>

            {/* Footer Actions */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex gap-4"
            >
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                    Back to Mode Switcher
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 border border-red-500/30"
                >
                    Sign Out
                </Button>
            </motion.div>

            {/* Create Profile Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Create Profile</h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-muted-foreground hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <Input
                                placeholder="Profile name"
                                value={newProfileName}
                                onChange={e => setNewProfileName(e.target.value)}
                                className="mb-4"
                                autoFocus
                                onKeyDown={e => e.key === "Enter" && handleCreateProfile()}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 gradient-accent"
                                    onClick={handleCreateProfile}
                                    disabled={isCreating}
                                >
                                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PIN Modal */}
            <AnimatePresence>
                {pinProfile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setPinProfile(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 w-full max-w-sm text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h2 className="text-xl font-bold mb-2">Enter PIN</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Enter PIN for {pinProfile.name}
                            </p>

                            <Input
                                type="password"
                                placeholder="PIN"
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value)}
                                className="mb-4 text-center text-2xl tracking-widest"
                                maxLength={6}
                                autoFocus
                                onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setPinProfile(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 gradient-accent"
                                    onClick={handlePinSubmit}
                                    disabled={isVerifyingPin || !pinInput}
                                >
                                    {isVerifyingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
