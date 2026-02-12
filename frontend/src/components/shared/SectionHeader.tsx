import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    title: string;
    gradientWord?: string;
    subtitle?: string;
    className?: string;
}

export function SectionHeader({ title, gradientWord, subtitle, className }: SectionHeaderProps) {
    const parts = title.split(gradientWord || "");

    return (
        <div className={cn("mb-6", className)}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                {gradientWord ? (
                    <>
                        {parts[0]}
                        <span className="gradient-text">{gradientWord}</span>
                        {parts[1]}
                    </>
                ) : (
                    title
                )}
            </h2>
            {subtitle && (
                <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
