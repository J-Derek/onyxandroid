import { useState } from "react";
import { ShieldCheck, Lock, Unlock, KeyRound } from "lucide-react";
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
import { Input } from "@/components/ui/input";

interface HostPinDialogProps {
    onUnlock: (pin: string) => void;
    isHost?: boolean;
}

export default function HostPinDialog({ onUnlock, isHost }: HostPinDialogProps) {
    const [pin, setPin] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length === 4) {
            onUnlock(pin);
            setIsOpen(false);
            setPin("");
        } else {
            toast.error("PIN must be 4 digits");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors"
                >
                    <Lock className="w-3 h-3" />
                    {isHost ? "Set Admin PIN" : "Host Access"}
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-xs rounded-3xl">
                <DialogHeader className="items-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                        <KeyRound className="w-6 h-6 text-primary" />
                    </div>
                    <DialogTitle className="text-white text-center">
                        {isHost ? "Set Host PIN" : "Unlock Host Controls"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-center text-xs">
                        {isHost
                            ? "Set a 4-digit PIN for others to unlock controls. (Host-mode only)"
                            : "Enter the room's 4-digit PIN to gain host privileges."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="flex justify-center">
                        <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="0000"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                            className="bg-zinc-900 border-white/10 text-center text-2xl font-black tracking-[0.5em] h-14 rounded-xl focus:ring-primary/20 focus:border-primary/50"
                            autoFocus
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11"
                    >
                        {isHost ? "Save PIN" : "Unlock Controls"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
