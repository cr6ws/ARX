import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-white/10 px-3 py-1 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-3 focus-visible:ring-white/20 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-white/25 aria-invalid:ring-3 aria-invalid:ring-white/15 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-white/10 text-white/85",
        secondary:
          "bg-white/10 text-white/75",
        destructive:
          "border-white/20 bg-white/10 text-white focus-visible:ring-white/20",
        outline: "border-white/10 bg-transparent text-white/80",
        ghost: "bg-white/5 text-white/75 hover:bg-white/10",
        link: "text-white underline-offset-4 hover:underline",
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
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
