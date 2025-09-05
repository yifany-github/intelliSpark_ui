import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Ensure good contrast by providing a dark-default style when none is specified
        const isDefaultDark = !props.className;
        const mergedClassName = isDefaultDark
          ? "bg-zinc-900 border border-zinc-700 text-white"
          : props.className;
        return (
          <Toast key={id} {...props} className={mergedClassName}>
            <div className="grid gap-1">
              {title && <ToastTitle className={isDefaultDark ? "text-white" : undefined}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={isDefaultDark ? "text-zinc-300" : undefined}>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
