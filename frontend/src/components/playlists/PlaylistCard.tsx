import React from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play, Trash2 } from 'lucide-react';
import { Playlist } from '../../contexts/PlaylistContext';

interface PlaylistCardProps {
    playlist: Playlist;
    onClick: (playlist: Playlist) => void;
    onDelete?: (id: number) => void;
    onPlay?: (playlist: Playlist) => void;
}

export default function PlaylistCard({ playlist, onClick, onDelete, onPlay }: PlaylistCardProps) {
    return (
        <div
            className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg transition-all duration-300 cursor-pointer group relative"
            onClick={() => onClick(playlist)}
        >
            {/* Thumbnail */}
            <div className="relative aspect-square mb-4 shadow-2xl">
                {playlist.cover_image ? (
                    <img
                        src={playlist.cover_image}
                        alt={playlist.name}
                        className="w-full h-full object-cover rounded-md"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#282828] rounded-md">
                        <ListMusic className="w-16 h-16 text-muted-foreground opacity-20" />
                    </div>
                )}

                {/* Hover Play Button (Spotify style) - Slide up and Fade in */}
                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-[-8px] transition-all duration-300 shadow-2xl">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlay?.(playlist);
                        }}
                        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform"
                    >
                        <Play className="w-6 h-6 text-black fill-current ml-0.5" />
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="space-y-1">
                <h3 className="font-bold text-base truncate text-white">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground truncate leading-relaxed">
                    By Onyx • {playlist.track_count} tracks
                </p>
            </div>

            {/* Delete Button */}
            {!playlist.is_system && onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(playlist.id);
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-opacity"
                >
                    <Trash2 className="w-4 h-4 text-white" />
                </button>
            )}
        </div>
    );
}
