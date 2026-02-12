import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import { toast } from "sonner";

export function useVoteToSkip() {
    const { sessionId, currentTrack, isHost, playNext } = usePartyPlayback();
    const [hasVoted, setHasVoted] = useState(false);
    const [voteInfo, setVoteInfo] = useState<{ votes: number; threshold: number } | null>(null);
    const [userId] = useState(() => {
        // Simple persistent identity for the session (anonymous)
        let id = localStorage.getItem("party_user_id");
        if (!id) {
            // Fallback for crypto.randomUUID (missing on non-secure LAN HTTP)
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                id = crypto.randomUUID();
            } else {
                id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
            localStorage.setItem("party_user_id", id!);
        }
        return id!;
    });

    // Reset vote state when track changes
    useEffect(() => {
        setHasVoted(false);
        setVoteInfo(null);
    }, [currentTrack?.id]);

    const castVote = useCallback(async () => {
        if (!sessionId || !currentTrack || hasVoted || isHost) return;

        try {
            const result = await api.voteToSkip(sessionId, userId);
            if (result.success) {
                setHasVoted(true);
                setVoteInfo({ votes: result.votes, threshold: result.threshold });

                if (result.should_skip) {
                    toast.success("Skip threshold met! Skipping...");
                    // Note: Host will advance automatically via sync, 
                    // but we can show immediate feedback
                } else {
                    toast.info(`Vote cast! ${result.votes}/${result.threshold} to skip.`);
                }
            }
        } catch (err) {
            console.error("Failed to cast vote:", err);
            toast.error("Failed to cast vote");
        }
    }, [sessionId, currentTrack, hasVoted, isHost, userId]);

    return {
        hasVoted,
        voteInfo,
        castVote,
        canVote: !isHost && !!currentTrack && !hasVoted
    };
}
