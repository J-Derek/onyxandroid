import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Download, Home, Clock, ListMusic, Sun, Moon, Book, LogIn, User, Shuffle, Music, PartyPopper, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type TabType = "home" | "queue" | "history" | "media";

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  onOpenManual: () => void;
  queueCount: number;
}

const tabs = [
  { id: "home" as const, label: "Home", icon: Home },
  { id: "queue" as const, label: "Queue", icon: Download },
  { id: "history" as const, label: "History", icon: Clock },
  { id: "media" as const, label: "Media", icon: Music },
];

export function Header({ activeTab, onTabChange, theme, onThemeToggle, onOpenManual, queueCount }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const scrollOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scrollPointerEvents = useTransform(scrollY, (y) => (y > 250 ? "none" : "auto"));

  const opacity = scrollOpacity;
  const pointerEvents = scrollPointerEvents;

  return (
    <>
      {/* 1. Logo Island - Fixed Top Left */}

      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", damping: 20 }}
        style={{ opacity, pointerEvents }}
        className="fixed top-4 left-4 md:top-6 md:left-8 z-50 p-2 md:p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 shadow-2xl md:shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-center">
          <div className="relative group">
            <motion.div
              layout
              className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center transition-all duration-500 relative z-10 cursor-pointer"
              whileHover={{ scale: 1.1 }}
              onClick={() => navigate("/")}
              title="Back to Mode Switcher"
            >
              <motion.img
                src="/onyx-prism-v3.png"
                alt="Onyx Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                animate={{
                  filter: [
                    "brightness(1.0) drop-shadow(0 0 15px rgba(34,211,238,0.4))",
                    "brightness(1.1) drop-shadow(0 0 20px rgba(168,85,247,0.5))",
                    "brightness(1.0) drop-shadow(0 0 15px rgba(34,211,238,0.4))"
                  ]
                }}
                transition={{
                  filter: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
              />

            </motion.div>


            {/* Rhythmic Prism Glow */}
            <motion.div
              className="absolute inset-0 rounded-xl bg-violet-500/20 mix-blend-screen pointer-events-none blur-3xl opacity-30"
              animate={{
                opacity: [0.1, 0.4, 0.1],
                scale: [0.9, 1.3, 0.9],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* 2. Navigation Island - Fixed Bottom on Mobile, Top on Tablet+ */}
      <div className="fixed bottom-6 md:top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <nav className="pointer-events-auto px-2 py-2 rounded-full border border-white/10 bg-black/20 backdrop-blur-xl shadow-2xl flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "text-muted-foreground hover:text-white"
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 gradient-primary rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.id === "queue" && queueCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-white/20 text-white">
                        {queueCount}
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </nav>
        </motion.div>
      </div>

      {/* 3. Theme Toggle Island - Fixed Top Right */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="fixed top-4 right-4 md:top-6 md:right-8 z-50"
      >
        <div className="p-1 rounded-full border border-white/10 bg-black/20 backdrop-blur-xl shadow-2xl flex items-center gap-1">
          {/* Login/Profile Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => user ? logout() : navigate('/login?returnUrl=/download')}
            className={`relative overflow-hidden rounded-full w-10 h-10 ${user
              ? "bg-red-500/20 hover:bg-red-500/40 border border-red-500/30"
              : "hover:bg-white/10"
              }`}
            title={user ? `Sign out (${user.username})` : "Sign in"}
          >
            {user ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
            ) : (
              <LogIn className="w-5 h-5 text-primary" />
            )}
          </Button>

          <div className="w-px h-4 bg-white/10" />

          {/* Switch Mode Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative overflow-hidden rounded-full hover:bg-white/10 px-3 h-10 flex items-center gap-1"
              >
                <Shuffle className="w-4 h-4 text-primary" />
                <span className="text-sm hidden sm:inline">Switch</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Switch Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer">
                <Home className="w-4 h-4 mr-2" />
                Mode Switcher
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/streaming")} className="cursor-pointer">
                <Music className="w-4 h-4 mr-2" />
                Streaming Mode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/party")} className="cursor-pointer">
                <PartyPopper className="w-4 h-4 mr-2" />
                Party Mode
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-white/10" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenManual}
            className="relative overflow-hidden rounded-full hover:bg-white/10 w-10 h-10"
            title="User Manual"
          >
            <Book className="w-5 h-5 text-primary" />
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onThemeToggle}
            className="relative overflow-hidden rounded-full hover:bg-white/10 w-10 h-10"
          >
            <motion.div
              initial={false}
              animate={{ rotate: theme === "dark" ? 0 : 180, scale: [1, 0.8, 1] }}
              transition={{ duration: 0.3 }}
            >
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-500" />
              )}
            </motion.div>
          </Button>
        </div>
      </motion.div>
    </>
  );
}
