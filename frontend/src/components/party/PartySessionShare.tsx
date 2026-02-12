import { useState, useMemo } from "react";
import { QrCode, Copy, Check, Users, ShieldCheck, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface PartySessionShareProps {
    sessionId: string;
}

export default function PartySessionShare({ sessionId }: PartySessionShareProps) {
    const [copied, setCopied] = useState(false);

    // Construct the join URL - prefer LAN host from env, otherwise use current origin
    // For LAN testing, set VITE_LAN_HOST=192.168.x.x:3000 in your .env
    const baseUrl = useMemo(() => {
        const lanHost = import.meta.env.VITE_LAN_HOST;
        if (lanHost) {
            return `http://${lanHost}`;
        }
        // Fallback: use current origin (works for localhost or if already on LAN)
        return window.location.origin;
    }, []);

    const joinUrl = `${baseUrl}/party?join=${sessionId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(joinUrl);
        setCopied(true);
        toast.success("Link copied! Share it with friends on your network.");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-primary transition-all shadow-lg"
                    title="Share Party"
                >
                    <Users className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-primary" />
                        Invite Friends
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Anyone with this link can add music to the party. They won't be able to control playback or skip songs.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-6">
                    {/* Real QR Code using API */}
                    <div className="p-6 bg-white rounded-3xl shadow-2xl shadow-primary/20 relative group">
                        <div className="w-48 h-48 bg-white flex items-center justify-center relative overflow-hidden">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&color=0-0-0&bgcolor=FFFFFF`}
                                alt="QR Code"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-xl shadow-lg">
                            <Wifi className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="text-center space-y-1">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Shareable Link</p>
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 group hover:border-primary/30 transition-colors">
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-mono text-zinc-400 truncate lowercase selection:bg-primary/30">
                                        {joinUrl}
                                    </p>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
                                    onClick={handleCopy}
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-500 uppercase tracking-widest font-bold">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Ephemeral Session — No Login Required</span>
                            </div>

                            {joinUrl.includes("localhost") && (
                                <p className="text-[9px] text-amber-500/80 italic text-center px-4">
                                    Tip: Access via your LAN IP (e.g. 192.168.x.x) so this QR works for others!
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pb-2">
                    <Button
                        onClick={handleCopy}
                        className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-14 text-base shadow-lg shadow-primary/20"
                    >
                        {copied ? "Link Copied!" : "Copy Invitation Link"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
