import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const actionButtonVariants = cva(
  "inline-flex items-center justify-center font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-100",
        outline: "border border-border bg-card text-foreground hover:bg-secondary",
        dark: "bg-foreground text-background hover:bg-primary",
        ghost: "text-foreground hover:text-primary",
      },
      size: {
        sm: "rounded-full px-4 py-2 text-sm",
        md: "rounded-xl px-5 py-2.5 text-sm",
        lg: "rounded-2xl px-8 py-4 text-lg",
        block: "w-full rounded-2xl px-6 py-3.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof actionButtonVariants>;

export function ActionButton({ className, variant, size, ...props }: ActionButtonProps) {
  return <button className={cn(actionButtonVariants({ variant, size }), className)} {...props} />;
}