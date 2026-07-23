# Design — MicroTaskManager v1.1 · Hardening (GC-18)

**Data:** 2026-07-23 · **Épico:** GC-18 · **Origem:** follow-ups não bloqueantes das reviews dos PRs #10, #11 e #13 do v1 (épico GC-13, concluído).

## Objetivo

Endurecer o v1 em quatro frentes — acessibilidade (contraste), segurança (cookie de tema, posse de `list_id`, escopo do logout), performance (filtro por lista no banco) e robustez da suíte de testes — sem mudar o comportamento de produto percebido, exceto onde a issue diz o contrário (GC-23 adiciona "apagar lista").

## Processo

- 7 issues em sequência de prioridade: **GC-19 → GC-20 → GC-21 → GC-22 → GC-23 → GC-24 → GC-25**.
- Cada issue: branch gerada pelo Linear, PR com `Fixes GC-<n>` no corpo e ID no título, check `ci` verde, merge antes de iniciar a próxima (GC-23 e GC-25 tocam os mesmos specs de E2E; a serialização evita conflito).
- Execução subagent-driven a partir de um único plano com 7 tasks. TDD onde há lógica.
- Convenção de teste do v1 mantida: testes que dependem do Supabase local (`test:integration`, `e2e`) ficam fora do gate `ci`.

## GC-19 · Contraste do PriorityDot `low` (WCAG 1.4.11)

**Problema:** o dot é monocromático por opacidade sobre a cor do texto; no tema claro, `low` fica abaixo de 3:1 contra o fundo.

**Solução:** trocar opacidade por **cores sólidas por token** — `--dot-high`, `--dot-medium`, `--dot-low` definidos em `globals.css` para cada tema, escolhidos para razão ≥3:1 contra o fundo do respectivo tema. `PriorityDot` passa a usar `var(--dot-<p>)` sem opacidade.

**Teste:** unit com função pura de luminância relativa/razão de contraste (WCAG) validando cada par token×fundo dos dois temas (≥3:1). A função vive junto dos testes (utilidade de teste, não código de produto). O teste **lê os valores dos tokens direto de `globals.css`** (regex sobre o arquivo) — mudar o CSS sem manter o contraste quebra o teste, sem constante duplicada.

## GC-20 · Cookie de tema: `Secure` + parsing exato

**Problema (a):** cookie `theme` emitido sem `Secure`. **Solução:** condicional a produção — server action do toggle usa `secure: process.env.NODE_ENV === 'production'`; o script inline anexa `; secure` quando `location.protocol === 'https:'`. Dev local via HTTP continua funcionando. `SameSite=Lax` mantido e conferido nos dois caminhos.

**Problema (b):** o script inline detecta o cookie com `indexOf('theme=')`, que casa também `x-theme=`. **Solução:** função pura `hasThemeCookie(cookieString: string): boolean` em `src/domain/theme.ts` (split por `'; '` + prefixo exato `theme=`), coberta por unit tests (casos: vazio, só `theme=`, `x-theme=` sem `theme=`, ambos). O script inline replica a mesma lógica (é string, não importa módulo); o unit test do layout confere que o script gerado contém o parsing novo e não contém `indexOf`.

## GC-21 · `createTask` valida posse do `list_id`

**Problema:** a FK só valida existência; a RLS de `tasks` valida `user_id` da task, não da lista. Um UUID vazado permitiria criar task "dentro" de lista alheia.

**Solução:** na server action, quando `list_id` vier no form, fazer `select id` na `lists` com o client RLS do usuário; ausência de linha → retornar erro de validação pelo mesmo canal dos demais erros do form. Sem mudança de schema.

**Teste:** integração com 2 usuários — B tenta criar task com `list_id` de A → rejeitado; fluxo normal (lista própria e sem lista) intacto.

## GC-22 · Logout com escopo local

**Solução:** `supabase.auth.signOut({ scope: 'local' })` em `src/app/login/actions.ts`. Encerra só a sessão corrente em vez de revogar todas as sessões da conta.

**Fora de escopo:** paralelizar o Playwright (`workers: 1` fica como está; anotado na issue como possível follow-up — mudança com risco próprio).

**Teste:** E2E de auth existente cobre o fluxo; unit da action se aplicável (assert do argumento `scope`).

## GC-23 · `deleteList` com cascade + limpeza do E2E

**Decisão (aprovada):** apagar a lista **apaga as tarefas junto** (cascade).

**Solução:**

- Migration: recriar a FK `tasks.list_id` com `ON DELETE CASCADE`.
- Server action `deleteList(id)`: delete na `lists` com client RLS (posse garantida pela policy); revalida a página; se a lista apagada era a ativa (`?list=`), a UI volta para "Todas" (redirect).
- UI mínima: botão "apagar lista" junto à aba ativa, com `confirm()` nativo cujo texto deixa explícito que as tarefas da lista serão apagadas.
- E2E de listas: teardown apaga a lista criada → duas execuções seguidas não acumulam listas.

**Teste:** integração — RLS impede apagar lista alheia; cascade remove as tasks da lista; unit das funções puras se surgirem; E2E do fluxo apagar + verificação de não-acúmulo.

## GC-24 · Índice em `tasks.list_id` + filtro no banco

**Solução:** migration `create index tasks_list_id_idx on tasks(list_id)`; a página passa a filtrar com `.eq('list_id', ...)` quando há `?list=` válido, removendo o filtro em memória de `src/domain/list.ts` (as demais funções puras — ordenar, agrupar, contar — permanecem). Comportamento das abas idêntico.

**Teste:** integração cobrindo o filtro no banco (task de outra lista não vem); E2E de listas existente segue verde.

## GC-25 · Robustez da suíte de testes

1. `e2e/theme.spec.ts`: fixar o estado inicial no setup (`context.addCookies` com `theme=dark`) em vez de assumir dark — run abortado que deixou cookie `light` não quebra o próximo.
2. Specs com `getByLabel` de prioridade/prazo: adicionar `{ exact: true }` (rótulos "X de T" / "Aplicar X de T" colidem em substring).

**Teste:** a própria suíte — `npm run e2e` verde, inclusive imediatamente após um run interrompido no meio do `theme.spec`.

## Riscos e notas

- GC-19: escolher tons que preservem a hierarquia visual (high mais forte que low) além do contraste — validar a olho nos dois temas.
- GC-23: cascade é destrutivo; o texto do `confirm()` é a única barreira — deixar inequívoco.
- Migrations (GC-23, GC-24) precisam ser aplicadas no Supabase local antes dos testes de integração/E2E (`npx supabase migration up`).
- O spec doc e o plano entram no repo pela branch da primeira issue (GC-19), como no v1 (push direto na `main` é bloqueado).
