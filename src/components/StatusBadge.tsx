import { statusClass, statusLabel } from "@/lib/leads";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        statusClass(status),
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
