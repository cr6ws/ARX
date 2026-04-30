import * as React from "react"

import { cn } from "../../lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type} 
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white transition-colors outline-hidden file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-3 focus-visible:ring-white/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-white/25 aria-invalid:ring-3 aria-invalid:ring-white/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
