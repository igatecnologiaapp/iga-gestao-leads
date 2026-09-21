import { buildSuggestedSequence } from "@/lib/routeSequence";
import type { CandidateLead, PlanningPoints } from "@/lib/routePlanning";

function lead(i: number, lat: number | null, lon: number | null): CandidateLead {
  return { id: `l${i}`, company_name: `E${i}`, contact_name: null, phone: null, status: "novo", segment_id: null, street_name: "R", number: "1", neighborhood_name: "B", city: "São Paulo", state: "SP", postal_code: null, latitude: lat, longitude: lon, next_contact_date: null, created_by: "u", search_id: null, deleted_at: null };
}
const pts = (start: any, same = true, end: any = null): PlanningPoints => ({
  start: { label: "", address: "", latitude: start?.[0] ?? null, longitude: start?.[1] ?? null, source: start ? "localizacao_atual" : "endereco" },
  sameAsStart: same,
  end: { label: "", address: "", latitude: end?.[0] ?? null, longitude: end?.[1] ?? null, source: end ? "localizacao_atual" : "endereco" },
});
function gen(n: number) {
  let s = 42;
  const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: n }, (_, i) => lead(i, -23.5 - r() * 0.2, -46.5 - r() * 0.2));
}
for (const n of [10, 30, 50, 100, 200]) {
  const res = buildSuggestedSequence(gen(n), pts([-23.55, -46.6]));
  console.log(n, "NN", res.nearestMs.toFixed(1), "2opt", res.twoOptMs.toFixed(1), "total", res.totalMs.toFixed(1), "km", res.initialKm?.toFixed(2), "->", res.improvedKm?.toFixed(2), "swaps", res.swaps);
}
// casos especiais
console.log("0 apto", buildSuggestedSequence([], pts(null)).stops.length);
console.log("1 apto", buildSuggestedSequence([lead(1, -23.5, -46.5)], pts(null)).stops.length);
console.log("2 iguais", buildSuggestedSequence([lead(1, -23.5, -46.5), lead(2, -23.5, -46.5)], pts(null)).totalKm);
console.log("sem coord", buildSuggestedSequence([lead(1, null, null), lead(2, -23.5, -46.5)], pts(null)).skippedCount);
console.log("sem saida ancora", buildSuggestedSequence(gen(5), pts(null)).anchorRule);
console.log("retorno=saida", buildSuggestedSequence(gen(5), pts([-23.55, -46.6], true)).endConsidered);
console.log("retorno texto", buildSuggestedSequence(gen(5), pts([-23.55, -46.6], false)).endConsidered);
console.log("retorno proprio", buildSuggestedSequence(gen(5), pts([-23.55, -46.6], false, [-23.6, -46.7])).returnKm);
