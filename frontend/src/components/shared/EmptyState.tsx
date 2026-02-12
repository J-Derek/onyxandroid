import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative mb-6"
            >
                <div className="w-20 h-20 rounded-2xl bg-surface-1 border border-white/5 flex items-center justify-center shadow-2xl">
                    <Icon className="w-10 h-10 text-primary/60" />
                </div>
                <div className="absolute inset-0 rounded-2xl gradient-primary blur-3xl opacity-10 -z-10" />
            </motion.div>

            <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">{description}</p>

            {action && (
                <Button variant="gradient" onClick={action.onClick} className="px-8 shadow-lg shadow-primary/20">
                    {action.label}
                </Button>
            )}
        </motion.div>
    );
}
