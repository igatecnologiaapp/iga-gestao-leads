import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — IGA TECNOLOGIA" },
      { name: "description", content: "Acesse o sistema de captação e gestão de leads da IGA Tecnologia." },
      { property: "og:title", content: "Entrar — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Acesse o sistema de captação e gestão de leads da IGA Tecnologia.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("invalid")
          ? "E-mail ou senha inválidos."
          : "Não foi possível entrar: " + error.message,
      );
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function recover(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(recoverEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Resposta neutra: nunca revelar se o e-mail existe.
    setRecoverSent(true);
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
          {mode === "login" ? (
            <form className="space-y-4" onSubmit={signIn}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto w-full p-0 text-sm"
                onClick={() => {
                  setRecoverEmail(email);
                  setRecoverSent(false);
                  setMode("recover");
                }}
              >
                Esqueci minha senha
              </Button>
            </form>
          ) : recoverSent ? (
            <div className="space-y-4 text-center">
              <h2 className="text-base font-semibold">Verifique seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                Se o e-mail estiver cadastrado, enviaremos as instruções para recuperação da
                senha.
              </p>
              <Button variant="outline" className="h-11 w-full" onClick={() => setMode("login")}>
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={recover}>
              <h2 className="text-base font-semibold">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground">
                Informe seu e-mail para receber as instruções de recuperação de senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="recover-email">E-mail</Label>
                <Input
                  id="recover-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar instruções"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full"
                onClick={() => setMode("login")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          O acesso é liberado pelo administrador do sistema.
        </p>
      </div>
    </main>
  );
}
