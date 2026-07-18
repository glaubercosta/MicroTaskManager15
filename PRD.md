# PRD — MicroTaskManager

**Versão:** 1.0
**Data:** 2026-07-18
**Autor:** Glauber
**Status:** Documento de referência para reprodução (experimento)

> Este PRD descreve **o que** o produto é e **por que** ele existe, no nível de
> requisitos — não é um plano de implementação passo a passo. Ele é escrito para
> ser usado como ponto de partida de um experimento que reconstrói o produto com
> **as mesmas ferramentas** (Next.js + Supabase, TDD com Vitest).

---

## 1. Resumo executivo

O **MicroTaskManager** é um gerenciador de tarefas **pessoal** (um único usuário),
**web** e acessível de qualquer máquina, protegido por login próprio. O foco é
produtividade individual sem cerimônia: criar, organizar e acompanhar tarefas por
**prioridade**, **prazo**, **lista/categoria** e **status**, numa interface rápida
e silenciosa que serve como *daily driver* de desktop.

O produto deliberadamente evita as funcionalidades de gestão de equipe (múltiplos
usuários, atribuições, comentários) que incham gerenciadores de tarefas. A aposta
é que, para uso individual, **menos é mais**: uma tela, adição rápida, sinais
visuais claros de prioridade e vencimento.

---

## 2. Problema e objetivo

**Problema.** Ferramentas de tarefas populares são pesadas para uso pessoal:
exigem contas de equipe, têm muitos campos, e a captura de uma tarefa nova custa
cliques demais. Anotações soltas (papel, notas) não têm prioridade, prazo nem
persistência entre dispositivos.

**Objetivo.** Entregar um gerenciador pessoal que:
- Capture uma tarefa em segundos (quick-add com Enter).
- Mostre num relance o que é urgente (prioridade + vencimento).
- Persista na nuvem, acessível de qualquer máquina, protegido por login.
- Seja rápido e sem distrações (uma coluna, sem sidebar, sem ruído visual).

**Não-objetivo.** Não é ferramenta de colaboração/equipe, nem app de notas, nem
project management. Ver §5 (Fora de escopo).

---

## 3. Usuário-alvo

Um **profissional individual** que quer um lugar único e confiável para tarefas
pessoais e de trabalho, usado principalmente no **desktop**, ao longo do dia.
Espera velocidade, teclado-primeiro para adição, e uma estética limpa. Não
precisa (e não quer) compartilhar tarefas com ninguém.

**User stories principais:**
- Como usuário, quero **entrar com meu login** para que meus dados fiquem
  protegidos e disponíveis em qualquer máquina.
- Como usuário, quero **adicionar uma tarefa rapidamente** digitando um título e
  pressionando Enter, sem sair do fluxo.
- Como usuário, quero **definir prioridade e prazo** de uma tarefa para saber o
  que atacar primeiro.
- Como usuário, quero **organizar tarefas em listas** (ex.: Trabalho, Casa) e
  alternar entre elas por abas.
- Como usuário, quero **mudar o status** de uma tarefa (nova → trabalhando →
  concluída/cancelada) e **ver as concluídas agrupadas** ou ocultá-las.
- Como usuário, quero **ver de relance o que vence hoje ou está atrasado**.

---

## 4. Princípios de produto

1. **Pessoal, não colaborativo.** Um único dono para cada linha de dado; sem
   sobrecarga de multiusuário na UX.
2. **Captura rápida.** Adicionar uma tarefa é a ação mais frequente e deve ser a
   mais barata (um campo, Enter, foco mantido para adição em sequência).
3. **Sinais, não ruído.** Prioridade e vencimento comunicados com o mínimo de cor;
   tipografia como protagonista.
4. **YAGNI.** Só entra na v1 o que serve ao fluxo diário individual.
5. **Seguro por padrão.** A segurança dos dados é garantida no banco (RLS), não
   apenas na UI.

---

## 5. Escopo

### Dentro da v1 (produto funcional)
- Criar, editar (título), mudar status (concluir/cancelar/retomar) e apagar tarefas.
- Campos da tarefa: **título** (obrigatório), **prioridade** (baixa/média/alta),
  **prazo** (opcional), **status** (nova/trabalhando/concluída/cancelada),
  **lista** (categoria).
- Criar e escolher **listas/categorias** (ex.: Trabalho, Casa).
- **Navegação por abas** no topo: "Todas" + uma aba por lista + "＋ Nova lista".
- **Login único** para proteger os dados na nuvem.
- **Filtro** para ocultar tarefas concluídas/canceladas.
- **Ordenação** por prioridade (alta→baixa) e, dentro da mesma prioridade, por
  prazo mais próximo primeiro.
- **Agrupamento** das concluídas/canceladas numa seção "Concluídas" ao final.
- **Identidade visual** própria: tema escuro por padrão + tema claro, com toggle
  persistido; layout de coluna única centralizada e barra de topo.

### Fora do escopo da v1 (YAGNI)
- Múltiplos usuários, compartilhamento, atribuição de tarefas.
- Subtarefas, anexos, comentários, notificações/lembretes.
- Tarefas recorrentes; tags além de categoria.
- App mobile nativo (apenas web responsiva; alvo de design é desktop).
- Histórico de mudanças de status, `completed_at`, workflow de transições
  permitidas entre status.
- Painel de detalhe da tarefa, drag-and-drop, paleta de comandos, atalhos
  avançados.

---

## 6. Requisitos funcionais

### RF-1 — Autenticação
- RF-1.1 Acesso sem sessão redireciona para a tela de **login**.
- RF-1.2 Login por e-mail e senha (conta única do dono).
- RF-1.3 Login inválido exibe mensagem clara; sessão válida redireciona ao app.
- RF-1.4 Sessão expirada redireciona ao login. Existe ação de **sair**.

### RF-2 — Listas
- RF-2.1 Usuário pode **criar** uma lista informando um nome não vazio.
- RF-2.2 As listas aparecem como abas/pílulas no topo, além da aba fixa "Todas".
- RF-2.3 A aba "Todas" mostra tarefas de todas as listas; uma aba de lista filtra
  as tarefas daquela lista.

### RF-3 — Tarefas (CRUD)
- RF-3.1 **Criar**: título obrigatório; prioridade (default média) e prazo
  (opcional) definíveis na criação; a tarefa nasce com status **nova** e vinculada
  à lista ativa (ou sem lista, na aba "Todas").
- RF-3.2 **Editar título**: título vazio/só espaços é rejeitado.
- RF-3.3 **Mudar prioridade**: baixa/média/alta.
- RF-3.4 **Mudar prazo**: definir ou limpar.
- RF-3.5 **Mudar status**: nova / trabalhando / concluída / cancelada.
- RF-3.6 **Apagar** tarefa.

### RF-4 — Visualização e organização
- RF-4.1 A lista de tarefas é **ordenada** por prioridade (alta→baixa) e, em
  empate, por prazo mais próximo primeiro; tarefas sem prazo vão depois das com
  prazo, no mesmo nível de prioridade.
- RF-4.2 Cada tarefa exibe: **pontinho de prioridade** (com `aria-label` textual),
  **título**, **prazo** (com destaque para "Hoje"/"Atrasada") e ações (reveladas
  em hover). Concluídas/canceladas ficam esmaecidas com título riscado.
- RF-4.3 Concluídas/canceladas são **agrupadas** numa seção "Concluídas" ao final.
- RF-4.4 Toggle **"Ocultar concluídas"** remove a seção de concluídas da visão.
- RF-4.5 O cabeçalho da lista mostra a **contagem de tarefas abertas**.
- RF-4.6 **Estados vazios**: lista sem tarefas convida a adicionar a primeira;
  usuário sem listas convida a criar a primeira lista.

### RF-5 — Prazo / vencimento
- RF-5.1 Uma tarefa com prazo é classificada como **atrasada**, **hoje** ou
  **futura**; sem prazo → sem indicação.
- RF-5.2 "Hoje" e "Atrasada" recebem destaque de cor semântica (âmbar/vermelho
  dessaturados); futuras aparecem em texto secundário.

### RF-6 — Tema
- RF-6.1 Tema **escuro é o padrão**; existe tema **claro** espelhando os tokens.
- RF-6.2 O toggle de tema fica no menu da conta e **persiste** a escolha (cookie,
  para o server render aplicar sem flash; fallback em localStorage).

---

## 7. Requisitos não-funcionais

- **RNF-1 Segurança.** Cada linha (`lists`, `tasks`) é acessível apenas pelo dono,
  garantido por **Row Level Security** no banco — a UI é conveniência, o banco é a
  fronteira. Enums via `text` + `CHECK` (não enum nativo) para evoluir o schema.
- **RNF-2 Desempenho/UX.** Leitura de dados no servidor (render inicial rápido);
  escrita sem API REST manual. Uma coluna centralizada (~600px), sem sidebar.
- **RNF-3 Acessibilidade.** Contraste AA no corpo; prioridade não depende só de
  cor (`aria-label`); foco visível em todos os interativos; operável por teclado
  (Enter cria tarefa); respeita `prefers-reduced-motion`.
- **RNF-4 Idioma.** Conteúdo em **pt-BR** (`<html lang="pt-BR">`). Convenção:
  valores internos em inglês (`high`, `working`), rótulos exibidos em português
  ("Alta", "Trabalhando").
- **RNF-5 Portabilidade.** Acessível de qualquer máquina via web; dados na nuvem.
- **RNF-6 Confiabilidade.** Falha de rede/backend produz mensagem clara e não
  descarta a ação silenciosamente.

---

## 8. Modelo de dados

### Tabela `lists`
| campo | tipo | nota |
|---|---|---|
| id | uuid | PK (`gen_random_uuid()`) |
| user_id | uuid | FK → `auth.users`, `on delete cascade` |
| name | text | not null (ex.: "Trabalho") |
| created_at | timestamptz | default `now()` |

### Tabela `tasks`
| campo | tipo | nota |
|---|---|---|
| id | uuid | PK (`gen_random_uuid()`) |
| user_id | uuid | FK → `auth.users`, `on delete cascade` |
| list_id | uuid | FK → `lists`, `on delete set null` (nullable) |
| title | text | not null |
| priority | text | `CHECK IN ('low','medium','high')`, default `'medium'` |
| due_date | date | nullable |
| status | text | `CHECK IN ('new','working','done','canceled')`, default `'new'` |
| created_at | timestamptz | default `now()` |

**Segurança:** RLS habilitado em ambas as tabelas; política `for all` filtrando
por `auth.uid() = user_id` (com `using` e `with check`). Conceder DML
(`select/insert/update/delete`) aos papéis `anon`, `authenticated`, `service_role`
— RLS continua aplicando o escopo por usuário para `anon/authenticated`.

---

## 9. Arquitetura e stack (as mesmas ferramentas)

**Stack:** **Next.js (App Router, TypeScript)** + **Supabase (Postgres + Auth)**.

```
[Navegador] — UI React
     │
[Next.js — App Router]
     │  Server Components LEEM dados; Server Actions GRAVAM
     ▼
[Supabase]
     ├─ Auth (login único)
     └─ Postgres (tabelas), protegido por RLS
```

- **Server Components** para leitura de dados direto do banco, com segurança.
- **Server Actions** para criar/editar/apagar sem API REST manual.
- **RLS** como rede de segurança no banco.

**Ambiente de desenvolvimento (híbrido local → nuvem):**
- Dev: Supabase local via CLI + Docker (`supabase start`) — grátis, offline,
  isolado.
- Schema versionado: cada mudança de banco é uma **migração SQL** commitada em
  `supabase/migrations/`.
- Publicação: `supabase db push` aplica as migrações no Supabase Cloud (Free); o
  app publicado aponta para a nuvem.
- Pré-requisitos: Docker Desktop e Supabase CLI.

**Versões de referência (deste projeto):** Next.js 16, React 19, TypeScript 5,
`@supabase/supabase-js` + `@supabase/ssr`. Testes com Vitest 4 +
@testing-library/react + jsdom.

> Nota de reprodução: esta versão do Next.js pode ter mudanças de API/convenções
> em relação a versões anteriores — consulte a documentação da versão instalada
> antes de escrever código (ver `AGENTS.md`).

---

## 10. Fluxo principal (UX)

1. Acesso sem sessão → **tela de login** (conta única), coerente com a casca
   visual (card centralizado, marca, botão primário no accent).
2. Logado → **barra de topo** (marca à esquerda; avatar da conta à direita com
   menu de tema e sair) e, abaixo, conteúdo centralizado.
3. **Seletor de listas** em pílulas: "Todas" + listas + "＋ Nova lista" (criação
   inline/popover).
4. **Cabeçalho da lista**: nome + contagem de abertas + toggle "Ocultar concluídas".
5. **Quick-add** inline no topo ("Adicionar tarefa…"); ao focar, revela prioridade
   e prazo; Enter cria e mantém o foco.
6. **Lista de tarefas** (blocos): checkbox, pontinho de prioridade, título, prazo,
   ações em hover. Concluídas agrupadas ao final.

---

## 11. Identidade visual (UX/design)

- **Estética:** *Notion-like*, escura por padrão — tipografia como protagonista,
  superfícies sutis, cor mínima. Alvo: desktop *daily driver*.
- **Layout:** coluna única centralizada (~600px) sob uma barra de topo full-width;
  sem sidebar.
- **Cor:** monocromático + um accent violeta usado com parcimônia (marca, foco,
  interativos). Sinais semânticos (vencimento) em âmbar/vermelho dessaturados.
- **Prioridade:** pontinho monocromático discreto (não texto), com `aria-label`.
- **Tipografia:** Geist Sans (via `next/font`); escala com título de lista 24/600,
  corpo 14, secundário 12–13, label de seção 11 uppercase.
- **Tokens:** CSS custom properties em `globals.css`; escuro no `:root` base, claro
  espelhado em `:root[data-theme="light"]`; o toggle alterna `data-theme` no
  `<html>` e aplica `color-scheme`.

---

## 12. Estratégia de testes (TDD)

Desenvolvimento orientado a testes, com Vitest + Testing Library.

- **Unitários (lógica de domínio pura):** classificação de vencimento
  (hoje/atrasada/futura), validação de título, ordenação por prioridade/prazo,
  filtro "ocultar concluídas", agrupamento aberto/concluído.
- **Integração (Supabase):** CRUD de tarefa/lista contra banco local, confirmando
  que **RLS bloqueia dados de outro usuário** (isolamento entre contas).
- **Componentes:** abas/pílulas, badges de prioridade/vencimento, checkbox/estado
  concluído, toggle de ocultar, estados vazios.

**Princípio de arquitetura testável:** lógica de domínio (ordenação, status de
prazo, validação) vive em módulos isolados e puros; acesso a dados e UI são
testados separadamente.

---

## 13. Métricas de sucesso

- A tela principal usa exclusivamente os tokens visuais (zero estilo de layout
  inline solto).
- Prioridade e vencimento legíveis num relance, sem poluição de cor.
- Adição de tarefa em ≤ 2 interações (digitar + Enter).
- Concluídas agrupadas e toggle de ocultar funcionando.
- Isolamento por usuário comprovado por teste de integração (RLS).
- Login visualmente coerente com o workspace.

---

## 14. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Vazamento de dados entre usuários se a UI falhar | RLS no banco como fronteira real, testada |
| Mudanças de API na versão do Next.js usada | Consultar docs da versão instalada antes de codar |
| Flash de tema errado no server render | Persistir tema em cookie e resolver no servidor |
| Escopo inchar (features de equipe) | Lista explícita de "fora de escopo" (§5) |

---

## 15. Evolução futura (pós-v1)

- Publicar migrações no Supabase Cloud e implantar o app para acesso remoto.
- Possíveis incrementos (fora da v1): lembretes/notificações, subtarefas,
  recorrência, refino de responsividade mobile, painel de detalhe da tarefa.
</content>
</invoke>
