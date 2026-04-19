import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap transition-colors duration-150 focus-visible:focus-ring has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-foreground/80",
        accent: "bg-accent/10 text-accent border border-accent/20",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        outline: "border border-border text-foreground/80 bg-card",
        ghost: "hover:bg-muted text-foreground/70",
        link: "text-accent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
