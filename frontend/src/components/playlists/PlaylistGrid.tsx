import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ListMusic, Music } from 'lucide-react';
import { usePlaylists, Playlist } from '../../contexts/PlaylistContext';
import PlaylistCard from './PlaylistCard';
import { Button } from '../ui/button';

interface PlaylistGridProps {
    onSelectPlaylist: (playlist: Playlist) => void;
    onPlayPlaylist?: (playlist: Playlist) => void;
}

export default function PlaylistGrid({ onSelectPlaylist, onPlayPlaylist }: PlaylistGridProps) {
    const { playlists, isLoading, createPlaylist, deletePlaylist } = usePlaylists();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");

    const handleCreate = async () => {
        if (!newName.trim()) return;
        await createPlaylist(newName);
        setNewName("");
        setIsCreating(false);
    };

    if (isLoading && playlists.length === 0) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="glass rounded-2xl aspect-[4/5] animate-pulse bg-white/5" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {/* Create New Playlist Card */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-center min-h-[250px]"
                    onClick={() => !isCreating && setIsCreating(true)}
                >
                    {isCreating ? (
                        <div className="w-full space-y-4" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Playlist Name"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={handleCreate}>Create</Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 rounded-full bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                                <Plus className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="font-bold text-lg">New Playlist</h3>
                            <p className="text-sm text-muted-foreground mt-1 text-balance">Create a collection for your favorites</p>
                        </>
                    )}
                </motion.div>

                {playlists.map(playlist => (
                    <PlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        onClick={onSelectPlaylist}
                        onDelete={deletePlaylist}
                        onPlay={onPlayPlaylist}
                    />
                ))}
            </div>

            {playlists.length === 0 && !isCreating && (
                <div className="flex flex-col items-center justify-center py-20 glass rounded-3xl opacity-50">
                    <Music className="w-20 h-20 mb-6 text-muted-foreground/20" />
                    <h3 className="text-2xl font-bold mb-2">No Playlists Found</h3>
                    <p className="text-muted-foreground max-w-md text-center">
                        You haven't created any playlists yet. Start by clicking "New Playlist" or adding a track from the library.
                    </p>
                </div>
            )}
        </div>
    );
}
