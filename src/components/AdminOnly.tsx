import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/DataState";
import type { ReactNode } from "react";

/**
 * Bloqueia o conteúdo para quem não é administrador.
 * A proteção efetiva dos dados é feita pelas políticas de segurança do banco;
 * este componente evita que telas administrativas sejam abertas por URL direta.
 */
export function AdminOnly({ message, children }: { message: string; children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return <LoadingState />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return <>{children}</>;
}
