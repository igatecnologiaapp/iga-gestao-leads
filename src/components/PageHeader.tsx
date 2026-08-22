import type { ReactNode } from "react";

/**
 * Cabeçalho padrão das páginas: título, descrição opcional e área de ações.
 * Mantém a mesma hierarquia visual e o mesmo comportamento responsivo em todas as telas.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:items-center">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
