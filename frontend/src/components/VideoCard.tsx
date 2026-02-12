import { motion } from "framer-motion";
import { Play, User, Eye } from "lucide-react";
import { Button } from "./ui/button";
import type { VideoCard as VideoCardType } from "@/types";

interface VideoCardProps {
  video: VideoCardType;
  onUseLink: (video: VideoCardType) => void;
  onClick?: (video: VideoCardType) => void;
  onAddToQueue?: (video: VideoCardType) => void;
  index: number;
}

export function VideoCard({ video, onUseLink, onClick, onAddToQueue, index }: VideoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative rounded-2xl overflow-hidden glass hover:border-primary/40 transition-all duration-500 cursor-pointer shadow-xl shadow-black/20"
      onClick={() => onClick?.(video)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <Play className="w-12 h-12 text-primary/30" />
          </div>
        )}

        {/* Duration Badge */}
        {video.duration && (
          <span className="absolute bottom-2 right-2 px-2 py-1 text-[10px] font-bold bg-black/80 backdrop-blur-md rounded-md text-white/90 border border-white/10 uppercase tracking-tighter">
            {video.duration}
          </span>
        )}

        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent flex items-center justify-center gap-3 p-4"
        >
          <Button
            variant="gradient"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUseLink(video);
            }}
            className="flex-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
          >
            Use Link
          </Button>
          {onAddToQueue && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue(video);
              }}
              className="px-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-black/40 backdrop-blur-md border-white/20 hover:border-primary/50"
            >
              Add to Queue
            </Button>
          )}
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 bg-surface-0/40">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-300">
          {video.title}
        </h3>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
          {video.uploader && (
            <span className="flex items-center gap-1.5 truncate">
              <User className="w-3 h-3 text-primary/70" />
              {video.uploader}
            </span>
          )}
          {video.views && (
            <span className="flex items-center gap-1.5 shrink-0">
              <Eye className="w-3 h-3 text-primary/70" />
              {video.views}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden glass">
      <div className="aspect-video skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton rounded w-full" />
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}
