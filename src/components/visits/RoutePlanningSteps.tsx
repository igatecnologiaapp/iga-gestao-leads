import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ListOrdered,
  LocateFixed,
  MapPin,
  MapPinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/DataState";
import {
  GEO_ISSUE_LABEL,
  geoIssue,
  hasLocation,
  hasUsableCoords,
  isPointDefined,
  leadAddress,
  leadFullAddress,
  type CandidateLead,
  type PlanningPoint,
  type PlanningPoints,
} from "@/lib/routePlanning";
import {
  analyzeProximity,
  formatGeoDistance,
  resolveEndpoints,
  type ProximityAnalysis,
} from "@/lib/routeGeo";
import {
  buildSuggestedSequence,
  measureSequence,
  sequenceSignature,
  type SuggestedSequence,
} from "@/lib/routeSequence";

const NAO_DISPONIVEL = "Não disponível";

/**
 * Fase 3.2 — validação geográfica dos Leads selecionados e definição dos pontos
 * de saída e retorno. Nenhum cálculo de rota, distância ou chamada externa.
 */
export function GeoValidationSection({ selectedLeads }: { selectedLeads: CandidateLead[] }) {
  const located = selectedLeads.filter(hasLocation);
  const pending = selectedLeads.filter((l) => !hasLocation(l));

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">4. Validação geográfica</h2>

      {selectedLeads.length === 0 ? (
        <EmptyState
          title="Nenhum Lead selecionado"
          description="Selecione Leads na etapa anterior para conferir a localização."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Leads selecionados" value={selectedLeads.length} />
            <Stat label="Com localização" value={located.length} tone="success" />
            <Stat label="Sem localização" value={pending.length} tone="warning" />
          </div>

          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Todos os Leads selecionados possuem latitude e longitude utilizáveis.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Os Leads abaixo continuam vinculados às pesquisas e não são alterados. Corrija o endereço na
                Central do Lead e volte aqui para reavaliar.
              </p>
              <ul className="space-y-2">
                {pending.map((lead) => (
                  <li key={lead.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium break-words">{lead.company_name}</span>
                      <Badge variant="outline" className="gap-1 text-warning">
                        <MapPinOff className="h-3 w-3" /> {GEO_ISSUE_LABEL[geoIssue(lead)]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      {leadFullAddress(lead) || NAO_DISPONIVEL}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground break-words">
                      Latitude: {lead.latitude ?? NAO_DISPONIVEL} · Longitude:{" "}
                      {lead.longitude ?? NAO_DISPONIVEL}
                    </p>
                    <Link
                      to="/leads/$id"
                      params={{ id: lead.id }}
                      className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-4"
                    >
                      Corrigir na Central do Lead
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function PointsSection({
  points,
  onChange,
}: {
  points: PlanningPoints;
  onChange: (next: PlanningPoints) => void;
}) {
  function setStart(patch: Partial<PlanningPoint>) {
    onChange({ ...points, start: { ...points.start, ...patch } });
  }
  function setEnd(patch: Partial<PlanningPoint>) {
    onChange({ ...points, end: { ...points.end, ...patch } });
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Localização indisponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: points.start.label.trim() || "Localização atual",
          source: "localizacao_atual",
        });
        toast.success("Localização atual capturada.");
      },
      () => toast.error("Não foi possível obter a localização."),
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">5. Ponto de saída e de retorno</h2>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="p-saida-end">Endereço de saída</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="p-saida-end"
              className="h-11"
              value={points.start.address}
              onChange={(e) => setStart({ address: e.target.value, source: "endereco" })}
              placeholder="Ex.: Rua Fernão Mendes Pinto, 696 — São Paulo/SP"
            />
            <Button type="button" variant="outline" className="h-11 sm:shrink-0" onClick={useCurrentLocation}>
              <LocateFixed className="h-4 w-4" /> Usar localização atual
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-saida-nome">Identificação (opcional)</Label>
          <Input
            id="p-saida-nome"
            className="h-11"
            value={points.start.label}
            onChange={(e) => setStart({ label: e.target.value })}
            placeholder="Ex.: Escritório"
          />
        </div>
        <p className="text-xs text-muted-foreground break-words">
          {hasUsableCoords(points.start.latitude, points.start.longitude)
            ? `Coordenadas do aparelho: ${points.start.latitude?.toFixed(5)}, ${points.start.longitude?.toFixed(5)}`
            : "Sem coordenadas: nesta etapa apenas o endereço é guardado. A conversão em coordenadas será definida na próxima fase."}
        </p>
      </div>

      <div className="space-y-3 border-t pt-3">
        <label className="flex items-start gap-3">
          <Checkbox
            checked={points.sameAsStart}
            onCheckedChange={(v) => onChange({ ...points, sameAsStart: v === true })}
            aria-label="Retornar ao mesmo ponto de saída"
            className="mt-0.5"
          />
          <span className="text-sm">Retornar ao mesmo ponto de saída</span>
        </label>

        {points.sameAsStart ? null : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-retorno-end">Endereço de retorno</Label>
              <Input
                id="p-retorno-end"
                className="h-11"
                value={points.end.address}
                onChange={(e) => setEnd({ address: e.target.value, source: "endereco" })}
                placeholder="Endereço de retorno"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-retorno-nome">Identificação (opcional)</Label>
              <Input
                id="p-retorno-nome"
                className="h-11"
                value={points.end.label}
                onChange={(e) => setEnd({ label: e.target.value })}
                placeholder="Ex.: Casa"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ReadinessSection({
  searchCount,
  consolidated,
  selectedLeads,
  points,
}: {
  searchCount: number;
  consolidated: number;
  selectedLeads: CandidateLead[];
  points: PlanningPoints;
}) {
  const located = selectedLeads.filter(hasLocation).length;
  const pending = selectedLeads.length - located;
  const startOk = isPointDefined(points.start);
  const endOk = points.sameAsStart ? startOk : isPointDefined(points.end);

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">6. Resumo da preparação</h2>
      <dl className="grid gap-1.5 text-sm">
        <Row label="Pesquisas selecionadas" value={String(searchCount)} />
        <Row label="Leads consolidados" value={String(consolidated)} />
        <Row label="Leads selecionados" value={String(selectedLeads.length)} />
        <Row label="Com localização" value={String(located)} />
        <Row label="Sem localização" value={String(pending)} />
        <Row label="Ponto de saída" value={startOk ? "Definido" : "Não definido"} />
        <Row
          label="Ponto de retorno"
          value={
            points.sameAsStart
              ? startOk
                ? "Mesmo da saída"
                : "Não definido"
              : endOk
                ? "Endereço próprio"
                : "Não definido"
          }
        />
      </dl>
      <p className="text-sm" aria-live="polite">
        {located} Lead(s) aptos para a análise geográfica futura.
        {pending > 0 ? ` ${pending} pendente(s) de localização.` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        Nenhuma rota foi calculada e nenhum roteiro foi criado nesta preparação.
      </p>
    </section>
  );
}

/**
 * Fase 3.3 — Análise de proximidade geográfica local.
 * Calcula somente distância geográfica aproximada entre coordenadas. Não é
 * distância pelas ruas, não é tempo de condução e não é sequência de roteiro.
 */
export function ProximitySection({
  selectedLeads,
  points,
}: {
  selectedLeads: CandidateLead[];
  points: PlanningPoints;
}) {
  const [result, setResult] = useState<ProximityAnalysis | null>(null);
  const apt = selectedLeads.filter(hasLocation).length;
  const { start, end } = resolveEndpoints(points);
  const canAnalyze = apt >= 2;

  // A seleção mudou: o resultado anterior deixa de valer.
  useEffect(() => {
    setResult(null);
  }, [selectedLeads, points]);

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <h2 className="text-sm font-semibold">7. Analisar proximidades</h2>
      <p className="text-xs text-muted-foreground">
        Compara a posição dos Leads aptos no mapa para entender quais estão próximos entre si. O resultado é
        uma distância geográfica aproximada (em linha reta), não a distância percorrida pelas ruas.
      </p>

      <dl className="grid gap-1.5 text-sm">
        <Row label="Leads aptos para análise" value={String(apt)} />
        <Row
          label="Ponto de saída"
          value={start ? "Localização válida" : "Não disponível para cálculo"}
        />
        <Row
          label="Ponto de retorno"
          value={end ? "Localização válida" : "Não disponível para cálculo"}
        />
      </dl>

      {start ? null : (
        <p className="text-xs text-muted-foreground">
          O endereço de saída foi guardado apenas como texto. Para participar do cálculo ele precisa de
          coordenadas — hoje isso acontece quando você usa a localização atual do aparelho.
        </p>
      )}

      <Button
        type="button"
        className="h-11 w-full sm:w-auto"
        disabled={!canAnalyze}
        onClick={() => setResult(analyzeProximity(selectedLeads, points))}
      >
        <Ruler className="h-4 w-4" /> Analisar proximidades
      </Button>
      {canAnalyze ? null : (
        <p className="text-xs text-muted-foreground">
          Selecione ao menos dois Leads com localização para analisar as proximidades.
        </p>
      )}

      {result ? (
        <div className="space-y-2 border-t pt-3" aria-live="polite">
          <dl className="grid gap-1.5 text-sm">
            <Row label="Leads analisados" value={String(result.analyzed)} />
            <Row label="Sem localização (fora da análise)" value={String(result.skipped)} />
            <Row label="Método" value="Distância geográfica aproximada" />
            <Row label="Pares comparados" value={String(result.matrix.pairCount)} />
            <Row label="Menor distância entre dois Leads" value={formatGeoDistance(result.matrix.min)} />
            <Row label="Maior distância entre dois Leads" value={formatGeoDistance(result.matrix.max)} />
            <Row
              label="Distância média até o Lead mais próximo"
              value={formatGeoDistance(result.matrix.averageNearest)}
            />
            {result.startAvailable ? (
              <>
                <Row label="Da saída até o Lead mais próximo" value={formatGeoDistance(result.startNearest)} />
                <Row
                  label="Da saída até o Lead mais distante"
                  value={formatGeoDistance(result.startFarthest)}
                />
              </>
            ) : null}
            <Row label="Tempo de cálculo" value={`${Math.max(1, Math.round(result.elapsedMs))} ms`} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Cálculo feito no próprio aparelho, sem serviço externo e sem gravar nada. Nenhuma sequência de
            visitas foi gerada nesta etapa.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Fase 3.4 — Sequência geográfica sugerida (Vizinho Mais Próximo + 2-opt).
 * Fase 3.5 — Revisão e ajuste manual da sequência (ordem, remoção e reinclusão).
 * Proposta temporária baseada apenas em distância geográfica aproximada.
 * Não é rota pelas ruas, não cria roteiro oficial e nada é gravado.
 */
export function SequenceSection({
  selectedLeads,
  points,
}: {
  selectedLeads: CandidateLead[];
  points: PlanningPoints;
}) {
  const [sequence, setSequence] = useState<SuggestedSequence | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const currentSignature = sequenceSignature(selectedLeads, points);
  const outdated = sequence != null && sequence.signature !== currentSignature;
  const apt = selectedLeads.filter(hasLocation).length;
  const canGenerate = apt >= 1;

  function generate() {
    const next = buildSuggestedSequence(selectedLeads, points);
    setSequence(next);
    setOrderIds(next.stops.map((s) => s.point.id));
    setRemovedIds([]);
    setManual(false);
  }

  const stopById = new Map((sequence?.stops ?? []).map((s) => [s.point.id, s]));
  const orderedStops = orderIds.map((id) => stopById.get(id)).filter((s) => s != null);
  const removedStops = removedIds.map((id) => stopById.get(id)).filter((s) => s != null);
  const startPoint = sequence?.startConsidered ? sequence.startPoint : null;
  const endPoint = sequence?.endConsidered ? sequence.endPoint : null;
  const measurement = measureSequence(
    orderedStops.map((s) => s.point),
    startPoint,
    endPoint,
  );
  const difference =
    sequence?.totalKm != null && measurement.totalKm != null
      ? measurement.totalKm - sequence.totalKm
      : null;

  function move(id: string, delta: number) {
    setOrderIds((prev) => {
      const index = prev.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
    setManual(true);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setOrderIds((prev) => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setManual(true);
    setDragId(null);
  }

  function removeStop(id: string) {
    setOrderIds((prev) => prev.filter((x) => x !== id));
    setRemovedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setManual(true);
  }

  /** Regra simples e previsível: o Lead reincluído volta ao final da sequência. */
  function reincludeStop(id: string) {
    setRemovedIds((prev) => prev.filter((x) => x !== id));
    setOrderIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setManual(true);
  }

  function confirmDiscard(): boolean {
    if (!manual) return true;
    return typeof window === "undefined"
      ? true
      : window.confirm("Existem ajustes manuais nesta sequência. Deseja descartá-los?");
  }

  function restore() {
    if (!sequence || !confirmDiscard()) return;
    setOrderIds(sequence.stops.map((s) => s.point.id));
    setRemovedIds([]);
    setManual(false);
  }

  function recalculate() {
    if (!confirmDiscard()) return;
    generate();
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">8. Sequência sugerida e ajuste manual</h2>
        {sequence ? (
          <Badge variant={manual ? "secondary" : "outline"}>
            {manual ? "Ajustada manualmente" : "Sugestão automática"}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Ordem proposta pela proximidade geográfica entre as coordenadas. Não é rota pelas ruas, distância de
        condução nem tempo de viagem. A ordem final é sua: o sistema não refaz a otimização sozinho.
      </p>

      <div className="flex flex-wrap gap-2">
        {sequence ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={restore}
              disabled={!manual}
            >
              <RotateCcw className="h-4 w-4" /> Restaurar sequência sugerida
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:w-auto"
              onClick={recalculate}
              disabled={!canGenerate}
            >
              <RefreshCw className="h-4 w-4" /> Recalcular sugestão
            </Button>
          </>
        ) : (
          <Button type="button" className="h-11 w-full sm:w-auto" disabled={!canGenerate} onClick={generate}>
            <ListOrdered className="h-4 w-4" /> Gerar sequência sugerida
          </Button>
        )}
      </div>
      {canGenerate ? null : (
        <p className="text-xs text-muted-foreground">
          Selecione ao menos um Lead com localização para gerar a sequência.
        </p>
      )}

      {outdated ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          Os dados utilizados para esta sequência foram alterados. É necessário gerar uma nova sequência — seus
          ajustes manuais continuam visíveis até você recalcular.
        </p>
      ) : null}

      {sequence ? (
        <div className="space-y-3 border-t pt-3" aria-live="polite">
          <dl className="grid gap-1.5 text-sm">
            <Row label="Leads selecionados" value={String(sequence.selectedCount)} />
            <Row label="Na sequência atual" value={String(orderedStops.length)} />
            <Row label="Fora da sequência (retirados por você)" value={String(removedStops.length)} />
            <Row
              label="Fora da sequência por falta de localização"
              value={String(sequence.skippedCount)}
            />
            <Row label="Método" value="Proximidade geográfica — Vizinho Mais Próximo + 2-opt" />
            <Row
              label="Sequência sugerida"
              value={`${formatGeoDistance(sequence.totalKm)} geográficos aproximados`}
            />
            <Row
              label="Sequência atual"
              value={`${formatGeoDistance(measurement.totalKm)} geográficos aproximados`}
            />
            {difference != null && Math.abs(difference) >= 0.01 ? (
              <Row
                label="Diferença"
                value={`${difference > 0 ? "+" : "−"} ${formatGeoDistance(Math.abs(difference))}`}
              />
            ) : null}
            <Row
              label="Ponto de saída"
              value={sequence.startConsidered ? "Considerado" : "Não considerado"}
            />
            <Row
              label="Ponto de retorno"
              value={sequence.endConsidered ? "Considerado" : "Não considerado"}
            />
          </dl>

          <p className="text-xs text-muted-foreground">
            Esse valor não representa a quilometragem real de condução. Uma ordem manual maior não é um erro —
            você pode conhecer condições que o cálculo não enxerga.
          </p>

          {sequence.startConsidered ? null : (
            <p className="text-xs text-muted-foreground">
              O ponto de saída não tem coordenadas, então não entrou no cálculo. A sequência mostra apenas a
              proximidade entre os Leads, começando pelo Lead mais ao norte.
            </p>
          )}
          {points.sameAsStart || sequence.endConsidered ? null : (
            <p className="text-xs text-muted-foreground">
              O ponto de retorno foi guardado apenas como endereço em texto e não entrou no cálculo.
            </p>
          )}

          <ol className="space-y-2">
            {startPoint ? (
              <li className="rounded-xl border border-dashed p-3">
                <p className="text-sm font-medium break-words">Saída · {startPoint.label}</p>
                <p className="text-xs text-muted-foreground break-words">
                  {points.start.address || "Localização atual do aparelho"}
                </p>
              </li>
            ) : null}
            {orderedStops.map((stop, index) => (
              <li
                key={stop.point.id}
                className="space-y-1"
                draggable
                onDragStart={() => setDragId(stop.point.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(stop.point.id)}
              >
                {measurement.legs[index] != null ? (
                  <p className="pl-1 text-xs text-muted-foreground">
                    ↓ {formatGeoDistance(measurement.legs[index]!)} (distância geográfica aproximada)
                  </p>
                ) : null}
                <div className="rounded-xl border p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">
                        {index + 1}. {stop.lead.company_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">
                        {leadAddress(stop.lead) || NAO_DISPONIVEL}
                      </p>
                      <Badge variant="outline" className="mt-1 gap-1 text-success">
                        <MapPin className="h-3 w-3" /> Com localização
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      aria-label={`Subir ${stop.lead.company_name}`}
                      disabled={index === 0}
                      onClick={() => move(stop.point.id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      aria-label={`Descer ${stop.lead.company_name}`}
                      disabled={index === orderedStops.length - 1}
                      onClick={() => move(stop.point.id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10"
                      onClick={() => removeStop(stop.point.id)}
                    >
                      <X className="h-4 w-4" /> Remover da sequência
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            {endPoint ? (
              <li className="space-y-1">
                {measurement.returnKm != null ? (
                  <p className="pl-1 text-xs text-muted-foreground">
                    ↓ {formatGeoDistance(measurement.returnKm)} (distância geográfica aproximada)
                  </p>
                ) : null}
                <div className="rounded-xl border border-dashed p-3">
                  <p className="text-sm font-medium break-words">Retorno · {endPoint.label}</p>
                </div>
              </li>
            ) : null}
          </ol>

          {removedStops.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-semibold">Fora da sequência atual</h3>
              <p className="text-xs text-muted-foreground">
                Estes Leads foram apenas retirados deste planejamento. Nada foi excluído ou alterado no
                cadastro.
              </p>
              <ul className="space-y-2">
                {removedStops.map((stop) => (
                  <li key={stop.point.id} className="rounded-xl border p-3">
                    <p className="text-sm font-medium break-words">{stop.lead.company_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground break-words">
                      {leadAddress(stop.lead) || NAO_DISPONIVEL}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-10"
                      onClick={() => reincludeStop(stop.point.id)}
                    >
                      <Plus className="h-4 w-4" /> Reincluir no final
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sequence.skippedCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {sequence.skippedCount} Lead(s) sem localização continuam selecionados e inalterados, apenas fora
              do cálculo — eles não podem entrar na sequência sem coordenadas.
            </p>
          ) : null}

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">
              {manual ? "Sequência revisada — pronta para confirmação" : "Sugestão pronta para revisão"}
            </p>
            <Button type="button" className="h-11 w-full sm:w-auto" disabled>
              9. Confirmar e criar roteiro (próxima fase)
            </Button>
            <p className="text-xs text-muted-foreground">
              Planejamento temporário: nenhum roteiro, parada, visita ou compromisso foi criado.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b pb-1 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="min-w-0 rounded-xl border p-3">
      <p className="text-xs text-muted-foreground break-words">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
