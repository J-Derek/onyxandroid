import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListMusic, Check, X, Search, Music } from 'lucide-react';
import { usePlaylists } from '../../contexts/PlaylistContext';
import { Button } from '../ui/button';

interface AddToPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    trackId: number | null;
    trackTitle?: string;
    artist?: string;
}

export default function AddToPlaylistModal({ isOpen, onClose, trackId, trackTitle, artist }: AddToPlaylistModalProps) {
    const { playlists, addTrackToPlaylist, createPlaylist } = usePlaylists();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const filteredPlaylists = playlists.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddToPlaylist = async (playlistId: number) => {
        if (!trackId) return;
        setIsLoading(true);
        const success = await addTrackToPlaylist(playlistId, trackId);
        setIsLoading(false);
        if (success) onClose();
    };

    const handleCreateAndAdd = async () => {
        if (!newName.trim()) return;
        setIsLoading(true);
        const newPlaylist = await createPlaylist(newName);
        if (newPlaylist && trackId) {
            await addTrackToPlaylist(newPlaylist.id, trackId);
            onClose();
        }
        setIsLoading(false);
        setNewName("");
        setIsCreating(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex gap-4 items-center">
                            <div className="p-3 bg-primary/20 rounded-2xl">
                                <ListMusic className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Add to Playlist</h3>
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {trackTitle} {artist ? `• ${artist}` : ''}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Search & Create Toggle */}
                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search playlists..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                            />
                        </div>

                        {!isCreating ? (
                            <Button
                                variant="outline"
                                className="w-full border-dashed border-white/10 text-muted-foreground hover:text-white"
                                onClick={() => setIsCreating(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create New Playlist
                            </Button>
                        ) : (
                            <div className="p-4 glass rounded-2xl space-y-4 border-primary/20 bg-primary/5">
                                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Playlist
                                </h4>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Give it a name..."
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" className="flex-1" onClick={handleCreateAndAdd} disabled={isLoading || !newName.trim()}>
                                        Create & Add
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Playlist List */}
                    <div className="flex-grow overflow-y-auto p-2 scrollbar-hide">
                        {filteredPlaylists.length > 0 ? (
                            filteredPlaylists.map(playlist => (
                                <button
                                    key={playlist.id}
                                    className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left group"
                                    onClick={() => handleAddToPlaylist(playlist.id)}
                                    disabled={isLoading}
                                >
                                    <div className="w-12 h-12 rounded-xl overflow-hidden glass bg-primary/10 flex-shrink-0">
                                        {playlist.cover_image ? (
                                            <img src={playlist.cover_image} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ListMusic className="w-5 h-5 text-muted-foreground/30" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{playlist.name}</h4>
                                        <p className="text-xs text-muted-foreground">{playlist.track_count} tracks</p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-5 h-5 text-primary" />
                                    </div>
                                </button>
                            ))
                        ) : searchQuery && (
                            <div className="py-12 text-center opacity-50">
                                <Music className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                                <p className="text-sm">No playlists match "{searchQuery}"</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
