/**
 * System Notifications utility
 * Uses the browser's Notification API to show desktop notifications
 */

// Check if notifications are supported
export const isNotificationSupported = (): boolean => {
    return "Notification" in window;
};

// Get current permission status
export const getNotificationPermission = (): NotificationPermission | "unsupported" => {
    if (!isNotificationSupported()) {
        return "unsupported";
    }
    return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!isNotificationSupported()) {
        console.warn("Notifications not supported in this browser");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        console.warn("Notification permission was denied");
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    } catch (error) {
        console.error("Failed to request notification permission:", error);
        return false;
    }
};

// Show a download complete notification
export const showDownloadCompleteNotification = (
    title: string,
    options?: {
        thumbnail?: string;
        filename?: string;
        onClick?: () => void;
    }
): void => {
    if (!isNotificationSupported() || Notification.permission !== "granted") {
        return;
    }

    const notification = new Notification(`✓ Download Complete`, {
        body: title,
        icon: options?.thumbnail || "/favicon.ico",
        tag: "download-complete",
        requireInteraction: false,
        silent: false,
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    if (options?.onClick) {
        notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
        };
    }
};

// Show a download failed notification
export const showDownloadFailedNotification = (title: string): void => {
    if (!isNotificationSupported() || Notification.permission !== "granted") {
        return;
    }

    const notification = new Notification(`✗ Download Failed`, {
        body: title,
        icon: "/favicon.ico",
        tag: "download-failed",
        requireInteraction: false,
    });

    setTimeout(() => notification.close(), 5000);
};
