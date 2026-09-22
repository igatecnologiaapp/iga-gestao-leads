import {
  buildGeoMatrix,
  geoDistanceKm,
  leadsToGeoPoints,
  resolveEndpoints,
  type GeoPoint,
} from "@/lib/routeGeo";
import type { CandidateLead, PlanningPoints } from "@/lib/routePlanning";

/**
 * Fase 3.4 — Geração da SEQUÊNCIA GEOGRÁFICA SUGERIDA.
 *
 * Reutiliza integralmente o motor da Fase 3.3 (validação de coordenadas,
 * distância geográfica aproximada, matriz temporária e formatação). Aqui só é
 * acrescentada a ordenação: Vizinho Mais Próximo + melhoria 2-opt.
 *
 * O resultado NÃO é rota pelas ruas, não é distância de condução e não é tempo
 * de viagem. Nada é gravado no banco e nenhum serviço externo é chamado.
 */

export type SequenceStop = {
  order: number;
  point: GeoPoint;
  lead: CandidateLead;
  /** Distância geográfica aproximada desde a parada anterior (ou da saída). */
  fromPreviousKm: number | null;
};

export type SuggestedSequence = {
  stops: SequenceStop[];
  /** Leads selecionados, incluídos e fora por falta de localização. */
  selectedCount: number;
  includedCount: number;
  skippedCount: number;
  startPoint: GeoPoint | null;
  endPoint: GeoPoint | null;
  startConsidered: boolean;
  endConsidered: boolean;
  /** Origem escolhida quando não há saída com coordenadas. */
  anchorRule: "ponto_de_saida" | "lead_mais_ao_norte";
  totalKm: number | null;
  /** Distância do trecho final até o ponto de retorno, quando considerado. */
  returnKm: number | null;
  initialKm: number | null;
  improvedKm: number | null;
  gainKm: number | null;
  gainPercent: number | null;
  swaps: number;
  nearestMs: number;
  twoOptMs: number;
  totalMs: number;
  /** Assinatura dos dados usados: muda quando o planejamento muda. */
  signature: string;
};

const MAX_TWO_OPT_PASSES = 60;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Regra determinística de origem quando não existe saída com coordenadas:
 * o Lead mais ao norte; empate resolvido pela menor longitude e, por fim, pelo
 * identificador. Nunca depende da ordem retornada pelo banco.
 */
export function pickAnchorIndex(points: GeoPoint[]): number {
  let best = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[best]!;
    if (
      a.latitude > b.latitude ||
      (a.latitude === b.latitude && a.longitude < b.longitude) ||
      (a.latitude === b.latitude && a.longitude === b.longitude && a.id < b.id)
    ) {
      best = i;
    }
  }
  return best;
}

type Dist = (a: GeoPoint, b: GeoPoint) => number;

function makeDist(points: GeoPoint[]): Dist {
  const matrix = buildGeoMatrix(points);
  return (a, b) => {
    const km = matrix.get(a.id, b.id);
    if (km != null) return km;
    return geoDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude) ?? 0;
  };
}

function pathLength(
  order: GeoPoint[],
  start: GeoPoint | null,
  end: GeoPoint | null,
  dist: Dist,
): number {
  let total = 0;
  if (order.length === 0) return 0;
  if (start) total += dist(start, order[0]!);
  for (let i = 1; i < order.length; i += 1) total += dist(order[i - 1]!, order[i]!);
  if (end) total += dist(order[order.length - 1]!, end);
  return total;
}

/**
 * Fase 3.5 — mede QUALQUER ordem (inclusive a definida manualmente pelo usuário)
 * reutilizando o mesmo motor geográfico. Não reordena nada.
 */
export type SequenceMeasurement = {
  /** Distância desde a parada anterior (ou da saída) para cada parada. */
  legs: (number | null)[];
  returnKm: number | null;
  totalKm: number | null;
};

export function measureSequence(
  order: GeoPoint[],
  start: GeoPoint | null,
  end: GeoPoint | null,
): SequenceMeasurement {
  if (order.length === 0) return { legs: [], returnKm: null, totalKm: null };
  const dist = makeDist(order);
  const legs = order.map((point, index) => {
    const previous = index === 0 ? start : order[index - 1]!;
    return previous ? dist(previous, point) : null;
  });
  const last = order[order.length - 1]!;
  const returnKm = end ? dist(last, end) : null;
  return { legs, returnKm, totalKm: pathLength(order, start, end, dist) };
}

/** Sequência inicial: a partir da origem, sempre o ponto ainda não visitado mais próximo. */
export function nearestNeighbor(points: GeoPoint[], start: GeoPoint | null, dist: Dist): GeoPoint[] {
  if (points.length === 0) return [];
  const pending = points.slice();
  const order: GeoPoint[] = [];
  let current: GeoPoint;
  if (start) {
    current = start;
  } else {
    const anchor = pickAnchorIndex(pending);
    current = pending.splice(anchor, 1)[0]!;
    order.push(current);
  }
  while (pending.length > 0) {
    let bestIndex = 0;
    let bestKm = Infinity;
    for (let i = 0; i < pending.length; i += 1) {
      const km = dist(current, pending[i]!);
      // Empate resolvido pelo identificador: resultado determinístico.
      if (km < bestKm || (km === bestKm && pending[i]!.id < pending[bestIndex]!.id)) {
        bestKm = km;
        bestIndex = i;
      }
    }
    current = pending.splice(bestIndex, 1)[0]!;
    order.push(current);
  }
  return order;
}

/**
 * Melhoria 2-opt: inverte trechos da sequência enquanto isso reduzir a distância
 * geográfica total. Nunca aceita uma troca que aumente a distância. Para quando
 * uma passagem completa não encontra melhoria ou ao atingir o limite de passagens.
 */
export function twoOpt(
  order: GeoPoint[],
  start: GeoPoint | null,
  end: GeoPoint | null,
  dist: Dist,
): { order: GeoPoint[]; swaps: number } {
  const result = order.slice();
  const n = result.length;
  let swaps = 0;
  if (n < 4) return { order: result, swaps };
  let improved = true;
  let passes = 0;
  while (improved && passes < MAX_TWO_OPT_PASSES) {
    improved = false;
    passes += 1;
    for (let i = 0; i < n - 1; i += 1) {
      const prev = i === 0 ? start : result[i - 1]!;
      for (let j = i + 1; j < n; j += 1) {
        const next = j === n - 1 ? end : result[j + 1]!;
        const a = result[i]!;
        const b = result[j]!;
        // Avaliação incremental: só as duas ligações das pontas mudam.
        let delta = 0;
        if (prev) delta += dist(prev, b) - dist(prev, a);
        if (next) delta += dist(a, next) - dist(b, next);
        if (delta < -1e-9) {
          for (let x = i, y = j; x < y; x += 1, y -= 1) {
            const tmp = result[x]!;
            result[x] = result[y]!;
            result[y] = tmp;
          }
          swaps += 1;
          improved = true;
        }
      }
    }
  }
  return { order: result, swaps };
}

/** Assinatura do planejamento: qualquer mudança relevante invalida a sequência. */
export function sequenceSignature(selectedLeads: CandidateLead[], points: PlanningPoints): string {
  const leads = selectedLeads
    .map((l) => `${l.id}:${l.latitude ?? ""}:${l.longitude ?? ""}`)
    .sort()
    .join("|");
  const { start, end } = resolveEndpoints(points);
  const p = (g: GeoPoint | null) => (g ? `${g.latitude},${g.longitude}` : "-");
  return `${leads}#${p(start)}#${p(end)}#${points.sameAsStart ? "1" : "0"}`;
}

export function buildSuggestedSequence(
  selectedLeads: CandidateLead[],
  points: PlanningPoints,
): SuggestedSequence {
  const t0 = now();
  const geoPoints = leadsToGeoPoints(selectedLeads);
  const leadById = new Map(selectedLeads.map((l) => [l.id, l]));
  const { start, end } = resolveEndpoints(points);
  const dist = makeDist(geoPoints);

  const t1 = now();
  const initial = nearestNeighbor(geoPoints, start, dist);
  const t2 = now();
  const initialKm = geoPoints.length > 0 ? pathLength(initial, start, end, dist) : null;
  const { order, swaps } = twoOpt(initial, start, end, dist);
  const t3 = now();
  const improvedKm = geoPoints.length > 0 ? pathLength(order, start, end, dist) : null;

  const stops: SequenceStop[] = order.map((point, index) => {
    const previous = index === 0 ? start : order[index - 1]!;
    return {
      order: index + 1,
      point,
      lead: leadById.get(point.id)!,
      fromPreviousKm: previous ? dist(previous, point) : null,
    };
  });

  const last = order[order.length - 1];
  const returnKm = end && last ? dist(last, end) : null;
  const gainKm =
    initialKm != null && improvedKm != null ? Math.max(0, initialKm - improvedKm) : null;

  return {
    stops,
    selectedCount: selectedLeads.length,
    includedCount: geoPoints.length,
    skippedCount: selectedLeads.length - geoPoints.length,
    startPoint: start,
    endPoint: end,
    startConsidered: start != null,
    endConsidered: end != null,
    anchorRule: start ? "ponto_de_saida" : "lead_mais_ao_norte",
    totalKm: improvedKm,
    returnKm,
    initialKm,
    improvedKm,
    gainKm,
    gainPercent: gainKm != null && initialKm ? (gainKm / initialKm) * 100 : null,
    swaps,
    nearestMs: t2 - t1,
    twoOptMs: t3 - t2,
    totalMs: t3 - t0,
    signature: sequenceSignature(selectedLeads, points),
  };
}
