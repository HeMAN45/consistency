import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
};

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="font-data block text-[11px] tracking-widest text-muted"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
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
