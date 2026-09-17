# Fase 3 — Análise e projeto da Roteirização Inteligente

Somente análise. Nenhum código, banco, RLS ou API foi alterado nesta etapa.

## A. Estrutura existente (reutilizável)

- **Pesquisas arquivadas**: `lead_searches` (id, nome, segmento, região/cidade/UF, raio, contadores encontrados/selecionados/captados, provedor, status rascunho/arquivada, responsável, data) e vínculo 1:N por `leads.search_id`. Seleção múltipla já preparada no painel.
- **Leads**: CEP, rua, número, bairro, cidade, UF, latitude/longitude, status, responsável (`created_by`), `next_contact_date`, histórico, exclusão lógica (`deleted_at`).
- **Roteiros**: `visit_routes` já possui data, responsável, horário de saída, tempo disponível, ponto de saída e de retorno (rótulo, endereço, lat/lon), veículo, segmento/região, observações, status, distância/duração/custo planejados e realizados.
- **Paradas**: `visit_route_stops` com ordem (`sort_order`), prioridade, endereço, lat/lon, horário previsto, tempo de deslocamento e de visita previstos e realizados, status.
- **Visitas**: `lead_visits` com chegada, início, término, duração, deslocamento, distância, resultado, pessoa atendida, observações e próxima ação, já integrada à Agenda e ao histórico do Lead.
- **Veículos**: `vehicles` com km/l, preço do combustível e ativo/inativo.
- **Funções já prontas**: `distanceKm` (haversine), `fuelCost`, `findDuplicate`, `can_access_lead`, `can_access_route`, `can_view_all_leads`.

Conclusão: a estrutura de roteiros **suporta integralmente** a roteirização. Nada de base paralela.

## B. Estrutura necessária

Nenhuma tabela nova é obrigatória. O "roteiro proposto" pode nascer como roteiro com status `planejado` (já existente) e só virar operacional quando o usuário confirmar.

Opcional, a decidir só na implementação:
- um campo texto para registrar a origem do roteiro (quais pesquisas o geraram) — pode ser resolvido sem banco, usando o campo `notes` já existente;
- cache de distâncias, apenas se optarmos por API externa.

## C. Fluxo proposto

Selecionar pesquisas → consolidar Leads (sem duplicar) → filtrar elegíveis → separar com/sem localização → definir saída, retorno, data, horário, tempo disponível e veículo → calcular sequência → exibir roteiro proposto com distância, tempo, custo e horários → usuário ajusta (reordena, remove, inclui) → confirmar → grava roteiro e paradas → execução das visitas pelo fluxo atual → resultado → próxima ação → Agenda e Central do Lead.

## D. Dados de entrada

Pesquisas selecionadas; Leads com coordenadas; filtros (status, responsável, já visitado, com visita agendada, excluídos); ponto de saída e de retorno; data; horário de saída; tempo disponível; tempo médio por visita; veículo; prioridades.

## E. Dados de saída

Sequência de paradas ordenada, com horário previsto, tempo de deslocamento e de visita por parada; distância total; duração total; custo estimado; lista de Leads não incluídos e o motivo; roteiro gravado nas tabelas existentes.

## F. Algoritmo

Proposta em 3 camadas, sem dependência externa obrigatória:

1. **Matriz local**: distância em linha reta (haversine, já implementada) entre saída, todos os Leads e o retorno. Custo zero, instantâneo.
2. **Sequência inicial**: vizinho mais próximo a partir do ponto de saída.
3. **Refinamento**: 2-opt (troca de pares) até estabilizar — melhora tipicamente 10–20% e roda em milissegundos para até 100 pontos.

Prioridade entra como **peso**, não como imposição: custo = distância × fator de prioridade (alta reduz o custo percebido), mantendo a geografia dominante. O usuário vê a sequência e pode alterar tudo.

Opcional (fase posterior): substituir a matriz em linha reta por distância/tempo reais por vias, sem mudar o algoritmo.

## G. Google / APIs

| Serviço | Finalidade | Necessidade | Quando | Custo | Alternativa |
|---|---|---|---|---|---|
| Places (New) | pesquisa de Leads | já em uso | pesquisa | atual | — |
| Geocoding | coordenadas do ponto de saída/retorno e Leads sem lat/lon | útil | 1 chamada por endereço, com cache | baixo | digitar coordenadas / usar localização atual |
| Routes (computeRoutes) | distância e tempo reais do trajeto final | opcional | 1 chamada só no roteiro confirmado | baixo | haversine × fator de correção (~1,3) |
| Route Matrix | matriz real entre todos os pares | **não recomendado agora** | geração | cresce ao quadrado (50 Leads ≈ 2.600 elementos) | matriz local |
| Maps JavaScript | mapa do roteiro | desejável, não essencial | visualização | por carregamento | lista + link para o mapa (já existe) |

Riscos de dependência: indisponibilidade, cota, latência. Por isso o cálculo base deve ser **local**, com API apenas como refinamento opcional.

## H. Custos

Pontos de cobrança: geocodificação, matriz e rotas. Redução: cálculo local por padrão; geocodificar só o que falta e guardar o resultado no Lead; chamar Routes no máximo uma vez por roteiro confirmado; nunca recalcular a cada ajuste manual; limite de Leads por roteiro; botão explícito de "recalcular".

## I. Segurança

Toda leitura continua pelas consultas normais de Leads e pesquisas, com RLS como autoridade. A seleção de pesquisas nunca amplia acesso: os Leads são lidos pela política normal, então um Lead invisível ao usuário simplesmente não aparece no conjunto. Gravação do roteiro segue `can_access_route` e as políticas atuais de `visit_routes` / `visit_route_stops`. Admin, colaborador e permissão ampliada seguem inalterados.

## J. Performance

Haversine + vizinho mais próximo + 2-opt: 10 a 50 Leads é imediato; 100 Leads roda em fração de segundo; acima disso o 2-opt fica pesado no navegador. Proposta: limite prático de **60 paradas por roteiro** (um dia de trabalho raramente passa de 15), aviso acima disso, cálculo memorizado e recálculo só sob comando.

## K. Experiência do usuário

Assistente em 4 passos dentro da aba Visitas, sem tela nova de módulo:
1. Selecionar pesquisas e conferir o conjunto de Leads (com contadores 🟢 com localização / 🟡 sem localização).
2. Filtros e exclusão pontual de Leads.
3. Condições: saída, retorno, data, horário, tempo disponível, tempo médio de visita, veículo.
4. Roteiro proposto: lista arrastável com horário, distância, tempo e custo; ajustar; confirmar.

Layout em coluna única a partir de 390px, sem rolagem horizontal, reutilizando os componentes atuais.

## L. Riscos

- Leads sem coordenadas reduzem o aproveitamento da pesquisa → tela clara e correção posterior.
- Linha reta subestima distância real → aplicar fator de correção e deixar explícito que é estimativa.
- Dependência de API externa → cálculo local como padrão.
- Excesso de paradas por dia → limite e aviso de tempo disponível estourado.

## M. Alterações de banco

Nenhuma obrigatória. Nada executado nesta etapa.

## N. Alterações de código (previstas, não feitas)

`src/lib/visits.ts` (algoritmo e cálculos), novo `src/lib/routePlanner.ts`, `src/lib/searchQueries.ts` (consolidação dos Leads), novos componentes em `src/components/visits/`, aba em `src/routes/_authenticated/visitas.index.tsx`, e `visitas.$id.tsx` para exibir os totais.

## O. Plano de implementação

- 3.1 Seleção de pesquisas e consolidação dos Leads (sem duplicidade, respeitando RLS).
- 3.2 Validação geográfica e tratamento dos Leads sem localização.
- 3.3 Cálculo de distâncias local e definição dos pontos de saída/retorno.
- 3.4 Geração do roteiro proposto com horários, distância, tempo e custo.
- 3.5 Revisão e ajuste manual da sequência.
- 3.6 Confirmação e gravação no roteiro existente, integrada à execução das visitas.
- 3.7 Homologação (Admin, Colaborador, desktop, 390px, typecheck, console).

Aguardando sua autorização explícita para iniciar qualquer implementação.
