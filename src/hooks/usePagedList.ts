import { useEffect, useMemo, useState } from "react";

/**
 * Paginação em memória compartilhada pelas listagens.
 * Mantém a experiência atual (filtros instantâneos) e evita renderizar
 * centenas de linhas de uma vez quando a base crescer.
 */
export function usePagedList<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Ao filtrar/pesquisar, volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [total]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    pageCount,
    pageItems,
    total,
    from,
    to,
    setPage,
    next: () => setPage((p) => Math.min(p + 1, pageCount)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
