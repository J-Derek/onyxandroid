import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, Shuffle, Clock, ListMusic, Trash2, Edit3, Save } from 'lucide-react';
import { usePlaylists, Playlist } from '../../contexts/PlaylistContext';
import PlaylistTrackRow from './PlaylistTrackRow';
import { Button } from '../ui/button';

interface PlaylistViewProps {
    playlist: Playlist;
    onBack: () => void;
    onPlayTrack: (track_id: number) => void;
    onPlayPlaylist: (playlist: Playlist, shuffle?: boolean) => void;
}

export default function PlaylistView({ playlist: initialPlaylist, onBack, onPlayTrack, onPlayPlaylist }: PlaylistViewProps) {
    const { getPlaylist, removeTrackFromPlaylist, updatePlaylist, reorderTracks } = usePlaylists();
    const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(initialPlaylist.name);
    const [editDesc, setEditDesc] = useState(initialPlaylist.description || "");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPlaylistDetails();
    }, [initialPlaylist.id]);

    const loadPlaylistDetails = async () => {
        setIsLoading(true);
        const data = await getPlaylist(initialPlaylist.id);
        if (data) setPlaylist(data);
        setIsLoading(false);
    };

    const handleSaveMetadata = async () => {
        const success = await updatePlaylist(playlist.id, {
            name: editName,
            description: editDesc
        });
        if (success) {
            setPlaylist(prev => ({ ...prev, name: editName, description: editDesc }));
            setIsEditing(false);
        }
    };

    const handleRemoveTrack = async (trackId: number) => {
        const success = await removeTrackFromPlaylist(playlist.id, trackId);
        if (success) {
            setPlaylist(prev => ({
                ...prev,
                tracks: prev.tracks?.filter(t => t.id !== trackId),
                track_count: prev.track_count - 1
            }));
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="gap-2 -ml-2" onClick={onBack}>
                    <ChevronLeft className="w-5 h-5" />
                    Back to Playlists
                </Button>

                <div className="flex gap-2">
                    {!playlist.is_system && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-white"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <Edit3 className="w-4 h-4 mr-2" />
                            {isEditing ? "Cancel Edit" : "Edit Playlist"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Hero Section */}
            <div className="flex flex-col md:flex-row gap-8">
                <div className="w-64 h-64 flex-shrink-0 glass rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 relative group">
                    {playlist.cover_image ? (
                        <img src={playlist.cover_image} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ListMusic className="w-24 h-24 text-muted-foreground/30" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col justify-end py-2 space-y-4 flex-grow">
                    <div className="space-y-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">Playlist</span>
                        {isEditing ? (
                            <div className="space-y-3 max-w-xl">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full text-4xl font-black bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                                />
                                <textarea
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    placeholder="Add a description..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-muted-foreground resize-none focus:outline-none focus:border-primary"
                                    rows={2}
                                />
                                <Button onClick={handleSaveMetadata} className="gap-2">
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </Button>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none truncate">
                                    {playlist.name}
                                </h1>
                                <p className="text-lg text-muted-foreground line-clamp-2 max-w-2xl italic">
                                    {playlist.description || "Collection of your favorite tracks"}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white">Dre</span>
                        </div>
                        <span className="opacity-30">•</span>
                        <span>{playlist.track_count} tracks</span>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                        <Button
                            size="lg"
                            className="rounded-full bg-primary hover:bg-primary/90 px-8 gap-2 shadow-xl shadow-primary/20"
                            onClick={() => onPlayPlaylist(playlist)}
                            disabled={playlist.track_count === 0}
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Play All
                        </Button>
                        <Button
                            size="lg"
                            variant="secondary"
                            className="rounded-full bg-white/10 hover:bg-white/20 px-8 gap-2"
                            onClick={() => onPlayPlaylist(playlist, true)}
                            disabled={playlist.track_count === 0}
                        >
                            <Shuffle className="w-5 h-5 text-white" />
                            Shuffle
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tracks Section */}
            <div className="glass rounded-[2rem] p-6 lg:p-8 space-y-4">
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground px-4 py-2 border-b border-white/5">
                    <div className="w-10">#</div>
                    <div className="flex-grow">Title</div>
                    <div className="w-12 text-right"><Clock className="w-4 h-4 inline" /></div>
                    <div className="w-10"></div>
                </div>

                <div className="space-y-1">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-16 glass rounded-xl animate-pulse bg-white/5" />
                        ))
                    ) : playlist.tracks && playlist.tracks.length > 0 ? (
                        playlist.tracks.map((track, index) => (
                            <PlaylistTrackRow
                                key={track.id}
                                track={track}
                                index={index}
                                onPlay={() => onPlayTrack(track.id)}
                                onRemove={handleRemoveTrack}
                            />
                        ))
                    ) : (
                        <div className="py-20 text-center opacity-50">
                            <ListMusic className="w-20 h-20 mx-auto mb-4 text-muted-foreground/20" />
                            <p className="text-xl font-bold">This playlist is empty</p>
                            <p className="text-sm text-muted-foreground">Add tracks from your library to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
