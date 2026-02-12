import React from 'react';
import { Play, MoreVertical, Trash2, GripVertical } from 'lucide-react';
import { PlaylistTrack } from '../../contexts/PlaylistContext';

interface PlaylistTrackRowProps {
    track: PlaylistTrack;
    index: number;
    onPlay: (track: PlaylistTrack) => void;
    onRemove?: (trackId: number) => void;
    dragHandleProps?: any;
}

export default function PlaylistTrackRow({ track, index, onPlay, onRemove, dragHandleProps }: PlaylistTrackRowProps) {
    return (
        <div className="group flex items-center gap-4 p-2 rounded-xl h-16 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3 w-10 text-center text-muted-foreground group-hover:hidden">
                <span className="text-sm font-medium">{index + 1}</span>
            </div>

            <div className="hidden group-hover:flex items-center gap-3 w-10 justify-center">
                <button
                    onClick={() => onPlay(track)}
                    className="p-2 rounded-full bg-primary text-white hover:scale-110 transition-transform"
                >
                    <Play className="w-4 h-4 fill-current" />
                </button>
            </div>

            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {track.thumbnail_url ? (
                    <img src={track.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                )}
            </div>

            <div className="flex-grow min-w-0">
                <h4 className="font-medium truncate">{track.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>

            <div className="text-sm text-muted-foreground w-12 text-right">
                {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </div>

            <div className="flex items-center gap-2">
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(track.id);
                        }}
                        className="p-2 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
                <div {...dragHandleProps} className="p-2 text-muted-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
}
