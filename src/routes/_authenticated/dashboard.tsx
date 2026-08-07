import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, TrendingUp, Users2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LEAD_STATUSES, statusLabel } from "@/lib/leads";
import { StatusBadge } from "@/components/StatusBadge";
import { useSegments, useProducts } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LeadField" },
      { name: "description", content: "Indicadores de captação de leads por período, segmento e status." },
      { property: "og:title", content: "Dashboard — LeadField" },
      { property: "og:description", content: "Indicadores de captação de leads por período, segmento e status." },
    ],
  }),
  component: Dashboard,
});

type LeadRow = {
  id: string;
  company_name: string;
  status: string;
  segment_id: string | null;
  created_at: string;
  neighborhood_name: string | null;
};

function Dashboard() {
  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, status, segment_id, created_at, neighborhood_name")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });

  const { data: leadProducts = [] } = useQuery({
    queryKey: ["lead_products", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_products").select("product_id, lead_id");
      if (error) throw error;
      return data as { product_id: string; lead_id: string }[];
    },
  });


  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const week = now.getTime() - 7 * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const total = leads.length;
  const today = leads.filter((l) => new Date(l.created_at).getTime() >= startOfDay).length;
  const last7 = leads.filter((l) => new Date(l.created_at).getTime() >= week).length;
  const month = leads.filter((l) => new Date(l.created_at).getTime() >= startOfMonth).length;

  const bySegment = segments
    .map((s) => ({ name: s.name, value: leads.filter((l) => l.segment_id === s.id).length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const byStatus = LEAD_STATUSES.map((s) => ({
    name: s.label,
    value: leads.filter((l) => l.status === s.value).length,
  })).filter((d) => d.value > 0);

  const activeLeadIds = new Set(leads.map((l) => l.id));
  const activeLeadProducts = leadProducts.filter((lp) => activeLeadIds.has(lp.lead_id));

  const topProducts = products
    .map((p) => ({
      name: p.name,
      value: activeLeadProducts.filter((lp) => lp.product_id === p.id).length,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);


  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  const cards = [
    { label: "Total de leads", value: total, icon: Users2 },
    { label: "Leads hoje", value: today, icon: Zap },
    { label: "Últimos 7 dias", value: last7, icon: CalendarDays },
    { label: "No mês", value: month, icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da captação.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 shrink-0 text-primary" />
            </div>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Leads por segmento</h2>
          <div className="mt-4 h-64">
            {bySegment.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySegment} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Leads por status</h2>
          <div className="mt-4 h-64">
            {byStatus.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {byStatus.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {byStatus.map((s) => (
              <span key={s.name} className="text-[11px] text-muted-foreground">
                {s.name}: <strong className="text-foreground">{s.value}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Top soluções indicadas</h2>
          <div className="mt-4 h-56">
            {topProducts.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={130} fontSize={11} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Últimos leads</h2>
          <ul className="mt-3 divide-y">
            {leads.slice(0, 6).map((l) => (
              <li key={l.id}>
                <Link
                  to="/leads/$id"
                  params={{ id: l.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l.company_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.neighborhood_name ?? "Sem bairro"} · {statusLabel(l.status)}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
            {!leads.length && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nenhum lead captado ainda.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Sem dados suficientes
    </div>
  );
}
