import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Zap, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IGA TECNOLOGIA — Captação e Gestão de Leads" },
      {
        name: "description",
        content:
          "Cadastre leads durante visitas comerciais em segundos: endereço inteligente, campos por segmento e gestão completa.",
      },
      { property: "og:title", content: "IGA TECNOLOGIA — Captação e Gestão de Leads" },
      {
        property: "og:description",
        content:
          "Cadastre leads durante visitas comerciais em segundos: endereço inteligente, campos por segmento e gestão completa.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Zap, title: "Captação em segundos", text: "Formulário enxuto, pensado para o celular durante a visita." },
  { icon: MapPin, title: "Endereço inteligente", text: "Escolha a rua e o bairro é preenchido automaticamente." },
  { icon: BarChart3, title: "Gestão completa", text: "Status, histórico, filtros e indicadores em tempo real." },
  { icon: ShieldCheck, title: "Seguro por perfil", text: "Cada vendedor acessa apenas o que pode ver." },
];

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return <div className="min-h-screen bg-background" />;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-16 sm:py-24">
        <div className="space-y-5">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Captação e gestão de leads
          </span>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
            Cada visita vira um lead <span className="text-primary">em poucos toques</span>
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Plataforma para equipes comerciais que prospectam na rua. Campos dinâmicos por
            segmento, soluções sugeridas automaticamente e indicadores para a gestão.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-7 text-base">
              <Link to="/auth">Entrar no sistema</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-bold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
