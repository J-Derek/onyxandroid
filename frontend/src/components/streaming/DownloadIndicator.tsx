/**
 * Floating Download Indicator
 * Shows active download progress in the streaming mode
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface DownloadStatus {
    task_id: string;
    status: 'starting' | 'downloading' | 'processing' | 'completed' | 'error';
    progress: number;
    filename?: string;
    error?: string;
}

export function DownloadIndicator() {
    const [activeDownloads, setActiveDownloads] = useState<DownloadStatus[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    // Listen for new downloads starting
    useEffect(() => {
        const handleDownloadStart = (event: CustomEvent<{ task_id: string; title: string }>) => {
            const { task_id, title } = event.detail;
            setActiveDownloads(prev => [
                ...prev,
                { task_id, status: 'starting', progress: 0, filename: title }
            ]);
            setIsExpanded(true);
        };

        window.addEventListener('onyx-download-start', handleDownloadStart as EventListener);
        return () => {
            window.removeEventListener('onyx-download-start', handleDownloadStart as EventListener);
        };
    }, []);

    // Poll progress for active downloads
    const pollProgress = useCallback(async () => {
        if (activeDownloads.length === 0) return;

        const activeIds = activeDownloads.filter(d =>
            d.status === 'starting' || d.status === 'downloading' || d.status === 'processing'
        );

        for (const download of activeIds) {
            try {
                const progress = await api.getDownloadProgress(download.task_id);
                setActiveDownloads(prev => prev.map(d =>
                    d.task_id === download.task_id
                        ? { ...d, ...progress }
                        : d
                ));
            } catch (e) {
                console.error('Failed to poll download progress:', e);
            }
        }
    }, [activeDownloads]);

    useEffect(() => {
        if (activeDownloads.some(d =>
            d.status === 'starting' || d.status === 'downloading' || d.status === 'processing'
        )) {
            const interval = setInterval(pollProgress, 1500);
            return () => clearInterval(interval);
        }
    }, [activeDownloads, pollProgress]);

    // Auto-collapse after all complete
    useEffect(() => {
        const allComplete = activeDownloads.length > 0 &&
            activeDownloads.every(d => d.status === 'completed' || d.status === 'error');

        if (allComplete) {
            const timer = setTimeout(() => {
                setActiveDownloads([]);
                setIsExpanded(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [activeDownloads]);

    // Remove completed download
    const dismissDownload = (taskId: string) => {
        setActiveDownloads(prev => prev.filter(d => d.task_id !== taskId));
    };

    if (activeDownloads.length === 0) return null;

    const isAnyActive = activeDownloads.some(d =>
        d.status === 'starting' || d.status === 'downloading' || d.status === 'processing'
    );
    const completedCount = activeDownloads.filter(d => d.status === 'completed').length;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed bottom-24 right-4 z-[100]"
            >
                {/* Collapsed View */}
                {!isExpanded ? (
                    <motion.button
                        onClick={() => setIsExpanded(true)}
                        className="flex items-center gap-3 px-4 py-3 bg-primary/20 backdrop-blur-xl rounded-full border border-primary/30 shadow-lg shadow-primary/20"
                    >
                        {isAnyActive ? (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        ) : (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                        <span className="text-sm font-medium">
                            {isAnyActive
                                ? `Downloading (${activeDownloads.length})`
                                : `${completedCount} completed`
                            }
                        </span>
                    </motion.button>
                ) : (
                    /* Expanded View */
                    <motion.div
                        layout
                        className="w-80 bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Download className="w-5 h-5 text-primary" />
                                <span className="font-bold">Downloads</span>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Download List */}
                        <div className="max-h-60 overflow-y-auto p-2">
                            {activeDownloads.map((download) => (
                                <div
                                    key={download.task_id}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5"
                                >
                                    {/* Status Icon */}
                                    <div className="flex-shrink-0">
                                        {download.status === 'completed' ? (
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                        ) : download.status === 'error' ? (
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {download.filename || 'Downloading...'}
                                        </p>
                                        {download.status === 'error' ? (
                                            <p className="text-xs text-red-400 truncate">
                                                {download.error || 'Download failed'}
                                            </p>
                                        ) : download.status === 'completed' ? (
                                            <p className="text-xs text-green-400">Complete</p>
                                        ) : (
                                            <div className="mt-1">
                                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-primary"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${download.progress}%` }}
                                                        transition={{ ease: "easeOut" }}
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {download.progress.toFixed(0)}%
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dismiss */}
                                    {(download.status === 'completed' || download.status === 'error') && (
                                        <button
                                            onClick={() => dismissDownload(download.task_id)}
                                            className="p-1 hover:bg-white/10 rounded-full"
                                        >
                                            <X className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
