import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={true}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:font-sans",
          description: "group-[.toast]:text-white/60 group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/80",
          success: "group-[.toast]:text-primary",
          error: "group-[.toast]:text-red-400",
          info: "group-[.toast]:text-cyan-400",
          warning: "group-[.toast]:text-amber-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
