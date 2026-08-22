import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { pendingClass, type LeadPending } from "@/lib/pendings";

/**
 * Indicador discreto da próxima ação do lead.
 * A cor reforça a informação, mas o texto sozinho já a comunica (acessibilidade).
 */
export function PendingBadge({
  pending,
  compact = false,
  className,
}: {
  pending: LeadPending;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      title={pending.detail}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        pendingClass(pending.tone),
        className,
      )}
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{compact ? pending.label : pending.detail}</span>
    </span>
  );
}
