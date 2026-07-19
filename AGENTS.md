# AGENTS.md — MicroTaskManager

Notas para desenvolvedores e agentes IA que reconstroem este produto.

## Stack
- Next.js 16 (App Router, TypeScript), React 19
- Supabase (Postgres + Auth), local via CLI + Docker
- Testes: Vitest 4 + @testing-library/react + jsdom

## Regra de versão
Antes de escrever código que use APIs do Next.js/Supabase, **consulte a doc da
versão instalada** (ver `package.json`). Esta versão pode divergir de tutoriais
antigos (PRD §9).

## Comandos
- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (config Next)
- `npm run test` — Vitest (watch); use `npm run test -- --run` para rodada única

## Arquitetura testável
Lógica de domínio (validação, ordenação, status de prazo) vive em `src/domain/*`,
pura e isolada de UI/dados, coberta por testes unitários. Acesso a dados e UI são
testados à parte. Server Components async não são testáveis em unit (usar E2E no futuro).

## Testes E2E (Playwright)
- `npm run e2e` — roda os testes em `e2e/` (Playwright + Chromium). Sobe seu próprio
  dev server numa porta dedicada (`E2E_PORT`, default 3100).
- **Pré-requisitos locais:** Supabase local no ar (`npx supabase start`) e o usuário
  dono já criado (ver "Conta de desenvolvimento"). Sem isso, os testes de login pulam/falham.
- **Credenciais:** vêm de `.env.local` (`E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`) — não
  versionadas. O `playwright.config.ts` carrega o `.env.local` via `dotenv`.
- **NÃO entra no gate `ci`** do GitHub (que roda typecheck+lint+test): o E2E depende de
  Supabase/servidor e roda localmente.

## Convenções de fluxo
Ver `CLAUDE.md` (Linear ↔ GitHub, prefixo GC). Toda story: branch com o ID, PR com
`Fixes GC-<n>`, CI verde para mesclar.

## Conta de desenvolvimento (Supabase local)
- Supabase local roda em portas próprias (ver `supabase/config.toml`); suba com `npx supabase start`.
- `.env.local` (não versionado) aponta para a API local; use `.env.example` como molde.
- Usuário dono (single-user): `glaubercosta@versatecnologia.com.br`. A senha é um segredo
  local de dev — crie/defina o dono via Admin API do Supabase local (ver plano GC-b, Task 5),
  não há cadastro no app.
