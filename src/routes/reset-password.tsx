import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha — IGA TECNOLOGIA" },
      { name: "description", content: "Defina uma nova senha de acesso ao sistema da IGA Tecnologia." },
      { property: "og:title", content: "Nova senha — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso ao sistema da IGA Tecnologia.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // O link de recuperação cria uma sessão temporária de recovery.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setValid(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível alterar a senha: " + error.message);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandMark size="lg" />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Captação e Gestão de Leads
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          {!ready ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <h1 className="text-base font-semibold">Senha alterada com sucesso</h1>
              <p className="text-sm text-muted-foreground">
                Senha alterada com sucesso. Você já pode entrar no sistema.
              </p>
              <Button
                className="h-11 w-full"
                onClick={() => navigate({ to: "/auth", replace: true })}
              >
                Ir para o login
              </Button>
            </div>
          ) : !valid ? (
            <div className="space-y-4 text-center">
              <h1 className="text-base font-semibold">Link inválido ou expirado</h1>
              <p className="text-sm text-muted-foreground">
                Solicite novamente a recuperação de senha na tela de login.
              </p>
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={() => navigate({ to: "/auth", replace: true })}
              >
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <h1 className="text-base font-semibold">Criar nova senha</h1>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
