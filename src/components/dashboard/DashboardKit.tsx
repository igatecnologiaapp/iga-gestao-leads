import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Padrão único de indicador do Dashboard.
 * Todo quadro é um botão acessível (teclado + leitor de tela) que expande o
 * detalhamento correspondente logo abaixo da seção.
 */
export function MetricCard({
  id,
  label,
  value,
  hint,
  icon: Icon,
  toneClass,
  expandedId,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Classe semântica opcional (ex.: pendências). A cor nunca é a única pista. */
  toneClass?: string;
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}) {
  const expanded = expandedId === id;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`detalhe-${id}`}
      onClick={() => onToggle(expanded ? null : id)}
      className={cn(
        "min-h-[92px] rounded-2xl border p-4 text-left shadow-[var(--shadow-card)] transition-colors",
        toneClass ?? "bg-card",
        expanded ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] opacity-80">
          {hint ?? (expanded ? "Ocultar detalhes" : "Ver detalhes")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </div>
    </button>
  );
}

/** Painel de detalhamento exibido ao expandir um indicador. */
export function DetailPanel({
  id,
  title,
  description,
  onClose,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      id={`detalhe-${id}`}
      className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhamento"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border hover:bg-muted"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Mensagem padrão de ausência de dados dentro de um detalhamento. */
export function NoData({ text }: { text?: string | undefined }) {
  return (
    <p className="py-4 text-sm text-muted-foreground">
      {text ?? "Nenhum registro para este indicador."}
    </p>
  );
}

export type Group = { key: string; name: string; count: number; extra?: string; items: ReactNode };

/** Lista de grupos expansíveis (segmentos, status, colaboradores). */
export function GroupList({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!groups.length) return <NoData />;
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.key} className="rounded-xl border">
          <button
            type="button"
            aria-expanded={open === g.key}
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{g.name}</span>
              {g.extra ? (
                <span className="block truncate text-xs text-muted-foreground">{g.extra}</span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm font-bold">
              {g.count}
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 transition-transform", open === g.key && "rotate-180")}
              />
            </span>
          </button>
          {open === g.key ? <div className="border-t">{g.items}</div> : null}
        </li>
      ))}
    </ul>
  );
}
