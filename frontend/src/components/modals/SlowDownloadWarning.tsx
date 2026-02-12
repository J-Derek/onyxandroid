import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Download, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface SlowDownloadWarningProps {
    isOpen: boolean;
    onClose: () => void;
    onContinue: () => void;
    estimatedSizeMB?: number;
    title?: string;
}

export function SlowDownloadWarning({
    isOpen,
    onClose,
    onContinue,
    estimatedSizeMB = 40,
    title = "your music",
}: SlowDownloadWarningProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[420px] glass border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                        <motion.div
                            animate={{ rotate: [0, 15, -15, 0] }}
                            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                        >
                            <Clock className="w-6 h-6 text-yellow-400" />
                        </motion.div>
                        This might take a moment
                    </DialogTitle>
                    <DialogDescription className="pt-4 text-muted-foreground" asChild>
                        <div className="space-y-4">
                            {/* Simple explanation */}
                            <p className="text-base">
                                We couldn't find a quick audio file for this track,
                                so we'll need to download and convert it for you.
                            </p>

                            {/* Visual indicator */}
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                <AlertCircle className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-foreground">
                                        ~{estimatedSizeMB} MB download
                                    </p>
                                    <p className="text-muted-foreground">
                                        May take 30-60 seconds depending on your connection
                                    </p>
                                </div>
                            </div>

                            {/* Reassurance */}
                            <p className="text-sm text-muted-foreground">
                                Don't worry — you'll still get a high-quality audio file!
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex gap-3 mt-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="gradient"
                        onClick={() => {
                            onContinue();
                            onClose();
                        }}
                        className="flex-1"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
