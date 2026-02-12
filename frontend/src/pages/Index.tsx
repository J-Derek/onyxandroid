import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ManualModal } from "@/components/modals/ManualModal";
import { HomeTab } from "@/components/tabs/HomeTab";
import { QueueTab } from "@/components/tabs/QueueTab";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { MediaPlayerTab } from "@/components/tabs/MediaPlayerTab";
import { DropZoneOverlay } from "@/components/DropZoneOverlay";
import { requestNotificationPermission, showDownloadCompleteNotification, showDownloadFailedNotification } from "@/lib/notifications";
import { addToHistory, createHistoryItem } from "@/lib/history";
import type { DownloadTask, QueueItem, VideoCard } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";

type TabType = "home" | "queue" | "history" | "media";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Load theme from localStorage, default to "dark"
    const savedTheme = localStorage.getItem("onyx-theme");
    return (savedTheme === "light" || savedTheme === "dark") ? savedTheme : "dark";
  });
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() => {
    // Load queue from localStorage
    try {
      const savedQueue = localStorage.getItem("onyx-queue");
      return savedQueue ? JSON.parse(savedQueue) : [];
    } catch {
      return [];
    }
  });
  const queueRef = useRef<HTMLDivElement>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // States lifted from HomeTab for persistence
  const [previewVideo, setPreviewVideo] = useState<VideoCard | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoCard[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Drag & Drop state
  const [isDragging, setIsDragging] = useState(false);
  const [droppedUrl, setDroppedUrl] = useState<string | null>(null);
  const dragCounter = useRef(0);

  // Apply theme to document and save to localStorage
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    localStorage.setItem("onyx-theme", theme);
  }, [theme]);

  // Save queue to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("onyx-queue", JSON.stringify(queueItems));
  }, [queueItems]);

  const handleThemeToggle = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  const handleStartDownload = (task: DownloadTask) => {
    // Request notification permission on first download
    requestNotificationPermission();

    setDownloadTasks(prev => [task, ...prev]);
    setActiveTab("queue");
    // Auto-scroll to queue after a brief delay
    setTimeout(() => {
      queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleAddToQueue = (item: QueueItem) => {
    setQueueItems(prev => [...prev, item]);
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueueItems(prev => prev.filter(item => item.id !== id));
  };

  const handleScrollToQueue = () => {
    setActiveTab("queue");
    setTimeout(() => {
      queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleUpdateTask = (id: string, updates: Partial<DownloadTask>) => {
    setDownloadTasks(prev => {
      const task = prev.find(t => t.id === id);

      // Trigger notifications and save to history on status changes
      if (updates.status === "completed" && task?.status !== "completed") {
        showDownloadCompleteNotification(task?.title || "Download", {
          thumbnail: task?.thumbnail,
          filename: updates.filename,
        });

        // Save to download history
        if (task?.url) {
          const format = updates.filename?.endsWith('.mp3') || updates.filename?.endsWith('.m4a') ? 'audio' : 'video';
          addToHistory(createHistoryItem(
            task.url,
            task.title || "Unknown",
            task.thumbnail,
            format,
            "best", // Quality info not available here
            updates.filename || "",
            updates.size_mb
          ));
        }
      } else if (updates.status === "error" && task?.status !== "error") {
        showDownloadFailedNotification(task?.title || "Download");
      }

      return prev.map(t => t.id === id ? { ...t, ...updates } : t);
    });
  };



  const handleRemoveTask = (id: string) => {
    setDownloadTasks(prev => prev.filter(task => task.id !== id));
  };

  const activeDownloadsCount = downloadTasks.filter(
    t => ["starting", "downloading", "processing"].includes(t.status)
  ).length;

  // Drag & Drop handlers
  const isYouTubeUrl = (text: string) => {
    return text.includes("youtube.com") || text.includes("youtu.be");
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('text/uri-list')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');

    if (text && isYouTubeUrl(text)) {
      // Switch to home tab and set the URL
      setActiveTab('home');
      setDroppedUrl(text);
      toast.success("YouTube URL detected!", { description: "Checking video..." });
    } else if (text) {
      toast.error("Invalid URL", { description: "Please drop a YouTube URL" });
    }
  }, []);

  return (
    <div
      className="min-h-screen bg-background transition-colors duration-700 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      <DropZoneOverlay isVisible={isDragging} />


      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onOpenManual={() => setShowManualModal(true)}
        queueCount={activeDownloadsCount}
      />

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="relative">
          <div style={{ display: activeTab === "home" ? "block" : "none" }}>
            <HomeTab
              onStartDownload={handleStartDownload}
              onAddToQueue={handleAddToQueue}
              onScrollToQueue={handleScrollToQueue}
              onOpenManual={() => setShowManualModal(true)}
              // Props for persistent preview
              previewVideo={previewVideo}
              setPreviewVideo={setPreviewVideo}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              relatedVideos={relatedVideos}
              setRelatedVideos={setRelatedVideos}
              isLoadingPreview={isLoadingPreview}
              setIsLoadingPreview={setIsLoadingPreview}
              isLoadingRelated={isLoadingRelated}
              setIsLoadingRelated={setIsLoadingRelated}
              // Drag & Drop props
              droppedUrl={droppedUrl}
              onClearDroppedUrl={() => setDroppedUrl(null)}
            />

          </div>

          <div
            ref={queueRef}
            style={{ display: activeTab === "queue" ? "block" : "none" }}
          >
            <QueueTab
              tasks={downloadTasks}
              onUpdateTask={handleUpdateTask}
              onRemoveTask={handleRemoveTask}
              onRetryTask={async (task) => {
                if (!task.url) {
                  toast.error("Cannot retry: No URL available");
                  return;
                }
                try {
                  // Determine format from filename
                  const isAudio = task.filename?.endsWith('.mp3') || task.filename?.endsWith('.m4a') || task.filename?.endsWith('.opus');
                  const format = isAudio ? 'audio' : 'video';
                  const quality = isAudio ? '320kbps' : 'best';

                  const { task_id } = await api.startDownload(task.url, format, quality);
                  setDownloadTasks(prev => [{
                    id: task_id,
                    status: "starting",
                    percent: 0,
                    title: task.title || "Retrying...",
                    thumbnail: task.thumbnail,
                    filename: task.filename || "retrying...",
                    url: task.url,
                  }, ...prev]);
                  toast.success("Retry started", { description: task.title });
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error("Retry failed", { description: msg });
                }
              }}
              onGoHome={() => setActiveTab("home")}
              queueItems={queueItems}
              onRemoveFromQueue={handleRemoveFromQueue}
              onReorderQueue={(items) => setQueueItems(items)}
              onStartQueueDownloads={async (items) => {


                const newTasks: DownloadTask[] = [];
                for (const item of items) {
                  try {
                    const { task_id } = await api.startDownload(item.url, item.format, item.quality);
                    newTasks.push({
                      id: task_id,
                      status: "starting",
                      percent: 0,
                      title: item.title || "Unknown Title",
                      thumbnail: item.thumbnail,
                      filename: item.title || "downloading...",
                      url: item.url,
                    });
                  } catch (err: unknown) {
                    console.error(`Failed to start download for ${item.title}:`, err);
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    toast.error(`Failed to start download for "${item.title}"`, {
                      description: errorMessage || "Please check the URL and try again."
                    });
                  }
                }

                if (newTasks.length > 0) {
                  setDownloadTasks(prev => [...newTasks, ...prev]);
                  setQueueItems([]);
                  toast.success(`Started ${newTasks.length} downloads from queue!`);
                }
              }}
            />
          </div>

          <div style={{ display: activeTab === "history" ? "block" : "none" }}>
            <HistoryTab
              onGoHome={() => setActiveTab("home")}

              onStartRedownload={async (url, format, quality) => {
                try {
                  const { task_id } = await api.startDownload(url, format, quality);
                  setDownloadTasks(prev => [{
                    id: task_id,
                    status: "starting",
                    percent: 0,
                    title: "Re-downloading...",
                    url: url,
                    filename: "re-downloading...",
                  }, ...prev]);
                  setActiveTab("queue");
                  toast.success("Re-download started!");
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error("Failed to start re-download", { description: msg });
                }
              }}
            />
          </div>

          <div style={{ display: activeTab === "media" ? "block" : "none" }}>
            <MediaPlayerTab />
          </div>

        </div>
      </main>

      {/* Background Decorations */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <ManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
    </div>
  );
};

export default Index;
