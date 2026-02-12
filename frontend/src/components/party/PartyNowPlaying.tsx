import { motion } from "framer-motion";
import { Music } from "lucide-react";
import { usePartyPlayback } from "@/contexts/PartyPlaybackContext";

export default function PartyNowPlaying() {
    const { currentTrack, isPlaying } = usePartyPlayback();

    if (!currentTrack) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-center opacity-40">
                <div className="w-40 h-40 lg:w-48 lg:h-48 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                    <Music className="w-16 h-16 text-muted-foreground/50" />
                </div>
                <h2 className="text-xl font-bold tracking-tight mb-1">Ready for the party?</h2>
                <p className="text-sm text-muted-foreground">Add some music to the queue!</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-4 text-center w-full">
            <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative group mb-8"
            >
                {/* Premium Radial Glow */}
                {isPlaying && (
                    <motion.div
                        className="absolute -inset-10 bg-primary/20 rounded-full blur-[60px] opacity-50"
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                )}

                <div className="relative z-10 w-52 h-52 lg:w-64 lg:h-64 xl:w-72 xl:h-72 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] border border-white/10 group-hover:scale-[1.02] transition-all duration-500">
                    <img
                        src={currentTrack.thumbnail}
                        alt={currentTrack.title}
                        className="w-full h-full object-cover"
                    />
                    {/* Interactive Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                </div>
            </motion.div>

            <motion.div
                key={`${currentTrack.id}-info`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="max-w-full px-4 space-y-4"
            >
                <div>
                    <h2 className="text-xl lg:text-2xl xl:text-3xl font-black mb-1 tracking-tight text-white leading-tight line-clamp-2 drop-shadow-2xl">
                        {currentTrack.title}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="h-px w-8 bg-primary/30" />
                        <span className="text-sm lg:text-base text-primary font-black uppercase tracking-[0.2em] opacity-80">
                            Now Playing
                        </span>
                        <div className="h-px w-8 bg-primary/30" />
                    </div>
                </div>

                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Music className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm lg:text-base text-foreground font-bold truncate max-w-[240px]">
                        {currentTrack.artist}
                    </span>
                </div>
            </motion.div>
        </div>
    );
}
