import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Home, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { DownloadCard } from "../DownloadCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { DownloadTask, QueueItem } from "@/types";

interface QueueTabProps {
  tasks: DownloadTask[];
  onUpdateTask: (id: string, updates: Partial<DownloadTask>) => void;
  onRemoveTask: (id: string) => void;
  onRetryTask?: (task: DownloadTask) => void;
  onGoHome: () => void;
  queueItems?: QueueItem[];
  onRemoveFromQueue?: (id: string) => void;
  onReorderQueue?: (items: QueueItem[]) => void;
  onStartQueueDownloads?: (items: QueueItem[]) => void;
}

export function QueueTab({ tasks, onUpdateTask, onRemoveTask, onRetryTask, onGoHome, queueItems = [], onRemoveFromQueue, onReorderQueue, onStartQueueDownloads }: QueueTabProps) {
  // Poll download progress from API
  const pollProgress = useCallback(async (taskId: string) => {
    try {
      const progress = await api.getDownloadProgress(taskId);
      onUpdateTask(taskId, progress);

      if (progress.status === "completed") {
        toast.success("Download completed!", {
          description: `"${progress.filename}" is ready in the Library.`
        });
      } else if (progress.status === "error") {
        toast.error("Download failed", {
          description: progress.error || "Unknown error occurred."
        });
      }
    } catch (error) {
      console.error("Failed to poll progress:", error);
    }
  }, [onUpdateTask]);

  // Start polling for active tasks
  useEffect(() => {
    const activeTasks = tasks.filter(t =>
      ["starting", "downloading", "processing"].includes(t.status)
    );

    if (activeTasks.length === 0) return;

    const intervals = activeTasks.map(task => {
      const interval = setInterval(() => {
        pollProgress(task.id);
      }, 1500);
      return { taskId: task.id, interval };
    });

    return () => {
      intervals.forEach(({ interval }) => clearInterval(interval));
    };
  }, [tasks, pollProgress]);

  const handleCancel = async (id: string) => {
    try {
      await api.cancelDownload(id);
      onRemoveTask(id);
      toast.info("Download cancelled");
    } catch (error) {
      console.error("Failed to cancel download:", error);
      toast.error("Failed to cancel download");
    }
  };

  const activeTasks = tasks.filter(t =>
    ["starting", "downloading", "processing"].includes(t.status)
  );
  const completedTasks = tasks.filter(t => t.status === "completed");
  const errorTasks = tasks.filter(t => t.status === "error");

  if (tasks.length === 0 && queueItems.length === 0) {
    return (
      <EmptyState
        icon={Download}
        title="No downloads yet"
        description="Start your first download from the Home tab. Your active downloads will appear here."
        action={{ label: "Go to Home", onClick: onGoHome }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Back to Home */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader title="Active Downloads" className="mb-0" />
        <Button variant="ghost" size="sm" onClick={onGoHome} className="gap-2 w-fit">
          <Home className="w-4 h-4" />
          Back to Home
        </Button>
      </div>

      {/* Queue Items Section */}
      {queueItems.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={`Queue (${queueItems.length})`}
            subtitle={`${queueItems.length} item${queueItems.length > 1 ? "s" : ""} waiting to be downloaded`}
            className="mb-4"
          />
          <div className="p-4 rounded-lg glass border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="gradient"
                size="sm"
                onClick={() => onStartQueueDownloads?.(queueItems)}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All Items
              </Button>
            </div>
            <div className="space-y-2">
              {queueItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      disabled={index === 0}
                      onClick={() => {
                        if (!onReorderQueue) return;
                        const newItems = [...queueItems];
                        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
                        onReorderQueue(newItems);
                      }}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      disabled={index === queueItems.length - 1}
                      onClick={() => {
                        if (!onReorderQueue) return;
                        const newItems = [...queueItems];
                        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
                        onReorderQueue(newItems);
                      }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-12 h-8 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.format} • {item.quality}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onRemoveFromQueue?.(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Active Downloads */}
      {activeTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Active Downloads ({activeTasks.length})
          </h2>
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {activeTasks.map((task, index) => (
                <DownloadCard
                  key={task.id}
                  task={task}
                  onCancel={handleCancel}
                  index={index}
                />
              ))}
            </div>
          </AnimatePresence>
        </section>
      )}

      {/* Completed Downloads */}
      {completedTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            Completed ({completedTasks.length})
          </h2>
          <div className="space-y-3">
            {completedTasks.map((task, index) => (
              <DownloadCard
                key={task.id}
                task={task}
                onCancel={handleCancel}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {/* Error Downloads */}
      {errorTasks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            Failed ({errorTasks.length})
          </h2>
          <div className="space-y-3">
            {errorTasks.map((task, index) => (
              <DownloadCard
                key={task.id}
                task={task}
                onCancel={handleCancel}
                onRetry={onRetryTask}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
