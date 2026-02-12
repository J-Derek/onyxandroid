import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Loader2, FileVideo, FileAudio, FolderOpen, Info, RefreshCw, Download } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { DownloadTask } from "@/types";

const TIPS = [
  "💡 Tip: Higher quality videos take longer to download but look better!",
  "🎵 Tip: Audio files are smaller and download faster than videos.",
  "📁 Tip: Playlists are organized in their own folders for easy access.",
  "⚡ Tip: Download speed depends on your internet connection.",
  "🎬 Tip: You can download multiple videos at the same time!",
  "🔍 Tip: Use the search bar to find videos quickly.",
  "📊 Tip: Check the Library tab to see all your downloads.",
  "🎯 Tip: You can cancel downloads anytime if needed.",
];

interface DownloadCardProps {
  task: DownloadTask;
  onCancel: (id: string) => void;
  onRetry?: (task: DownloadTask) => void;
  index: number;
}

const statusConfig = {
  starting: {
    color: "text-accent",
    bgColor: "bg-accent/10",
    icon: Loader2,
    label: "Starting...",
    animate: true,
  },
  downloading: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    icon: Loader2,
    label: "Downloading",
    animate: true,
  },
  processing: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    icon: Loader2,
    label: "Processing",
    animate: true,
  },
  completed: {
    color: "text-success",
    bgColor: "bg-success/10",
    icon: CheckCircle2,
    label: "Completed",
    animate: false,
  },
  error: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertCircle,
    label: "Error",
    animate: false,
  },
};

export function DownloadCard({ task, onCancel, onRetry, index }: DownloadCardProps) {
  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const isActive = ["starting", "downloading", "processing"].includes(task.status);
  const isAudio = task.filename?.toLowerCase().includes(".mp3") ||
    task.filename?.toLowerCase().includes(".m4a");

  const [currentTip, setCurrentTip] = useState(TIPS[0]);

  const [downloadTriggered, setDownloadTriggered] = useState(false);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setCurrentTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  // 🚀 Automatic "Save to Device"
  useEffect(() => {
    if (task.status === "completed" && task.filename && !downloadTriggered) {
      setDownloadTriggered(true);

      // We use a slight delay to ensure UI has rendered and to avoid potential browser pop-up blocking
      const timer = setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/api/library/stream/${encodeURIComponent(task.filename!)}`;
        link.download = task.filename!;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`[Auto-Download] Triggered for: ${task.filename}`);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [task.status, task.filename, downloadTriggered]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="glass rounded-2xl p-5 space-y-4 border-white/5 bg-surface-1/30"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn("p-2.5 rounded-xl shadow-inner", config.bgColor)}>
          {isAudio ? (
            <FileAudio className={cn("w-6 h-6", config.color)} />
          ) : (
            <FileVideo className={cn("w-6 h-6", config.color)} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-sm font-semibold text-foreground truncate mb-0.5">
            {task.filename || "Preparing download..."}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground opacity-60">
            {task.id.slice(0, 12)}
          </p>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
          config.bgColor,
          config.color,
          "border-current/20"
        )}>
          <StatusIcon className={cn("w-3 h-3", config.animate && "animate-spin")} />
          {config.label}
        </div>

        {/* Cancel Button */}
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(task.id)}
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {isActive && (
        <div className="space-y-3">
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <motion.div
              className="h-full progress-gradient rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${task.percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">Speed:</span>
              <span>{task.speed || "Calculating..."}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">ETA:</span>
              <span>{task.eta || "Calculating..."}</span>
            </div>
            {task.size_mb && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Size:</span>
                <span>{task.size_mb.toFixed(2)} MB</span>
              </div>
            )}
            {task.downloaded_mb && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Downloaded:</span>
                <span>{task.downloaded_mb.toFixed(2)} MB</span>
              </div>
            )}
          </div>

          {/* Location */}
          {task.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-surface-2">
              <FolderOpen className="w-3 h-3" />
              <span className="truncate">{task.location}</span>
            </div>
          )}

          {/* Tips */}
          <motion.div
            key={currentTip}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 text-xs"
          >
            <Info className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">{currentTip}</span>
          </motion.div>
        </div>
      )}

      {/* Completed Info */}
      {task.status === "completed" && (
        <div className="space-y-2 text-xs">
          {task.size_mb && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">Size:</span>
              <span>{task.size_mb.toFixed(2)} MB</span>
            </div>
          )}
          {task.location && (
            <div className="flex items-center gap-2 text-muted-foreground p-2 rounded-lg bg-surface-2">
              <FolderOpen className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{task.location}</span>
            </div>
          )}
          {/* Helpful info + fallback re-download */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-success/5 border border-success/10">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-success flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-muted-foreground leading-relaxed">
                Saved automatically to your <span className="font-semibold text-foreground">Downloads/YouTube_Downloads</span> folder.
              </p>
              {task.filename && (
                <a
                  href={`/api/library/stream/${encodeURIComponent(task.filename)}`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Download className="w-3 h-3" />
                  Can't find it? Download again
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {task.status === "error" && (
        <div className="space-y-2">
          {task.error && (
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              {task.error}
            </div>
          )}
          <div className="flex gap-2">
            {onRetry && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => onRetry(task)}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(task.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
