export type VideoCard = {
  id: string;
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: string;
  views?: string;
  description?: string;
  url?: string;
  tags?: string[];
  categories?: string[];
  artist?: string;
  track?: string;
  is_playlist?: boolean;
};

export type Suggestion = {
  title: string;
  uploader?: string;
  url: string;
  thumbnail?: string;
  duration?: string;
};

export type DownloadTask = {
  id: string;
  status: "starting" | "downloading" | "processing" | "completed" | "error";
  percent: number;
  title: string;
  thumbnail?: string;
  filename?: string;
  speed?: string;
  eta?: string;
  error?: string;
  size_mb?: number;
  downloaded_mb?: number;
  location?: string;
  url?: string;
  message?: string;
};

export type QueueItem = {
  id: string;
  url: string;
  format: FormatType;
  quality: string;
  folder_name?: string;
  title?: string;
  thumbnail?: string;
};

export type LibraryFile = {
  name: string;
  path: string;
  size_mb: number;
  type: "audio" | "video";
  modified_at: string;
  source_url?: string;  // Original YouTube URL for re-downloading
  thumbnail?: string;   // Video thumbnail URL
  title?: string;
  artist?: string;
};



export type FormatType = "video" | "audio";

export type QualityOption = {
  value: string;
  label: string;
  type: FormatType;
};

export const VIDEO_QUALITIES: QualityOption[] = [
  { value: "best", label: "Best Quality", type: "video" },
  { value: "1080p", label: "1080p HD", type: "video" },
  { value: "720p", label: "720p HD", type: "video" },
  { value: "480p", label: "480p", type: "video" },
];

export const AUDIO_QUALITIES: QualityOption[] = [
  { value: "320kbps", label: "320 kbps", type: "audio" },
  { value: "192kbps", label: "192 kbps", type: "audio" },
  { value: "128kbps", label: "128 kbps", type: "audio" },
];

export type AudioOutputFormat = "opus" | "mp3" | "m4a" | "flac";

export type OutputFormatOption = {
  value: AudioOutputFormat;
  label: string;
  description: string;
};

export const AUDIO_OUTPUT_FORMATS: OutputFormatOption[] = [
  { value: "opus", label: "Opus", description: "Best quality/size (Recommended)" },
  { value: "mp3", label: "MP3", description: "Most compatible" },
  { value: "m4a", label: "M4A/AAC", description: "Apple compatible" },
  { value: "flac", label: "FLAC", description: "Lossless (Large)" },
];
