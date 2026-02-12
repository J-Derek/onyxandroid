import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { InfoModal } from "../modals/InfoModal";
import { BlinkBlur } from "react-loading-indicators";
import { Download, RefreshCw, TrendingUp, Sparkles, Info, X, Play, User, Eye, Clock } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { SearchWithSuggestions } from "@/components/search/SearchWithSuggestions";
import { FormatSelector } from "../FormatSelector";
import { QualityDropdown } from "../QualityDropdown";
import { VideoCard, VideoCardSkeleton } from "../VideoCard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "../ui/button";
import { VideoPreviewModal } from "../modals/VideoPreviewModal";
import { PlaylistModal } from "../modals/PlaylistModal";
import { ConfirmPlaylistModal } from "../modals/ConfirmPlaylistModal";
import { SlowDownloadWarning } from "../modals/SlowDownloadWarning";
import { toast } from "sonner";
import type { VideoCard as VideoCardType, Suggestion, FormatType, DownloadTask, QueueItem, AudioOutputFormat } from "@/types";
import { VIDEO_QUALITIES, AUDIO_QUALITIES, AUDIO_OUTPUT_FORMATS } from "@/types";
import { api } from "@/lib/api";

interface HomeTabProps {
  onStartDownload: (task: DownloadTask) => void;
  onAddToQueue?: (item: QueueItem) => void;
  onScrollToQueue?: () => void;
  onOpenManual: () => void;
  previewVideo: VideoCardType | null;
  setPreviewVideo: (video: VideoCardType | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  relatedVideos: VideoCardType[];
  setRelatedVideos: (videos: VideoCardType[]) => void;
  isLoadingPreview: boolean;
  setIsLoadingPreview: (loading: boolean) => void;
  isLoadingRelated: boolean;
  setIsLoadingRelated: (loading: boolean) => void;
  // Drag & Drop
  droppedUrl?: string | null;
  onClearDroppedUrl?: () => void;
}

export function HomeTab({
  onStartDownload,
  onAddToQueue,
  onScrollToQueue,
  onOpenManual,
  previewVideo,
  setPreviewVideo,
  isPlaying,
  setIsPlaying,
  relatedVideos,
  setRelatedVideos,
  isLoadingPreview,
  setIsLoadingPreview,
  isLoadingRelated,
  setIsLoadingRelated,
  droppedUrl,
  onClearDroppedUrl,
}: HomeTabProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [format, setFormat] = useState<FormatType>("video");
  const [quality, setQuality] = useState("best");
  const [trending, setTrending] = useState<VideoCardType[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [playlistData, setPlaylistData] = useState<{ title: string; videos: VideoCardType[] } | null>(null);
  const [isCheckingPlaylist, setIsCheckingPlaylist] = useState(false);
  const [showPlaylistConfirm, setShowPlaylistConfirm] = useState(false);
  const [detectedPlaylist, setDetectedPlaylist] = useState<{ title: string; videos: VideoCardType[]; url: string; singleVideo?: VideoCardType } | null>(null);
  const [highlightFormat, setHighlightFormat] = useState(false);
  const [outputFormat, setOutputFormat] = useState<AudioOutputFormat>("opus");
  const [showSlowWarning, setShowSlowWarning] = useState(false);
  const [slowWarningInfo, setSlowWarningInfo] = useState<{ size: number; title: string }>({ size: 40, title: "" });
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRelatedMobile, setShowRelatedMobile] = useState(false);
  const isMobile = useIsMobile();

  const qualityOptions = format === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES;

  useEffect(() => {
    setQuality(qualityOptions[0].value);
  }, [format, qualityOptions]);

  // Handle dropped URL from drag & drop
  useEffect(() => {
    if (droppedUrl) {
      setSearchQuery(droppedUrl);
      onClearDroppedUrl?.();
    }
  }, [droppedUrl, onClearDroppedUrl]);

  // Highlight format selector when preview video loads
  useEffect(() => {
    if (previewVideo) {
      setHighlightFormat(true);
      const timer = setTimeout(() => setHighlightFormat(false), 5000); // Auto-hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [previewVideo]);

  // Load trending videos with caching for instant display
  const loadTrending = useCallback(async (forceRefresh = false) => {
    const CACHE_KEY = "onyx_trending_cache";
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // Try to show cached data instantly
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setTrending(data);
            setIsLoadingTrending(false);
            return; // Use cache, don't fetch
          } else {
            // Show stale cache while loading fresh
            setTrending(data);
          }
        }
      } catch (e) {
        console.warn("Cache read error:", e);
      }
    }

    setIsLoadingTrending(true);
    setError(null);
    try {
      const data = await api.getTrending(forceRefresh);
      setTrending(data);
      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err: unknown) {
      console.error("[TRENDING] Failed to load trending:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      // Don't show toast if we have cached data showing
      if (!trending.length) {
        toast.error("Failed to load trending videos");
      }
    } finally {
      setIsLoadingTrending(false);
    }
  }, [trending.length]);

  useEffect(() => {
    loadTrending();
    // Refresh trending every 5 minutes
    const interval = setInterval(loadTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadTrending]);

  // Helper function to check if text is a YouTube URL
  const isYouTubeUrl = (text: string) => {
    return text.includes("youtube.com") || text.includes("youtu.be");
  };

  // Auto-detect playlist when URL is pasted
  useEffect(() => {
    const checkPlaylist = async () => {
      // Check if it's a YouTube URL (support both youtube.com and youtu.be)
      if (!searchQuery || !isYouTubeUrl(searchQuery)) {
        return;
      }

      // Exit focus mode so user can see what's happening
      setIsSearchFocused(false);

      // Check if it's explicitly a playlist URL (has list= parameter)
      const hasPlaylistParam = searchQuery.includes("list=");

      // If it has list= parameter, treat as playlist
      if (hasPlaylistParam) {
        setIsCheckingPlaylist(true);
        try {
          // Extract video ID if present (for URLs like youtu.be/VIDEO_ID?list=PLAYLIST_ID)
          let videoId = '';
          if (searchQuery.includes('youtu.be/')) {
            videoId = searchQuery.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0] || '';
          } else if (searchQuery.includes('v=')) {
            videoId = searchQuery.split('v=')[1]?.split('&')[0] || '';
          }

          // Fetch playlist info
          const playlist = await api.getPlaylist(searchQuery);

          // If we have a specific video ID, try to fetch its info
          let singleVideo: VideoCardType | undefined;
          if (videoId) {
            try {
              const videoUrl = `https://youtube.com/watch?v=${videoId}`;
              const videoInfo = await api.getVideoInfo(videoUrl);
              singleVideo = {
                id: videoId,
                url: videoUrl,
                title: videoInfo.title,
                thumbnail: videoInfo.thumbnail,
                duration: videoInfo.duration,
              };
            } catch (e) {
              console.error("Failed to get single video info:", e);
            }
          }

          // Show confirmation dialog
          setDetectedPlaylist({
            title: playlist.title,
            videos: playlist.videos,
            url: searchQuery,
            singleVideo,
          });
          setShowPlaylistConfirm(true);
        } catch (error) {
          console.error("Failed to get playlist:", error);
          // Fallback: might be a mix or invalid, just ignore
        } finally {
          setIsCheckingPlaylist(false);
        }
      }

    };

    const timer = setTimeout(checkPlaylist, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-preview single video when URL is pasted
  useEffect(() => {
    const showVideoPreview = async () => {
      // Check if it's a YouTube URL but NOT a playlist
      if (!searchQuery || !isYouTubeUrl(searchQuery)) {
        return;
      }

      // Exit focus mode so user can see what's happening
      setIsSearchFocused(false);

      // Skip if it's a playlist URL (handled by other effect)
      if (searchQuery.includes("list=")) {
        return;
      }

      // Extract video ID from URL
      let videoId = '';
      if (searchQuery.includes('youtu.be/')) {
        videoId = searchQuery.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0] || '';
      } else if (searchQuery.includes('watch?v=')) {
        videoId = searchQuery.split('v=')[1]?.split('&')[0] || '';
      }

      if (!videoId) return;

      // Show loading state
      setIsCheckingPlaylist(true);

      // Show preview for this video
      try {
        const fullInfo = await api.getVideoInfo(searchQuery);
        setPreviewVideo({
          id: videoId,
          url: searchQuery,
          ...fullInfo
        });
        // Replace URL with title for better UX
        setSearchQuery(fullInfo.title);
      } catch (error) {
        console.error("Failed to get video info:", error);
        toast.error("Failed to load video", {
          description: "Please check the URL and try again."
        });
      } finally {
        setIsCheckingPlaylist(false);
      }
    };

    const timer = setTimeout(showVideoPreview, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, setPreviewVideo]);


  // No longer needed: Manual suggestions logic moved to SearchWithSuggestions
  const handleSuggestionSelect = (result: VideoCardType) => {
    console.log('[SUGGESTION] Selection:', result.title);
    setSearchQuery(result.title);
    setIsSearchFocused(false);
    handleVideoClick(result);
  };

  const handleUseLink = (video: VideoCardType) => {
    setSearchQuery(video.title); // Use title instead of URL
    // We need to ensure we have the video info for download
    handleVideoClick(video);
    toast.success("Video selected!");
  };

  const handleDownload = async (manualUrl?: string | React.MouseEvent) => {
    const urlFromArgs = typeof manualUrl === "string" ? manualUrl : undefined;
    const urlToDownload = urlFromArgs || previewVideo?.url || (isYouTubeUrl(searchQuery) ? searchQuery : "");

    if (!urlToDownload) {
      toast.error("Please select a video or enter a YouTube URL");
      return;
    }

    // If playlist is detected, show modal instead
    if (playlistData) {
      return; // Modal will handle download
    }

    // For audio downloads, check if we need to warn about slow download
    if (format === "audio" && previewVideo?.id) {
      try {
        const strategy = await api.checkDownloadStrategy(previewVideo.id);
        if (!strategy.audio_only_available) {
          // Show warning modal
          setSlowWarningInfo({
            size: strategy.estimated_size_mb || 40,
            title: strategy.title || previewVideo?.title || "",
          });
          setPendingDownloadUrl(urlToDownload);
          setShowSlowWarning(true);
          return;
        }
      } catch (err) {
        // If strategy check fails, proceed with download anyway
        console.warn("Strategy check failed, proceeding with download:", err);
      }
    }

    // Proceed with download
    await executeDownload(urlToDownload, urlFromArgs);
  };

  // Execute the actual download (called directly or after user confirms slow warning)
  const executeDownload = async (urlToDownload: string, urlFromArgs?: string) => {
    setIsDownloading(true);

    try {
      const { task_id } = await api.startDownload(
        urlToDownload,
        format,
        quality,
        format === "audio" ? outputFormat : undefined
      );

      const newTask: DownloadTask = {
        id: task_id,
        status: "starting",
        percent: 0,
        title: previewVideo?.title || (urlToDownload.length < 50 ? urlToDownload : "YouTube Video"),
        thumbnail: previewVideo?.thumbnail,
        filename: `downloading...`,
        url: urlToDownload,
      };

      onStartDownload(newTask);
      toast.success("Download started!");
      if (!urlFromArgs) setSearchQuery("");
      onScrollToQueue?.();
    } catch (err: unknown) {
      console.error("Download failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error("Download failed", {
        description: errorMessage || "Please check the URL and try again."
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePlaylistDownload = async (videos: VideoCardType[], folderName: string, format: FormatType, quality: string) => {
    setIsDownloading(true);
    try {
      const urls = videos.map(v => v.url || `https://youtube.com/watch?v=${v.id}`);
      const response = await api.startBatchDownload(
        urls,
        format,
        quality,
        folderName
      );

      for (const task_id of response.task_ids) {
        const newTask: DownloadTask = {
          id: task_id,
          status: "starting",
          percent: 0,
          title: playlistData?.title || "Playlist Video",
          filename: `downloading...`,
        };
        onStartDownload(newTask);
      }

      toast.success(`Started downloading ${response.task_ids.length} videos!`);
      setPlaylistData(null);
      setSearchQuery("");
      onScrollToQueue?.();
    } catch (error) {
      console.error("Batch download failed:", error);
      toast.error("Failed to start batch download.");
    } finally {
      setIsDownloading(false);
    }
  };

  // const [previewVideo, setPreviewVideo] = useState<VideoCardType | null>(null);
  // const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // const [isPlaying, setIsPlaying] = useState(false);

  // const [relatedVideos, setRelatedVideos] = useState<VideoCardType[]>([]);
  // const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const handleAddToQueue = async (video: VideoCardType) => {
    if (!onAddToQueue) {
      toast.error("Queue functionality not available");
      return;
    }

    const queueItem: QueueItem = {
      id: video.id,
      url: video.url || `https://youtube.com/watch?v=${video.id}`,
      format,
      quality,
      title: video.title,
      thumbnail: video.thumbnail,
    };

    onAddToQueue(queueItem);
    toast.success(`"${video.title}" added to queue!`);
  };

  const fetchRelatedVideos = async (video: VideoCardType) => {
    setIsLoadingRelated(true);
    try {
      // Build a search query to find similar individual songs, not mixes/compilations
      let query = '';
      let artistName = '';

      // Extract artist name from video info
      if (video.artist) {
        artistName = video.artist;
      } else if (video.title.includes('-')) {
        // Parse "Artist - Title" pattern common in music videos
        artistName = video.title.split('-')[0].trim();
      }

      if (artistName) {
        // Search for the artist's official videos
        query = `${artistName} official video`;
      } else if (video.categories?.includes("Music")) {
        // For music without clear artist, search similar title terms
        const cleanTitle = video.title
          .replace(/\(.*?\)/g, '') // Remove parenthetical content
          .replace(/\[.*?\]/g, '') // Remove bracketed content
          .replace(/official|video|audio|lyrics|hd|4k/gi, '')
          .trim();
        query = cleanTitle.split(' ').slice(0, 3).join(' ') + ' official video';
      } else if (video.tags && video.tags.length > 0) {
        // Use top tags
        query = video.tags.slice(0, 3).join(' ');
      } else {
        // Fallback to title
        query = video.title;
      }

      // Use the search API to find related videos
      const results = await api.search(query);

      // Filter results to get better quality matches
      const filtered = results
        .filter(v => v.id !== video.id) // Exclude current video
        .filter(v => {
          const title = v.title.toLowerCase();
          // Filter out mixes, compilations, playlists, and long-form content
          const excludePatterns = [
            'mix', 'compilation', 'playlist', 'best of',
            'top 10', 'top 20', 'greatest hits', 'full album',
            'hour', 'hours', 'nonstop', 'non-stop', 'megamix'
          ];
          return !excludePatterns.some(pattern => title.includes(pattern));
        })
        .filter(v => {
          // Parse duration to filter out long videos (likely compilations)
          // Duration is in format "MM:SS" or "H:MM:SS"
          if (!v.duration) return true;
          const parts = v.duration.split(':').map(Number);
          const totalSeconds = parts.length === 3
            ? parts[0] * 3600 + parts[1] * 60 + parts[2]
            : parts[0] * 60 + (parts[1] || 0);
          // Keep videos under 10 minutes
          return totalSeconds < 600;
        })
        .slice(0, 8);

      setRelatedVideos(filtered);
    } catch (error) {
      console.error("Failed to fetch related videos:", error);
    } finally {
      setIsLoadingRelated(false);
    }
  };


  const handleVideoClick = async (video: VideoCardType) => {
    setIsLoadingPreview(true);
    setRelatedVideos([]); // Clear previous related videos
    try {
      // Fetch full video info for preview
      const fullInfo = await api.getVideoInfo(video.url || `https://youtube.com/watch?v=${video.id}`);
      setPreviewVideo({ ...video, ...fullInfo });

      // Fetch related videos using the full info (which now has tags/categories)
      fetchRelatedVideos({ ...video, ...fullInfo });
    } catch (error) {
      console.error('[MODAL] Error fetching video info:', error);
      // Fallback to basic info
      setPreviewVideo(video);
      // Try fetching related with just title if full info failed
      fetchRelatedVideos(video);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;

    // Exit focus mode so user can see results
    setIsSearchFocused(false);

    // If it's a URL, try to preview it
    if (isYouTubeUrl(searchQuery)) {
      return;
    }

    setIsLoadingTrending(true);
    try {
      const results = await api.search(searchQuery);
      setTrending(results);
    } catch (e) {
      console.error("Search failed", e);
      toast.error("Search failed");
    } finally {
      setIsLoadingTrending(false);
    }
  };

  return (
    <div className="space-y-12">
      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative pt-24 pb-12 text-center"
      >
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/20 blur-[100px]" />
        </div>

        <motion.div
          animate={{
            opacity: isSearchFocused ? 0.2 : 1,
            scale: isSearchFocused ? 0.95 : 1,
            filter: isSearchFocused ? "blur(10px)" : "blur(0px)"
          }}
          transition={{ duration: 0.4 }}
          className="space-y-6 mb-10"
        >
          <div className="flex justify-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              Onyx v1.0
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground hover:bg-white/10 transition-colors"
            >
              <Info className="w-4 h-4 text-primary" />
              About Onyx
            </motion.button>
          </div>



          <SectionHeader
            title="Onyx Media Downloader"
            gradientWord="Media"
            subtitle="Paste a link or search for any video. Download in the highest quality, convert to audio, and build your offline library."
            className="text-center"
          />
        </motion.div>

        {/* Search Section */}
        <div className="space-y-6 relative">
          <motion.div
            animate={{
              scale: isSearchFocused ? 1.05 : 1,
              y: isSearchFocused ? -180 : 0,
              zIndex: isSearchFocused ? 50 : 10
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`w-full max-w-2xl mx-auto mb-12 relative ${isSearchFocused ? 'z-[100]' : 'z-20'}`}
          >
            <SearchWithSuggestions
              value={searchQuery}
              onChange={setSearchQuery}
              onSelect={handleSuggestionSelect}
              onSearch={handleSearch}
              onFocusChange={setIsSearchFocused}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: isSearchFocused ? 0.8 : 1,
              y: 0,
              filter: "none",
              pointerEvents: "auto"
            }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 py-6 relative z-10"
          >
            <FormatSelector value={format} onChange={setFormat} highlight={highlightFormat} />
            <QualityDropdown
              options={qualityOptions}
              value={quality}
              onChange={setQuality}
            />
            {/* Output Format Dropdown - Only for Audio */}
            {format === "audio" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: "auto" }}
                exit={{ opacity: 0, scale: 0.9, width: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-1/50"
              >
                <span className="text-xs text-muted-foreground">Format:</span>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as AudioOutputFormat)}
                  className="bg-surface-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-white/10 focus:border-primary focus:outline-none transition-colors cursor-pointer"
                >
                  {AUDIO_OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}
            <Button
              variant="gradient"
              size="xl"
              onClick={handleDownload}
              disabled={isDownloading || !searchQuery || isCheckingPlaylist}
              className="min-w-[180px]"
            >
              {isDownloading || isCheckingPlaylist ? (
                <>
                  <BlinkBlur color="#ffffff" size="small" />
                  <span className="ml-2">{isCheckingPlaylist ? "Checking..." : "Processing..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  {playlistData ? "Manage Playlist" : "Download"}
                </>
              )}
            </Button>
          </motion.div>

          {/* Inline Video Preview Section */}
          <motion.div
            className="max-w-4xl mx-auto mt-12 space-y-8 relative z-[50]"
            animate={{
              opacity: isSearchFocused ? 0.6 : 1,
              filter: "none",
              pointerEvents: "auto"
            }}
          >
            {isLoadingPreview && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl glass border border-white/10 space-y-4"
              >
                <div className="flex gap-4">
                  <div className="w-40 h-24 rounded-lg bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-3/4 bg-white/5 rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-center pt-4">
                  <div className="flex items-center gap-2 text-primary">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </motion.div>
                    <span>Fetching video details...</span>
                  </div>
                </div>
              </motion.div>
            )}

            {previewVideo && !isLoadingPreview && (
              <GlassCard
                className="mb-12 overflow-hidden border-primary/20 bg-surface-1/40 p-8 relative"
                hoverEffect={false}
              >
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 -z-10" />

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Thumbnail / Player */}
                  <div className="relative w-full md:w-96 aspect-video rounded-2xl overflow-hidden shadow-2xl shrink-0 bg-black group/preview">
                    {isPlaying ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${previewVideo.id}?autoplay=1`}
                        title={previewVideo.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0"
                      />
                    ) : (
                      <div className="group/thumb relative w-full h-full cursor-pointer" onClick={() => setIsPlaying(true)}>
                        <img
                          src={previewVideo.thumbnail}
                          alt={previewVideo.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/thumb:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center group-hover/thumb:scale-110 transition-transform">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center pl-1 shadow-xl shadow-primary/20">
                              <Play className="w-6 h-6 text-primary-foreground fill-current" />
                            </div>
                          </div>
                        </div>
                        {previewVideo.duration && (
                          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-md rounded-md text-[10px] font-bold text-white border border-white/10 uppercase tracking-tighter">
                            {previewVideo.duration}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-bold line-clamp-2 md:line-clamp-none mb-3 text-foreground tracking-tight">
                        {previewVideo.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                        <span className="flex items-center gap-2 px-3 py-1 rounded-xl bg-surface-2 border border-white/5 font-medium">
                          <User className="w-4 h-4 text-primary" />
                          {previewVideo.uploader}
                        </span>
                        {previewVideo.views && (
                          <span className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-primary" />
                            {previewVideo.views}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-4">
                      <Button
                        variant="gradient"
                        onClick={() => {
                          const url = previewVideo.url || `https://youtube.com/watch?v=${previewVideo.id}`;
                          handleDownload(url);
                        }}
                        disabled={isDownloading}
                        className="flex-1 md:flex-none px-10 h-11 text-base shadow-xl shadow-primary/20"
                      >
                        {isDownloading ? (
                          <>
                            <BlinkBlur color="#ffffff" size="small" />
                            <span className="ml-2">Starting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5 mr-2" />
                            Download Now
                          </>
                        )}
                      </Button>
                      <Button
                        variant="glass"
                        onClick={() => handleAddToQueue(previewVideo)}
                        className="flex-1 md:flex-none h-11 px-8 border-white/10 hover:border-primary/40 bg-white/5"
                      >
                        Add to Queue
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPreviewVideo(null);
                          setIsPlaying(false);
                          setRelatedVideos([]);
                        }}
                        className="absolute top-4 right-4 md:static md:ml-auto text-muted-foreground hover:text-foreground h-10 w-10 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Related Videos Section */}
            {relatedVideos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-left"
              >
                <SectionHeader
                  title="Related Videos"
                  subtitle={isMobile ? `View All (${relatedVideos.length})` : undefined}
                />
                {!isMobile && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {relatedVideos.map((video, index) => (
                      <div
                        key={video.id}
                        className="group relative rounded-xl overflow-hidden bg-black/20 border border-white/5 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
                        onClick={() => handleVideoClick(video)}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video relative overflow-hidden">
                          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm rounded text-[10px] font-medium text-white">
                            {video.duration}
                          </div>

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                            <Button
                              variant="gradient"
                              size="sm"
                              className="w-full"
                              disabled={isDownloading}
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = video.url || `https://youtube.com/watch?v=${video.id}`;
                                handleDownload(url);
                              }}
                            >
                              {isDownloading ? (
                                <>
                                  <BlinkBlur color="#ffffff" size="small" />
                                  <span className="ml-2">Starting...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </>
                              )}
                            </Button>

                            <Button
                              variant="glass"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToQueue(video);
                              }}
                            >
                              Add to Queue
                            </Button>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          <h4 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{video.title}</h4>
                          <p className="text-xs text-muted-foreground truncate">{video.uploader}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* Trending Section */}
      <motion.section
        className="space-y-6"
        animate={{
          opacity: isSearchFocused ? 0.2 : 1,
          filter: isSearchFocused ? "blur(4px)" : "blur(0px)",
          pointerEvents: isSearchFocused ? "none" : "auto"
        }}
      >

        <div className="flex items-center justify-between mb-6">
          <SectionHeader title="Trending Now" className="mb-0" />
          <Button
            variant="glass"
            size="sm"
            onClick={() => loadTrending(true)}
            disabled={isLoadingTrending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingTrending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {
          error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <p className="font-medium">Error loading trending videos:</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          )
        }

        {
          isLoadingTrending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : trending.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trending.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onUseLink={handleUseLink}
                  onClick={() => handleVideoClick(video)}
                  onAddToQueue={handleAddToQueue}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No trending videos"
              description="Check back later for trending content."
              action={{ label: "Refresh", onClick: loadTrending }}
            />
          )
        }
      </motion.section >

      <ConfirmPlaylistModal
        isOpen={showPlaylistConfirm}
        onClose={() => {
          setShowPlaylistConfirm(false);
          setDetectedPlaylist(null);
        }}
        playlistTitle={detectedPlaylist?.title || ""}
        videoCount={detectedPlaylist?.videos.length || 0}
        singleVideoTitle={detectedPlaylist?.singleVideo?.title}
        onDownloadSingle={() => {
          // Download the specific video from URL if available, otherwise first video
          const videoToDownload = detectedPlaylist?.singleVideo || detectedPlaylist?.videos[0];
          if (videoToDownload) {
            handleVideoClick(videoToDownload);
          }
        }}
        onDownloadPlaylist={() => {
          // Show the full playlist modal
          if (detectedPlaylist) {
            setPlaylistData({
              title: detectedPlaylist.title,
              videos: detectedPlaylist.videos
            });
          }
        }}
      />


      <PlaylistModal
        playlistTitle={playlistData?.title || "Playlist"}
        videos={playlistData?.videos || []}
        isOpen={!!playlistData}
        onClose={() => setPlaylistData(null)}
        onDownloadPlaylist={handlePlaylistDownload}
        onAddToQueue={(video) => {
          // Handle adding single video from playlist to queue
          const queueItem: QueueItem = {
            id: video.id,
            url: video.url || `https://youtube.com/watch?v=${video.id}`,
            format,
            quality,
            title: video.title,
            thumbnail: video.thumbnail,
          };
          onAddToQueue?.(queueItem);
          toast.success("Added to queue");
        }}
      />

      {/* Slow download warning modal */}
      <SlowDownloadWarning
        isOpen={showSlowWarning}
        onClose={() => {
          setShowSlowWarning(false);
          setPendingDownloadUrl(null);
        }}
        onContinue={() => {
          if (pendingDownloadUrl) {
            executeDownload(pendingDownloadUrl);
          }
        }}
        estimatedSizeMB={slowWarningInfo.size}
        title={slowWarningInfo.title}
      />

      {/* Mobile Related Videos Popup */}
      <AnimatePresence>
        {showRelatedMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col pt-20 px-4 pb-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Related Videos
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowRelatedMobile(false)} className="rounded-full h-10 w-10">
                <X className="w-6 h-6" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {relatedVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/10"
                  onClick={() => {
                    handleVideoClick(video);
                    setShowRelatedMobile(false);
                  }}
                >
                  <div className="w-32 aspect-video relative rounded-lg overflow-hidden flex-shrink-0">
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 right-1 px-1 bg-black/60 text-[10px] rounded">
                      {video.duration}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h4>
                      <p className="text-xs text-muted-foreground truncate">{video.uploader}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="glass"
                        size="sm"
                        className="h-7 text-[10px] flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = video.url || `https://youtube.com/watch?v=${video.id}`;
                          handleDownload(url);
                        }}
                      >
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToQueue(video);
                        }}
                      >
                        Queue
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}
