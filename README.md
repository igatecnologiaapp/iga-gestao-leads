# Gestão de Leads

Crie um aplicativo web responsivo, com funcionamento excelente em notebook, tablet e celular, para CAPTAÇÃO E GESTÃO DE LEADS, com foco em equipes comerciais que realizam visitas presenciais e precisam registrar leads de forma rápida, simples e organizada.

O sistema deverá ser desenvolvido com arquitetura moderna, responsiva, segura e preparada para futura expansão para um CRM completo.

1. OBJETIVO DO SISTEMA

O aplicativo será utilizado por empresas para realizar a captação de Leads durante visitas comerciais, permitindo cadastrar rapidamente empresas visitadas, contatos, telefones, localização e informações específicas de acordo com o segmento de atuação da empresa que está realizando a prospecção.

O sistema deverá ser configurável por segmento, pois diferentes empresas terão diferentes informações necessárias para qualificar seus Leads.

Exemplo:

Uma empresa que vende luminárias pode precisar somente de:

Nome da Empresa

Nome do Contato

Telefone

Rua

Número

Bairro

Já uma empresa de Software, como a IGA Tecnologia, poderá precisar também identificar quais tipos de software ou soluções podem ser adequados ao perfil do Lead visitado.

Portanto, o sistema deverá possuir uma estrutura de campos personalizados por segmento de captação.

2. PLATAFORMAS

O sistema deverá funcionar perfeitamente em:

Notebook

Desktop

Tablet

Smartphone Android

Smartphone iPhone

Utilizar abordagem Mobile First, mas mantendo uma excelente experiência em telas maiores.

No celular, a tela de cadastro deverá ser extremamente simples e rápida, evitando excesso de campos e rolagens desnecessárias.

No notebook, o sistema poderá utilizar melhor o espaço disponível, apresentando tabelas, filtros, dashboards e relatórios.

3. ESTRUTURA PRINCIPAL DO SISTEMA

Criar uma interface administrativa com menu lateral responsivo.

Menu sugerido:

OPERAÇÃO

Dashboard

Captar Lead

Leads

Mapa de Leads

CADASTROS

Segmentos

Ruas

Bairros

Produtos / Serviços

Configuração de Segmentos

GESTÃO

Relatórios

Indicadores

Usuários

Configurações

O menu deverá ser recolhível no notebook e transformado em menu compacto/hamburger no celular.

4. CADASTRO DE LEAD

Criar uma tela chamada:

CAPTAR LEAD

O formulário deverá permitir cadastrar:

DADOS DA EMPRESA

Nome da Empresa

Segmento

Nome do Contato

Telefone

ENDEREÇO

Rua

Número

Bairro

O cadastro deverá ser rápido e otimizado para utilização durante uma visita presencial.

5. CADASTRO DE SEGMENTO

O sistema deverá permitir cadastrar diferentes segmentos de empresas.

Exemplos:

Açougue

Restaurante

Supermercado

Loja de Roupas

Loja de Móveis

Loja de Iluminação

Construção Civil

Indústria

Distribuidora

Tecnologia

Software

Serviços

Automotivo

Outros

O administrador poderá criar novos segmentos a qualquer momento.

Cada segmento poderá possuir uma configuração diferente de campos necessários para qualificação do Lead.

6. CAMPOS DINÂMICOS POR SEGMENTO

Essa é uma funcionalidade FUNDAMENTAL do sistema.

O formulário de Lead deverá ser dinâmico de acordo com o segmento selecionado.

Exemplo:

Se a empresa captadora for uma empresa de venda de luminárias:

Segmento:

ILUMINAÇÃO

O sistema deverá apresentar somente os campos necessários:

Nome da Empresa

Nome do Contato

Telefone

Rua

Número

Bairro

Não apresentar campos desnecessários.

7. EXEMPLO ESPECÍFICO — IGA TECNOLOGIA

Criar suporte para empresas que vendem vários produtos ou soluções de Software.

Exemplo:

Empresa captadora:

IGA Tecnologia

Segmento:

Software / Tecnologia

Ao selecionar esse segmento, o sistema deverá automaticamente apresentar um campo adicional:

"Quais soluções podem atender este Lead?"

Esse campo deverá ser uma lista suspensa, permitindo selecionar um ou mais softwares/soluções previamente cadastrados.

Exemplo de opções:

Sistema para Açougue

Sistema de Desossa

Sistema para Restaurante

Sistema para Supermercado

Sistema de Gestão Empresarial

Sistema Financeiro

Sistema de Controle de Estoque

Sistema de Vendas

Sistema de Produção

Sistema de CRM

Sistema Personalizado

Essas opções NÃO devem ficar fixas no código.

Elas deverão ser cadastráveis pelo administrador através do menu:

CADASTROS → Produtos / Serviços

8. PRODUTOS/SERVIÇOS POR SEGMENTO

Permitir cadastrar produtos ou serviços e vinculá-los a um ou mais segmentos.

Exemplo:

Produto:

Sistema de Gestão para Açougues

Segmentos compatíveis:

Açougue

Casa de Carnes

Frigorífico

Produto:

Sistema de Gestão para Restaurantes

Segmentos compatíveis:

Restaurante

Lanchonete

Pizzaria

Food Service

Produto:

Sistema de Desossa

Segmentos compatíveis:

Açougue

Frigorífico

Casa de Carnes

Ao cadastrar um Lead, o sistema deverá utilizar essas informações para apresentar somente os produtos/serviços que sejam potencialmente adequados ao perfil daquele Lead.

9. INTELIGÊNCIA NA SELEÇÃO DE PRODUTOS

Ao selecionar o segmento do Lead, o sistema deverá filtrar automaticamente os produtos/serviços compatíveis.

Exemplo:

Usuário seleciona:

Segmento: Açougue

O campo:

Soluções adequadas para este Lead

deverá mostrar somente:

Sistema para Açougue

Sistema de Desossa

Sistema de Estoque

Sistema de Vendas

Outros produtos vinculados ao segmento Açougue

Se selecionar:

Segmento: Restaurante

mostrar somente soluções cadastradas como compatíveis com Restaurante.

Permitir seleção de uma ou várias soluções.

10. PRÉ-CADASTRO DE RUAS

Criar um cadastro chamado:

RUAS

O administrador poderá cadastrar previamente:

Nome da Rua

Bairro

CEP

Cidade

Estado

Exemplo:

Rua:
Rua das Palmeiras

Bairro:
Centro

CEP:
00000-000

11. PRÉ-CADASTRO DE BAIRROS

Criar também um cadastro:

BAIRROS

Campos:

Nome do Bairro

Cidade

Estado

Permitir relacionamento entre:

Rua → Bairro

Assim, uma rua previamente cadastrada poderá estar automaticamente vinculada a determinado bairro.

12. COMPORTAMENTO INTELIGENTE DO ENDEREÇO

Essa funcionalidade deverá ser cuidadosamente implementada.

Na tela de cadastro do Lead:

Campo 1 — Rua

Utilizar uma lista suspensa com pesquisa/autocomplete.

O usuário começa a digitar:

"Rua das..."

O sistema apresenta:

Rua das Palmeiras

Rua das Flores

Rua das Acácias

Ao selecionar a rua:

Preencher automaticamente o Bairro correspondente.

Levar automaticamente o cursor/foco para o campo Número.

Permitir que o usuário digite imediatamente o número.

Fluxo:

Rua → selecionar → Bairro preenchido → foco automático em Número

Isso é especialmente importante para utilização no celular.

13. BAIRRO

O bairro deverá ser preenchido automaticamente quando houver relacionamento cadastrado entre a rua e o bairro.

Porém, permitir alteração manual caso necessário.

Se a rua não estiver cadastrada:

Permitir selecionar/cadastrar o bairro manualmente.

Oferecer opção "Cadastrar nova rua".

Não impedir a captação do Lead por falta de cadastro prévio.

14. CADASTRO RÁPIDO DE LEAD

Criar uma experiência chamada:

CAPTAÇÃO RÁPIDA

No celular, o usuário deverá conseguir cadastrar um Lead com poucos toques.

Fluxo ideal:

Nome da Empresa

Nome do Contato

Telefone

Segmento

Rua

Número

Bairro

Campos específicos do segmento

Salvar Lead

Após salvar:

Exibir mensagem:

Lead cadastrado com sucesso!

E disponibilizar:

[Cadastrar outro Lead]

para que o usuário possa continuar a prospecção imediatamente.

15. LISTAGEM DE LEADS

Criar uma tela:

LEADS

Apresentar os Leads em formato de tabela no notebook e cards no celular.

Informações:

Empresa

Contato

Telefone

Segmento

Endereço

Bairro

Solução de interesse

Data da captação

Usuário responsável

Status

Permitir pesquisa por:

Empresa

Contato

Telefone

Segmento

Rua

Bairro

Produto/Serviço

Responsável

16. STATUS DO LEAD

Criar inicialmente os seguintes status:

Novo

Em contato

Contatado

Interessado

Proposta enviada

Negociação

Convertido

Perdido

Permitir alteração do status diretamente na listagem.

Utilizar indicadores visuais claros.

17. HISTÓRICO DO LEAD

Cada Lead deverá possuir uma página de detalhes.

Exibir:

Informações da empresa

Empresa

Segmento

Contato

Telefone

Endereço

Qualificação

Produtos/Serviços de interesse

Observações

Status

Histórico

Registrar:

Data da captação

Usuário que captou

Alterações realizadas

Mudanças de status

Observações

Contatos realizados

18. OBSERVAÇÕES

Adicionar campo:

Observações da Visita

Campo de texto livre.

Exemplo:

"Proprietário demonstrou interesse no sistema de estoque. Pediu contato na próxima semana."

Esse campo deverá ser facilmente acessível no celular.

19. TELEFONE

O campo telefone deverá possuir máscara automática.

Exemplo:

(11) 99999-9999

Permitir também números comerciais:

(11) 3333-4444

Validar quantidade de caracteres, mas sem impedir o cadastro quando o usuário precisar registrar um telefone fora do padrão.

20. DASHBOARD

Criar um Dashboard gerencial.

Indicadores:

TOTAL DE LEADS

Quantidade total captada.

LEADS HOJE

Quantidade captada no dia.

LEADS DA SEMANA

Quantidade captada nos últimos 7 dias.

LEADS DO MÊS

Quantidade captada no mês.

POR SEGMENTO

Gráfico mostrando:

Açougues

Restaurantes

Supermercados

Indústrias

etc.

POR STATUS

Gráfico:

Novos

Em contato

Interessados

Propostas

Negociação

Convertidos

Perdidos

TOP PRODUTOS/SOLUÇÕES

Mostrar quais produtos ou serviços estão sendo mais indicados aos Leads.

21. MAPA DE LEADS

Criar futuramente uma tela:

MAPA DE LEADS

Exibir os Leads geograficamente.

Utilizar endereço cadastrado para geolocalização quando possível.

Permitir visualizar concentração de Leads por:

Cidade

Bairro

Região

Segmento

Ao clicar em um ponto do mapa, mostrar resumo do Lead.

Essa funcionalidade deve ser preparada na arquitetura, mesmo que possa ser implementada em uma segunda etapa.

22. USUÁRIOS

Criar sistema de autenticação.

Perfis inicialmente:

ADMINISTRADOR

Pode:

Cadastrar segmentos

Cadastrar ruas

Cadastrar bairros

Cadastrar produtos/serviços

Configurar campos

Gerenciar usuários

Visualizar todos os Leads

Editar Leads

Excluir Leads

Visualizar relatórios

CAPTADOR / VENDEDOR

Pode:

Captar Leads

Visualizar seus Leads

Editar seus Leads

Atualizar status

Registrar observações

Opcionalmente permitir que o administrador escolha se cada usuário poderá visualizar somente seus próprios Leads ou todos os Leads.

23. CONFIGURAÇÃO DE SEGMENTOS

Criar uma área:

CONFIGURAÇÃO DE SEGMENTOS

O administrador poderá definir quais campos aparecem para cada segmento.

Exemplo:

Segmento: ILUMINAÇÃO

Campos obrigatórios:

Empresa

Contato

Telefone

Rua

Número

Bairro

Segmento: SOFTWARE

Campos:

Empresa

Contato

Telefone

Rua

Número

Bairro

Soluções de interesse

Quantidade aproximada de usuários

Sistema atualmente utilizado

Observações

Segmento: RESTAURANTE

Campos:

Empresa

Contato

Telefone

Rua

Número

Bairro

Quantidade de mesas

Delivery

Sistema atual

Observações

A estrutura deverá ser flexível para que o administrador consiga criar novos campos futuramente sem necessidade de alterar o código principal do sistema.

24. CAMPOS PERSONALIZADOS

Criar arquitetura para campos personalizados.

Tipos de campos:

Texto

Número

Telefone

Data

Lista suspensa

Seleção múltipla

Sim/Não

Área de texto

Checkbox

O administrador deverá conseguir definir:

Nome do campo

Tipo

Obrigatório ou não

Segmentos aos quais pertence

Ordem de exibição

Opções da lista

25. EXPERIÊNCIA DE USUÁRIO

A interface deverá transmitir uma sensação de:

Tecnologia

Organização

Agilidade

Profissionalismo

Simplicidade

Evitar excesso de informações.

Priorizar:

Poucos cliques + preenchimento rápido + clareza.

No celular, utilizar botões grandes e campos fáceis de tocar.

O sistema deverá lembrar o último segmento utilizado durante a sessão, mas permitir alteração.

26. AUTOCOMPLETE

Os campos:

Rua

Bairro

Empresa

Produto/Serviço

deverão utilizar pesquisa/autocomplete quando houver grande quantidade de registros.

Evitar listas suspensas gigantes.

O usuário deverá conseguir começar a digitar e encontrar rapidamente o registro desejado.

27. BANCO DE DADOS

Criar banco de dados estruturado e relacional.

Sugestão de entidades:

users

Usuários do sistema.

leads

Dados principais dos Leads.

segments

Segmentos.

streets

Ruas.

neighborhoods

Bairros.

products_services

Produtos e serviços.

segment_products

Relacionamento entre segmentos e produtos/serviços.

segment_fields

Configuração dos campos personalizados.

lead_custom_values

Valores dos campos personalizados de cada Lead.

lead_history

Histórico de alterações.

lead_status_history

Histórico de mudança de status.

Manter integridade referencial e índices para pesquisas rápidas.

28. SEGURANÇA

Implementar autenticação segura.

Utilizar controle de acesso por perfil.

Aplicar políticas de segurança no banco de dados.

Cada usuário deverá acessar somente aquilo que suas permissões permitirem.

Registrar alterações importantes no histórico.

Não permitir exclusão definitiva de informações críticas sem permissão administrativa.

Preferencialmente utilizar exclusão lógica para Leads.

29. RESPONSIVIDADE

CELULAR

Priorizar:

Captar Lead

Leads

Pesquisa

Atualização de status

NOTEBOOK

Priorizar:

Dashboard

Tabelas

Relatórios

Configurações

Cadastros

O layout deverá se adaptar automaticamente ao tamanho da tela.

30. DESIGN

Criar um design moderno, limpo e profissional.

Preferência por:

Modo Claro

Branco

Azul

Tons neutros

Elementos de destaque em cores de status

Criar também:

Modo Escuro

com aparência profissional e confortável para utilização noturna.

Utilizar cards, ícones, indicadores, tabelas modernas e componentes consistentes.

31. EXPERIÊNCIA DE CAPTAÇÃO EM CAMPO

Essa deve ser uma das prioridades do projeto.

Imagine o seguinte cenário:

Um vendedor está caminhando por uma região comercial utilizando o celular.

Ele entra em uma empresa.

Abre:

CAPTAR LEAD

Digita:

Empresa:
"Comercial São João"

Contato:
"João"

Telefone:
"(11) 99999-9999"

Segmento:
"Açougue"

Rua:
"Rua das Palmeiras"

Ao selecionar a rua, o sistema automaticamente preenche:

Bairro:
"Centro"

e imediatamente coloca o cursor no campo:

Número:

O vendedor digita:

"125"

O sistema apresenta automaticamente as soluções compatíveis com o segmento.

O vendedor seleciona:

"MEATPRO"

Adiciona uma observação:

"Proprietário interessado em sistema de gestão."

Clica:

SALVAR LEAD

O cadastro é concluído em poucos segundos.

Essa experiência deverá ser considerada como referência para o desenvolvimento.

32. PREPARAR PARA FUTURA EVOLUÇÃO

A arquitetura deverá permitir posteriormente adicionar:

Funil de vendas

CRM

Agenda de contatos

Tarefas

Follow-up

WhatsApp

E-mail

Integração com Google Maps

Geolocalização

Rotas de visita

Importação de Leads

Exportação Excel

Exportação PDF

Campanhas

Distribuição automática de Leads

Pontuação de Leads

Lead Scoring

Inteligência Artificial para classificação de Leads

Sugestão automática de produtos/serviços

Relatórios comerciais avançados

Não implementar essas funcionalidades agora se elas não forem necessárias para a primeira versão, mas deixar a arquitetura preparada para sua inclusão.

33. PRIORIDADE DE DESENVOLVIMENTO

Desenvolver inicialmente nesta ordem:

FASE 1 — FUNDAÇÃO

Autenticação

Usuários

Banco de dados

Layout responsivo

Dashboard básico

FASE 2 — CADASTROS

Segmentos

Ruas

Bairros

Produtos/Serviços

Relacionamento Segmento × Produto/Serviço

FASE 3 — CAPTAÇÃO

Cadastro rápido de Lead

Endereço inteligente

Autocomplete

Campos dinâmicos

Produtos/serviços compatíveis

FASE 4 — GESTÃO

Listagem de Leads

Pesquisa

Filtros

Status

Histórico

Observações

FASE 5 — DASHBOARD

Indicadores

Gráficos

Leads por segmento

Leads por status

Produtos/serviços mais indicados

FASE 6 — MAPA E EVOLUÇÕES

Preparar estrutura para mapa, geolocalização, CRM, follow-up e integrações futuras.

34. REGRAS IMPORTANTES

Não deixar Segmentos, Ruas, Bairros e Produtos/Serviços fixos no código.

Tudo deve ser administrável pelo sistema.

Os produtos/serviços devem poder pertencer a vários segmentos.

Os segmentos devem poder possuir campos personalizados.

O formulário deve mudar dinamicamente conforme o segmento.

O endereço deve possuir autocomplete.

Ao selecionar uma Rua, preencher automaticamente o Bairro quando houver relacionamento cadastrado.

Após selecionar a Rua, mover automaticamente o foco para Número.

O cadastro não pode ser bloqueado caso uma Rua ainda não esteja cadastrada.

O sistema deve funcionar muito bem no celular.

O cadastro de Lead deve exigir o mínimo possível de interação.

Produtos/serviços compatíveis devem ser filtrados automaticamente pelo segmento.

Permitir selecionar mais de uma solução quando aplicável.

Registrar quem cadastrou o Lead e quando.

Registrar histórico das alterações.

Utilizar exclusão lógica para Leads.

O sistema deverá estar preparado para crescimento do número de Leads.

Evitar criar telas ou funcionalidades desnecessárias nesta primeira versão.

Priorizar velocidade, simplicidade e experiência de uso.

Criar componentes reutilizáveis para facilitar futuras expansões.

35. ENTREGA ESPERADA

Ao finalizar a implementação, entregar um aplicativo funcional contendo:

Login

Dashboard

Cadastro de Segmentos

Cadastro de Ruas

Cadastro de Bairros

Cadastro de Produtos/Serviços

Configuração de campos por segmento

Captação rápida de Leads

Endereço inteligente

Autocomplete

Campos dinâmicos

Associação automática de soluções ao segmento

Listagem de Leads

Filtros

Status

Histórico

Observações

Controle de usuários

Interface responsiva para notebook e celular

Antes de considerar o projeto concluído, realizar testes completos no fluxo de captação utilizando principalmente celular, garantindo que um vendedor consiga cadastrar um Lead rapidamente, com o mínimo possível de toques e sem dificuldades de navegação.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iga-gestao-leads.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dc06cd66-4ad3-4420-8221-9de7752a6452).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
