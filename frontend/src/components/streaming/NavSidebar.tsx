import { Home, Search, Library, Plus, ListMusic, Music, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlaylists } from "@/contexts/PlaylistContext";

interface NavSidebarProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    className?: string;
}

export default function NavSidebar({ activeTab, setActiveTab, className }: NavSidebarProps) {
    const { playlists, createPlaylist } = usePlaylists();

    const handleCreatePlaylist = async () => {
        const name = `My Playlist #${playlists.length + 1}`;
        await createPlaylist(name);
    };

    return (
        <aside className={cn("flex flex-col gap-2 h-full bg-black p-2", className)}>
            {/* Top Navigation Panel */}
            <div className="bg-[#121212] rounded-xl p-3 space-y-1">
                <NavItem
                    icon={Home}
                    label="Home"
                    active={activeTab === "home"}
                    onClick={() => setActiveTab("home")}
                />
                <NavItem
                    icon={Search}
                    label="Search"
                    active={activeTab === "search"}
                    onClick={() => setActiveTab("search")}
                />
            </div>

            {/* Library Panel */}
            <div className="flex-1 bg-[#121212] rounded-xl overflow-hidden flex flex-col">
                <div className="p-4 flex items-center justify-between">
                    <button
                        onClick={() => setActiveTab("library")}
                        className="flex items-center gap-3 text-muted-foreground hover:text-white transition-colors group"
                    >
                        <Library className="w-6 h-6" />
                        <span className="font-bold text-sm">Your Library</span>
                    </button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-white"
                        onClick={handleCreatePlaylist}
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>

                {/* Library Scrollers/Filters */}
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                    <LibraryFilter label="Playlists" />
                    <LibraryFilter label="Artists" />
                    <LibraryFilter label="Albums" />
                </div>

                {/* Library content */}
                <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
                    <SidebarItem
                        icon={Heart}
                        iconContainerClass="bg-gradient-to-br from-indigo-500 to-cyan-300"
                        label="Liked Songs"
                        subtitle="Playlist • Favorites"
                        active={activeTab === "library"}
                        onClick={() => setActiveTab("library")}
                    />

                    {playlists.map((playlist) => (
                        <SidebarItem
                            key={playlist.id}
                            icon={ListMusic}
                            iconContainerClass="bg-[#1DB954]"
                            label={playlist.name}
                            subtitle={`Playlist • ${playlist.track_count} tracks`}
                            active={false}
                            onClick={() => {
                                setActiveTab("library");
                                // Here we would ideally set the selected playlist in LibraryView
                            }}
                        />
                    ))}
                </div>
            </div>
        </aside>
    );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 px-3 py-3 w-full rounded-lg transition-colors font-bold text-sm",
                active ? "text-white" : "text-muted-foreground hover:text-white"
            )}
        >
            <Icon className="w-6 h-6" />
            {label}
        </button>
    );
}

function LibraryFilter({ label }: { label: string }) {
    return (
        <button className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors">
            {label}
        </button>
    );
}

function SidebarItem({
    icon: Icon,
    label,
    subtitle,
    active,
    onClick,
    iconContainerClass
}: {
    icon: any,
    label: string,
    subtitle: string,
    active: boolean,
    onClick: () => void,
    iconContainerClass?: string
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-2 w-full rounded-lg transition-colors group",
                active ? "bg-white/10" : "hover:bg-white/5"
            )}
        >
            <div className={cn("w-12 h-12 rounded-md flex items-center justify-center shrink-0 overflow-hidden", iconContainerClass || "bg-white/5")}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 text-left">
                <p className={cn("font-bold text-sm truncate", active ? "text-[#1DB954]" : "text-white")}>
                    {label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
        </button>
    );
}
