import { motion } from "framer-motion";
import { FileVideo, FileAudio, Download, Clock, RefreshCw, Play, ListPlus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { LibraryFile } from "@/types";

interface LibraryCardProps {
  file: LibraryFile;
  index: number;
  onRedownload?: (url: string, filename: string) => void;
  onPlay?: (file: LibraryFile) => void;
  onAddToPlaylist?: (file: LibraryFile) => void;
}

export function LibraryCard({ file, index, onRedownload, onPlay, onAddToPlaylist }: LibraryCardProps) {
  const isAudio = file.type === "audio";
  const Icon = isAudio ? FileAudio : FileVideo;
  const extension = file.name.split('.').pop()?.toUpperCase() || (isAudio ? 'MP3' : 'MP4');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRedownload = () => {
    if (file.source_url && onRedownload) {
      onRedownload(file.source_url, file.name);
    }
  };

  const handlePlay = () => {
    if (onPlay) {
      onPlay(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="glass rounded-xl p-4 hover-lift group"
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail or Icon */}
        {file.thumbnail ? (
          <div
            className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 relative cursor-pointer group/thumb"
            onClick={handlePlay}
          >
            <img
              src={file.thumbnail}
              alt={file.name}
              className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
            />
            {onPlay && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "p-3 rounded-xl flex-shrink-0 relative cursor-pointer transition-all",
              isAudio ? "gradient-accent hover:scale-105" : "gradient-primary hover:scale-105"
            )}
            onClick={handlePlay}
          >
            <Icon className="w-6 h-6 text-primary-foreground" />
            {onPlay && (
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            )}
          </div>
        )}


        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-medium text-foreground truncate">
            {file.name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-surface-2 font-medium">
              {extension}
            </span>
            <span>{file.size_mb.toFixed(1)} MB</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(file.modified_at)}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddToPlaylist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddToPlaylist(file)}
              title="Add to playlist"
              className="text-muted-foreground hover:text-primary"
            >
              <ListPlus className="w-4 h-4" />
            </Button>
          )}
          {onPlay && (
            <Button
              variant="glass"
              size="sm"
              onClick={handlePlay}
              title={isAudio ? "Play audio" : "Play video"}
            >
              <Play className="w-4 h-4 mr-1" />
              Play
            </Button>
          )}
          {file.source_url && onRedownload ? (
            <Button
              variant="glass"
              size="sm"
              onClick={handleRedownload}
              title="Re-download from YouTube"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Re-download
            </Button>
          ) : (
            <Button
              variant="glass"
              size="sm"
              asChild
            >
              <a href={`/api/library/stream/${file.path}`} download target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-1" />
                Download
              </a>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function LibraryCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 skeleton rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 skeleton rounded w-3/4" />
          <div className="h-3 skeleton rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
