/**
 * Onyx Streaming - Playlist Manager Modal
 * Allows adding tracks to playlists or creating new ones.
 */
import { useState, useEffect } from "react";
import {
    Dialog, DialogContent,
    DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ListMusic, Music, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Playlist {
    id: number;
    name: string;
    track_count: number;
}

interface PlaylistManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    trackId: number | null;
    trackTitle?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function PlaylistManagerModal({
    isOpen,
    onClose,
    trackId,
    trackTitle
}: PlaylistManagerModalProps) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPlaylists();
            setIsCreating(false);
            setNewName("");
        }
    }, [isOpen]);

    const fetchPlaylists = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/playlists`, {
                headers: {
                    "X-Profile-ID": localStorage.getItem("onyx_active_profile") || "",
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                }
            });
            const data = await res.json();
            setPlaylists(data);
        } catch (err) {
            console.error("Failed to fetch playlists", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreatePlaylist = async () => {
        if (!newName.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/api/playlists`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Profile-ID": localStorage.getItem("onyx_active_profile") || "",
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                },
                body: JSON.stringify({ name: newName })
            });

            if (res.ok) {
                const newPlaylist = await res.json();
                setPlaylists([newPlaylist, ...playlists]);
                setNewName("");
                setIsCreating(false);
                toast.success(`Playlist "${newPlaylist.name}" created`);

                // If we have a trackId, add it immediately
                if (trackId) {
                    addToPlaylist(newPlaylist.id);
                }
            }
        } catch (err) {
            toast.error("Failed to create playlist");
        }
    };

    const addToPlaylist = async (playlistId: number) => {
        if (!trackId) return;
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks?track_id=${trackId}`, {
                method: "POST",
                headers: {
                    "X-Profile-ID": localStorage.getItem("onyx_active_profile") || "",
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                }
            });

            if (res.ok) {
                toast.success("Added to playlist");
                onClose();
            } else {
                const data = await res.json();
                toast.error(data.detail || "Failed to add to playlist");
            }
        } catch (err) {
            toast.error("Connection error");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="glass border-white/10 sm:max-w-md p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ListMusic className="w-6 h-6 text-primary" />
                        Add to Playlist
                    </DialogTitle>
                    <DialogDescription className="text-white/60">
                        {trackTitle ? `Add "${trackTitle}" to your collections` : "Choose a playlist"}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 pt-2 space-y-4">
                    {/* New Playlist Section */}
                    <div className="space-y-3">
                        {isCreating ? (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Playlist name..."
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
                                    className="glass border-white/10 h-10"
                                />
                                <Button onClick={handleCreatePlaylist} className="shrink-0 h-10 px-4">Create</Button>
                                <Button variant="ghost" onClick={() => setIsCreating(false)} className="shrink-0 h-10">Cancel</Button>
                            </div>
                        ) : (
                            <Button
                                variant="glass"
                                className="w-full justify-start gap-4 h-14 border-dashed border-white/10 hover:border-primary/50 transition-all group"
                                onClick={() => setIsCreating(true)}
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <span className="font-bold text-base">Create New Playlist</span>
                            </Button>
                        )}
                    </div>

                    <div className="border-t border-white/5 my-4" />

                    {/* List of Playlists */}
                    <ScrollArea className="h-72 -mx-2 px-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-sm text-white/40">Loading playlists...</p>
                            </div>
                        ) : playlists.length === 0 ? (
                            <div className="text-center py-12 opacity-30">
                                <Music className="w-16 h-16 mx-auto mb-3" />
                                <p className="text-sm">No playlists yet</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {playlists.map((pl) => (
                                    <button
                                        key={pl.id}
                                        onClick={() => addToPlaylist(pl.id)}
                                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 group transition-all"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-primary/30 transition-colors">
                                                <ListMusic className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="text-left min-w-0">
                                                <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{pl.name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">{pl.track_count} tracks</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-4 bg-white/5 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} className="w-full h-11 text-white/60 hover:text-white">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
