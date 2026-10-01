# Correção controlada do fuso horário comercial

## Objetivo
Padronizar compromissos e horários operacionais em `America/Sao_Paulo`, mantendo os instantes armazenados em UTC e sem alterar registros históricos, banco, permissões ou roteirização.

## Implementação
- Criar funções compartilhadas para converter explicitamente entre data/hora comercial de São Paulo e UTC, sem depender do fuso do navegador.
- Aplicar essas funções na criação, edição e visualização de compromissos na Agenda, Central do Lead, cadastro/edição de Lead e conclusão de visita.
- Manter `next_contact_date` como data pura (`DATE`) e derivá-la da data comercial de São Paulo, sem conversão para meia-noite UTC.
- Exibir timestamps operacionais e históricos relacionados no fuso comercial, preservando os valores armazenados.
- Adicionar uma indicação discreta de “Horário de Brasília” somente nos formulários de agendamento onde ela evita ambiguidade.
- Registrar a decisão técnica no guia do projeto e manter a Fase 3 encerrada.

## Validação
- Testar conversões de 08:00, 10:00, 15:30 e 23:30, incluindo virada de data.
- Repetir criação e edição em navegadores configurados para `America/Sao_Paulo` e UTC; ambos devem mostrar o mesmo horário comercial e gerar o mesmo UTC.
- Conferir Agenda, Central do Lead, próxima ação, Histórico e fluxo de visita.
- Verificar responsividade em aproximadamente 390 px, console e compilação.
- Inventariar e classificar separadamente os 8 compromissos existentes, sem modificá-los.

## Limites preservados
- Nenhuma migration e nenhuma alteração automática de dados históricos.
- Nenhuma mudança em RLS, permissões, algoritmo de roteirização ou APIs externas.
- Nenhum início da Fase 4.
