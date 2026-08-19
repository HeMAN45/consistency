import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  hint?: string;
  htmlFor: string;
  /** Turns the hint slot red, so a message sits under the field it concerns. */
  error?: boolean;
  children: React.ReactNode;
};

export function Field({ label, hint, htmlFor, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className={cn(
          "font-data block text-[11px] tracking-widest",
          error ? "text-bad" : "text-muted",
        )}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className={cn("text-xs", error ? "text-bad" : "text-faint")} role={error ? "alert" : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "font-data h-10 w-full rounded-md border border-line bg-void px-3 text-sm text-ink",
        "placeholder:text-faint focus:border-amber focus:outline-none",
        "transition-colors duration-150",
        className,
      )}
      {...props}
    />
  );
}
