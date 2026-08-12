import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  id: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function SelectField({ label, id, options, placeholder, className, ...props }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 text-sm transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
