import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra de paginação padrão das listagens (desktop e celular).
 * Não aparece quando existe apenas uma página, mantendo a tela limpa.
 */
export function PaginationBar({
  page,
  pageCount,
  from,
  to,
  total,
  onPrev,
  onNext,
  label = "registro(s)",
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {from}–{to} de {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-9"
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <span className="text-xs font-semibold">
          {page}/{pageCount}
        </span>
        <Button
          variant="outline"
          className="h-9"
          onClick={onNext}
          disabled={page >= pageCount}
          aria-label="Próxima página"
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
