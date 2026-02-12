import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PlaybackProvider } from "./contexts/PlaybackContext";
import { CacheProvider } from "./contexts/CacheContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { PlayerProvider } from "./contexts/PlayerContext";
import { PlaylistProvider } from "./contexts/PlaylistContext";
import { FloatingPlayer } from "./components/FloatingPlayer";
import { DynamicThemeHandler } from "./components/DynamicThemeHandler";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ModeSwitcher from "./pages/ModeSwitcher";
import Login from "./pages/Login";
import ProfileSelector from "./pages/ProfileSelector";
import StreamingMode from "./pages/StreamingMode";
import PartyMode from "./pages/PartyMode";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CacheProvider>
        <PlaybackProvider>
          <FavoritesProvider>
            <PlayerProvider>
              <PlaylistProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Routes>
                      {/* Mode Switcher - Entry Point */}
                      <Route path="/" element={<ModeSwitcher />} />

                      {/* Download Mode - Original Onyx */}
                      <Route path="/download" element={<Index />} />

                      {/* Streaming Mode - New Experience */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/streaming" element={<ProfileSelector />} />
                      <Route path="/streaming/*" element={<StreamingMode />} />


                      {/* Party Mode - Anonymous Queue */}
                      <Route path="/party" element={<PartyMode />} />
                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    {/* Global Floating Player - inside Router for useLocation */}
                    <FloatingPlayer />
                  </BrowserRouter>
                  {/* Dynamic Theme Engine */}
                  <DynamicThemeHandler />
                </TooltipProvider>
              </PlaylistProvider>
            </PlayerProvider>
          </FavoritesProvider>
        </PlaybackProvider>
      </CacheProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
