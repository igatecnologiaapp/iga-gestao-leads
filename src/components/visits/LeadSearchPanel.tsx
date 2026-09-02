import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Globe, Search, Download, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/Combobox";
import { EmptyState, LoadingState } from "@/components/DataState";
import { AddToRouteDialog } from "@/components/visits/AddToRouteDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSegments } from "@/lib/queries";
import { useLeadsLite } from "@/lib/visitQueries";
import { findDuplicate } from "@/lib/visits";
import { searchPlaces, type PlaceResult } from "@/lib/leadSearch.functions";

const NAO_DISPONIVEL = "Não disponível";

export function LeadSearchPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runSearch = useServerFn(searchPlaces);
  const { data: segments = [] } = useSegments();
  const { data: leads = [] } = useLeadsLite();

  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [city, setCity] = useState("São Paulo");
  const [state, setState] = useState("SP");
  const [region, setRegion] = useState("");
  const [radiusKm, setRadiusKm] = useState("3");
  const [limit, setLimit] = useState("30");

  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [routeOpen, setRouteOpen] = useState(false);

  const segment = segments.find((s) => s.id === segmentId) ?? null;

  const analyzed = useMemo(
    () => results.map((r) => ({ place: r, duplicate: findDuplicate(r, leads) })),
    [results, leads],
  );

  async function handleSearch() {
    if (!segment) {
      toast.error("Selecione o segmento.");
      return;
    }
    if (city.trim().length < 2) {
      toast.error("Informe a cidade.");
      return;
    }
    setLoading(true);
    setSelected(new Set());
    setImportedIds([]);
    try {
      const res = await runSearch({
        data: {
          segment: segment.name,
          city: city.trim(),
          state: state.trim().toUpperCase() || null,
          region: region.trim() || null,
          radiusKm: Number(radiusKm) || 3,
          limit: Number(limit) || 30,
        },
      });
      setProvider(res.provider);
      setResults(res.results);
      setMessage(res.message ?? null);
      if (res.results.length === 0 && !res.message) {
        setMessage("Nenhum estabelecimento encontrado para este segmento e região.");
      }
    } catch {
      toast.error("Falha ao consultar o serviço de pesquisa.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const selectable = analyzed.filter((a) => !a.duplicate).map((a) => a.place.externalId);
    setSelected((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable)));
  }

  async function importSelected() {
    if (!user || !segment) return;
    const chosen = analyzed.filter((a) => selected.has(a.place.externalId) && !a.duplicate);
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um estabelecimento novo.");
      return;
    }
    setImporting(true);
    try {
      const now = new Date().toISOString();
      const rows = chosen.map(({ place }) => ({
        company_name: place.name,
        phone: place.phone,
        segment_id: segment.id,
        street_name: place.street,
        number: place.number,
        neighborhood_name: place.neighborhood ?? (region.trim() || null),
        city: place.city ?? city.trim(),
        state: place.state ?? state.trim().toUpperCase(),
        postal_code: place.postalCode,
        latitude: place.latitude,
        longitude: place.longitude,
        website: place.website,
        status: "novo" as const,
        created_by: user.id,
        source: "pesquisa_regiao",
        source_provider: provider,
        source_external_id: place.externalId,
        source_searched_at: now,
        source_region: [region.trim(), city.trim(), state.trim().toUpperCase()]
          .filter(Boolean)
          .join(", "),
      }));
      const { data, error } = await supabase.from("leads").insert(rows).select("id");
      if (error) throw error;
      setImportedIds((data ?? []).map((d) => d.id));
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${rows.length} Lead(s) importado(s) para o Gestão de Leads.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="seg">Segmento</Label>
            <Combobox
              id="seg"
              options={segments.map((s) => ({ value: s.id, label: s.name }))}
              value={segmentId}
              onChange={setSegmentId}
              placeholder="Selecione o segmento"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="regiao">Bairro / região</Label>
            <Input id="regiao" className="h-11" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ex.: Parque Boturussu" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" className="h-11" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="uf">UF</Label>
            <Input id="uf" className="h-11" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="raio">Raio (km)</Label>
            <Input id="raio" className="h-11" type="number" min={0.5} max={20} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qtd">Quantidade</Label>
            <Input id="qtd" className="h-11" type="number" min={1} max={60} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3 h-12 w-full text-base font-semibold sm:w-auto" onClick={handleSearch} disabled={loading}>
          <Search className="h-5 w-5" /> {loading ? "Pesquisando..." : "PESQUISAR LEADS"}
        </Button>
        {provider ? (
          <p className="mt-2 text-xs text-muted-foreground">Fonte de dados: {provider}</p>
        ) : null}
      </section>

      {loading ? <LoadingState label="Consultando estabelecimentos..." /> : null}

      {!loading && message ? (
        <EmptyState title="Sem resultados" description={message} />
      ) : null}

      {!loading && analyzed.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              Selecionar todos os novos
            </Button>
            <span className="text-xs text-muted-foreground">
              {analyzed.length} encontrados · {analyzed.filter((a) => a.duplicate).length} já cadastrados · {selected.size} selecionados
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {analyzed.map(({ place, duplicate }) => (
              <article key={place.externalId} className="rounded-2xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    className="mt-1"
                    aria-label={`Selecionar ${place.name}`}
                    disabled={!!duplicate}
                    checked={selected.has(place.externalId)}
                    onCheckedChange={() => toggle(place.externalId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{place.name}</p>
                    <Badge
                      variant="outline"
                      className={duplicate ? "mt-1 border-warning/40 bg-warning/15" : "mt-1 border-success/30 bg-success/15 text-success"}
                    >
                      {duplicate ? `Já cadastrado — ${duplicate.reason}` : "Novo lead"}
                    </Badge>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {[
                            [place.street, place.number].filter(Boolean).join(", "),
                            place.neighborhood,
                            [place.city, place.state].filter(Boolean).join("/"),
                            place.postalCode,
                          ]
                            .filter(Boolean)
                            .join(" · ") || NAO_DISPONIVEL}
                        </span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {place.phone ?? NAO_DISPONIVEL}
                        {place.whatsapp ? ` · WhatsApp: ${place.whatsapp}` : ""}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{place.website ?? NAO_DISPONIVEL}</span>
                      </li>
                      <li>
                        Distância: {place.distanceKm != null ? `${place.distanceKm} km` : NAO_DISPONIVEL} ·
                        Coordenadas: {place.latitude != null ? `${place.latitude.toFixed(5)}, ${place.longitude?.toFixed(5)}` : NAO_DISPONIVEL}
                      </li>
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="sticky bottom-16 z-10 flex flex-wrap gap-2 rounded-2xl border bg-background/95 p-3 backdrop-blur md:bottom-0">
            <Button className="h-12 flex-1 text-base font-semibold sm:flex-none" onClick={importSelected} disabled={importing || selected.size === 0}>
              <Download className="h-5 w-5" /> IMPORTAR LEADS SELECIONADOS
            </Button>
            {importedIds.length > 0 ? (
              <>
                <Button variant="secondary" className="h-12" onClick={() => setRouteOpen(true)}>
                  <RouteIcon className="h-5 w-5" /> Adicionar ao roteiro ({importedIds.length})
                </Button>
                <Button variant="ghost" asChild className="h-12">
                  <Link to="/leads">Ver Leads</Link>
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      <AddToRouteDialog leadIds={importedIds} open={routeOpen} onOpenChange={setRouteOpen} />
    </div>
  );
}
