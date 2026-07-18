# Design — MicroTaskManager v1 (decomposição e decisões)

**Data:** 2026-07-18
**Base:** [`PRD.md`](../../../PRD.md) v1.0 — este documento **não** redefine o produto; ele
fixa as decisões operacionais e a decomposição em stories a partir do PRD.
**Fluxo operacional:** ver [`CLAUDE.md`](../../../CLAUDE.md) (Linear ↔ GitHub, prefixo `GC`).

---

## 1. Contexto

O repositório `MicroTaskManager15` existe para (a) exercitar o fluxo
Superpowers → Linear → código → PR → status automático (já validado em GC-5/GC-6) e
(b) reconstruir o **MicroTaskManager** descrito no `PRD.md` com as mesmas ferramentas
(Next.js 16 + Supabase + TDD/Vitest).

O PRD é denso e já resolve arquitetura (§9), modelo de dados (§8), UX (§10–11),
requisitos funcionais (§6), não-funcionais (§7) e estratégia de testes (§12). Este
design **assume o PRD como fonte de verdade** e só adiciona o que falta para executar:
decisões pendentes, confirmações de escopo e a decomposição em stories `GC-*`.

## 2. Decisões travadas (brainstorming 2026-07-18)

1. **PRD fixo.** v1 segue o PRD; sem revisitar stack, escopo ou modelo de dados.
2. **Autenticação sem cadastro.** O app tem apenas tela de **login** (e-mail/senha,
   RF-1). A conta única do dono é criada **fora do app** (Supabase dashboard ou script
   de seed no setup). Não há tela de signup no produto.
3. **CI é gatekeeper real.** A partir da story de scaffolding, o check `ci`
   (`.github/workflows/ci.yml`) roda: `install → typecheck (tsc --noEmit) → lint →
   vitest`. Merge na `main` só com a suíte verde (o ruleset `protect-main` exige o
   check `ci`).
4. **v1 roda local.** Desenvolvimento e execução via Supabase local (CLI + Docker,
   `supabase start`); schema versionado em `supabase/migrations/`. Deploy no Supabase
   Cloud é **pós-v1** (PRD §15).
5. **Granularidade média (~6–7 stories), verticais por prioridade.** Cada story entrega
   uma capacidade usável completa e tem seu próprio ciclo TDD + PR `Fixes GC-<n>`. A
   camada de dados/RLS **não** é uma story isolada: cada vertical traz sua própria
   tabela + política RLS + teste de isolamento.

## 3. Confirmações de escopo

Reafirmando o "fora de escopo" do PRD §5 e resolvendo lacunas:

- **Mover tarefa entre listas: FORA da v1.** O RF-3 cobre editar título/prioridade/
  prazo/status e apagar, mas não "mover de lista". Uma tarefa nasce na lista ativa (ou
  sem lista, na aba "Todas") e permanece. YAGNI, coerente com o PRD.
- Mantidos fora (PRD §5): múltiplos usuários, subtarefas, anexos, comentários,
  notificações, recorrência, tags além de categoria, mobile nativo, histórico de
  status/`completed_at`, painel de detalhe, drag-and-drop, paleta de comandos.

## 4. Decomposição do épico "MicroTaskManager v1"

Ordem de build = ordem da tabela (prioridade de valor). Cada story depende apenas das
anteriores.

### GC-a — Scaffolding + CI real
- **Escopo:** projeto Next.js 16 (App Router, TypeScript), Vitest 4 +
  @testing-library/react + jsdom, lint, estrutura de pastas (domínio puro isolado de
  UI/dados). Substituir `ci.yml` (`echo ok`) por `install → typecheck → lint → test`.
  Registrar pré-requisitos e comandos no `AGENTS.md`/README.
- **DoD:** um teste de domínio puro (ex.: validação de título) passa localmente e no
  CI; o check `ci` fica verde e barra merge quando a suíte falha.

### GC-b — Auth (login, sessão, proteção de rota)
- **Escopo:** Supabase local; sessão SSR com `@supabase/ssr`; tela de login coerente
  com a casca visual (RF-1); logout; redirecionamentos (sem sessão → login; sessão →
  app; sessão expirada → login). Dono provisionado por seed.
- **DoD:** logar/deslogar funciona; rota protegida redireciona sem sessão; teste
  cobrindo a proteção de rota e o fluxo de login inválido (RF-1.3).

### GC-c — Tarefas (CRUD)
- **Escopo:** tabela `tasks` + RLS (`auth.uid() = user_id`, `using` + `with check`);
  server actions para criar (título obrigatório, prioridade default `medium`, prazo
  opcional, status `new`), editar título (rejeita vazio), mudar prioridade/prazo/status
  e apagar (RF-3). Lógica de domínio pura (validação) isolada. Render mínimo da lista.
- **DoD:** CRUD funcional ponta a ponta; teste de integração comprova que **RLS bloqueia
  dados de outro usuário**; unit tests de validação (título vazio, defaults).

### GC-d — Listas
- **Escopo:** tabela `lists` + RLS; criar lista (nome não vazio, RF-2.1) e selecionar;
  navegação por abas/pílulas ("Todas" + uma por lista + "＋ Nova lista", RF-2.2);
  filtro de tarefas por lista ativa (RF-2.3). Tarefa criada na aba "Todas" fica sem
  lista (`list_id` null).
- **DoD:** criar lista e alternar abas filtra corretamente; RLS de `lists` testada;
  estado vazio "sem listas" convida a criar a primeira (RF-4.6).

### GC-e — Visualização e organização
- **Escopo:** lógica de domínio pura — ordenação por prioridade (alta→baixa) e, no
  empate, por prazo mais próximo (sem prazo por último, RF-4.1); classificação de
  vencimento (hoje/atrasada/futura, RF-5); agrupar concluídas/canceladas numa seção ao
  final (RF-4.3); toggle "ocultar concluídas" (RF-4.4); contagem de abertas (RF-4.5);
  estados vazios (RF-4.6). Componentes: badges de prioridade/vencimento, item concluído
  (esmaecido/riscado), toggle.
- **DoD:** funções puras testadas (ordenação, vencimento, filtro, agrupamento);
  componentes testados; prioridade com `aria-label` textual (não depende de cor).

### GC-f — Tema + identidade visual
- **Escopo:** tokens CSS em `globals.css` (dark no `:root`, claro espelhado em
  `:root[data-theme="light"]`); tema **escuro por padrão** + toggle no menu da conta,
  **persistido em cookie** (resolvido no servidor, sem flash) com fallback localStorage
  (RF-6); layout coluna única centralizada (~600px) sob barra de topo; tipografia Geist
  Sans (`next/font`); accent violeta parcimonioso; pontinho de prioridade monocromático.
- **DoD:** toggle persiste entre reloads sem flash de tema no SSR; contraste AA no
  corpo; `prefers-reduced-motion` respeitado.

> Nota: a "casca visual" mínima (barra de topo, coluna centralizada, login estilizado)
> é introduzida de forma incremental já em GC-b/GC-c; GC-f consolida os **tokens** e a
> **persistência de tema**, evitando retrabalho de estilo inline nas stories anteriores.

## 5. Convenções por story (cross-cutting)

- **TDD:** cada story escreve testes antes da implementação (PRD §12). Lógica de domínio
  (ordenação, status de prazo, validação) vive em módulos puros e isolados de UI/dados.
- **Segurança:** toda tabela nasce com RLS habilitado e política por `user_id`; cada
  vertical com dados inclui um teste de isolamento entre contas (RNF-1).
- **Branch/PR (CLAUDE.md):** branch com o ID (`glaubercosta/gc-<n>-<slug>`), título do PR
  com o ID, descrição com `Fixes GC-<n>`. **Não** referenciar (`Ref`/`Part of`) issues já
  concluídas em PRs novos — a automação "On PR opened → In Progress" reabre a issue
  referenciada (lição de GC-5).
- **i18n (RNF-4):** valores internos em inglês (`high`, `working`), rótulos em pt-BR
  ("Alta", "Trabalhando"); `<html lang="pt-BR">`.

## 6. Mapeamento para o Linear

O épico vira um Project/épico no time `GC` (o project **"MicroTaskManager 15"** já
existe). As stories GC-a..GC-f são criadas como Issues a partir do **plano de
implementação** (próximo passo: skill `writing-plans`), cada uma com o RF/DoD acima.
Os IDs reais (`GC-7`, `GC-8`, …) serão atribuídos na criação.

## 7. Riscos (herdados do PRD §14)

| Risco | Mitigação |
|---|---|
| Mudanças de API no Next.js 16 | Consultar docs da versão instalada antes de codar (`AGENTS.md`) |
| Flash de tema no SSR | Persistir tema em cookie e resolver no servidor (GC-f) |
| Vazamento entre usuários | RLS como fronteira real, testada em cada vertical com dados |
| Escopo inchar | Lista explícita de fora-de-escopo (§3 + PRD §5) |
