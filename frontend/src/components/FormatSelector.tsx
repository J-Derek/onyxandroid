import { motion, AnimatePresence } from "framer-motion";
import { Video, Music, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormatType } from "@/types";

interface FormatSelectorProps {
  value: FormatType;
  onChange: (format: FormatType) => void;
  highlight?: boolean;
}

export function FormatSelector({ value, onChange, highlight = false }: FormatSelectorProps) {
  const formats = [
    { id: "video" as const, label: "Video", icon: Video },
    { id: "audio" as const, label: "Audio", icon: Music },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className={cn(
          "relative flex items-center gap-2 p-1 rounded-xl bg-surface-1/50 transition-all",
          highlight && "ring-2 ring-primary/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        )}
        animate={highlight ? {
          scale: [1, 1.05, 1],
          boxShadow: [
            "0 0 0 rgba(34,211,238,0)",
            "0 0 25px rgba(34,211,238,0.4)",
            "0 0 0 rgba(34,211,238,0)"
          ]
        } : {}}
        transition={{ duration: 1.5, repeat: highlight ? 2 : 0 }}
      >
        {formats.map((format) => {
          const Icon = format.icon;
          const isActive = value === format.id;
          return (
            <motion.button
              key={format.id}
              onClick={() => onChange(format.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFormat"
                  className={cn(
                    "absolute inset-0 rounded-lg",
                    format.id === "video" ? "gradient-primary" : "gradient-accent"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {format.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Hint text with sparkle when highlighted */}
      <AnimatePresence>
        {highlight && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-1.5 text-xs text-primary font-medium"
          >
            <Sparkles className="w-3 h-3" />
            <span>Select your format before downloading</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
