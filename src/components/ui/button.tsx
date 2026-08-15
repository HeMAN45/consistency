import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  size?: "sm" | "md";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-amber text-void hover:bg-amber-soft active:bg-amber font-data tracking-tight",
        variant === "ghost" &&
          "border border-line bg-raised text-ink-soft hover:border-line-strong hover:text-ink",
        variant === "quiet" && "text-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
