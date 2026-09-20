import { distanceKm } from "@/lib/visits";
import {
  hasUsableCoords,
  type CandidateLead,
  type PlanningPoint,
  type PlanningPoints,
} from "@/lib/routePlanning";

/**
 * Fase 3.3 — Motor geográfico local.
 *
 * Calcula APENAS distância geográfica aproximada (grande círculo) entre
 * coordenadas válidas. Não representa distância pelas ruas, tempo de condução
 * nem sequência otimizada. Nenhuma API externa é utilizada.
 *
 * A fórmula matemática já existe no projeto (`distanceKm` em src/lib/visits.ts)
 * e é reutilizada aqui — nada é duplicado. Este módulo acrescenta validação,
 * formatação, matriz temporária e memoização.
 */

export type GeoPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

/** Distância geográfica aproximada em km, ou null quando alguma coordenada é inválida. */
export function geoDistanceKm(
  aLat: number | null,
  aLon: number | null,
  bLat: number | null,
  bLon: number | null,
): number | null {
  if (!hasUsableCoords(aLat, aLon) || !hasUsableCoords(bLat, bLon)) return null;
  const km = distanceKm(aLat as number, aLon as number, bLat as number, bLon as number);
  return Number.isFinite(km) ? km : null;
}

/**
 * Precisão adequada para planejamento comercial: metros arredondados a 10 m
 * abaixo de 1 km e uma casa decimal em km. Evita falsa precisão.
 */
export function formatGeoDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "Não disponível";
  if (km < 1) {
    const m = Math.round((km * 1000) / 10) * 10;
    return `${m} m`;
  }
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** Converte os Leads aptos (com coordenadas utilizáveis) em pontos geográficos. */
export function leadsToGeoPoints(leads: CandidateLead[]): GeoPoint[] {
  const points: GeoPoint[] = [];
  for (const lead of leads) {
    if (!hasUsableCoords(lead.latitude, lead.longitude)) continue;
    points.push({
      id: lead.id,
      label: lead.company_name,
      latitude: lead.latitude as number,
      longitude: lead.longitude as number,
    });
  }
  return points;
}

/** Ponto de saída/retorno só é utilizável quando possui coordenadas próprias. */
export function planningPointToGeoPoint(
  point: PlanningPoint,
  id: "saida" | "retorno",
): GeoPoint | null {
  if (!hasUsableCoords(point.latitude, point.longitude)) return null;
  return {
    id,
    label: point.label.trim() || (id === "saida" ? "Ponto de saída" : "Ponto de retorno"),
    latitude: point.latitude as number,
    longitude: point.longitude as number,
  };
}

export function resolveEndpoints(points: PlanningPoints): {
  start: GeoPoint | null;
  end: GeoPoint | null;
} {
  const start = planningPointToGeoPoint(points.start, "saida");
  // "Retornar ao mesmo ponto de saída" reutiliza exatamente as coordenadas da saída.
  const end = points.sameAsStart
    ? start
      ? { ...start, id: "retorno" as const, label: start.label }
      : null
    : planningPointToGeoPoint(points.end, "retorno");
  return { start, end };
}

/**
 * Matriz geográfica temporária (somente em memória). Simétrica: cada par é
 * calculado uma única vez e consultado nas duas direções. Nada é persistido
 * no banco.
 */
export type GeoMatrix = {
  points: GeoPoint[];
  /** Distância em km entre dois ids, ou null quando o par não existe. */
  get: (fromId: string, toId: string) => number | null;
  pairCount: number;
  /** Menor, maior e média das distâncias entre pares distintos. */
  min: number | null;
  max: number | null;
  average: number | null;
  /** Distância média até o vizinho mais próximo de cada ponto. */
  averageNearest: number | null;
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildGeoMatrix(points: GeoPoint[]): GeoMatrix {
  const cache = new Map<string, number>();
  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  let pairCount = 0;

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i]!;
      const b = points[j]!;
      const km = geoDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
      if (km == null) continue;
      cache.set(pairKey(a.id, b.id), km);
      pairCount += 1;
      sum += km;
      if (min == null || km < min) min = km;
      if (max == null || km > max) max = km;
    }
  }

  let nearestSum = 0;
  let nearestCount = 0;
  for (const a of points) {
    let best: number | null = null;
    for (const b of points) {
      if (a.id === b.id) continue;
      const km = cache.get(pairKey(a.id, b.id));
      if (km == null) continue;
      if (best == null || km < best) best = km;
    }
    if (best != null) {
      nearestSum += best;
      nearestCount += 1;
    }
  }

  return {
    points,
    get: (fromId, toId) => (fromId === toId ? 0 : (cache.get(pairKey(fromId, toId)) ?? null)),
    pairCount,
    min,
    max,
    average: pairCount > 0 ? sum / pairCount : null,
    averageNearest: nearestCount > 0 ? nearestSum / nearestCount : null,
  };
}

export type ProximityAnalysis = {
  analyzed: number;
  skipped: number;
  matrix: GeoMatrix;
  startAvailable: boolean;
  endAvailable: boolean;
  /** Distância da saída até o Lead apto mais próximo e mais distante. */
  startNearest: number | null;
  startFarthest: number | null;
  elapsedMs: number;
};

/**
 * Análise de proximidade local. Não gera sequência, não cria roteiro e não
 * chama serviço externo.
 */
export function analyzeProximity(
  selectedLeads: CandidateLead[],
  points: PlanningPoints,
): ProximityAnalysis {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const geoPoints = leadsToGeoPoints(selectedLeads);
  const matrix = buildGeoMatrix(geoPoints);
  const { start, end } = resolveEndpoints(points);

  let startNearest: number | null = null;
  let startFarthest: number | null = null;
  if (start) {
    for (const p of geoPoints) {
      const km = geoDistanceKm(start.latitude, start.longitude, p.latitude, p.longitude);
      if (km == null) continue;
      if (startNearest == null || km < startNearest) startNearest = km;
      if (startFarthest == null || km > startFarthest) startFarthest = km;
    }
  }

  const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    analyzed: geoPoints.length,
    skipped: selectedLeads.length - geoPoints.length,
    matrix,
    startAvailable: start != null,
    endAvailable: end != null,
    startNearest,
    startFarthest,
    elapsedMs: finishedAt - startedAt,
  };
}
