# GC-a — Scaffolding + CI real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repositório com um projeto Next.js 16 (App Router, TypeScript) rodando, com Vitest/lint configurados e o check `ci` do GitHub transformado em gatekeeper real (`install → typecheck → lint → test`), provado por um teste de domínio puro.

**Architecture:** Projeto Next.js com `src/`; a **lógica de domínio** vive em módulos puros isolados de UI e dados (`src/domain/*`), testados com Vitest. UI/Server Components virão nas stories seguintes. O CI executa a mesma sequência que o dev roda local.

**Tech Stack:** Next.js 16 (App Router, TS), React 19, Vitest 4 + @vitejs/plugin-react + jsdom + @testing-library/react + @testing-library/jest-dom + vite-tsconfig-paths, ESLint (config do create-next-app), GitHub Actions.

> **Base:** este plano implementa a story **GC-a** do design [`2026-07-18-microtaskmanager-v1-design.md`](../specs/2026-07-18-microtaskmanager-v1-design.md) (§4). O PRD (`PRD.md` §9) manda **consultar a doc da versão instalada** do Next.js/CLI antes de rodar — se as flags/saída do `create-next-app` divergirem do descrito, siga a versão instalada.

---

## File Structure (ao fim da GC-a)

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `next-env.d.ts` (gerados pelo scaffold)
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` (gerados pelo scaffold)
- Create: `vitest.config.mts` — configuração do Vitest
- Create: `vitest.setup.ts` — matchers do jest-dom
- Create: `src/domain/task.ts` — domínio puro (validação de título)
- Test: `src/domain/task.test.ts` — colocado ao lado do módulo
- Modify: `.github/workflows/ci.yml` — pipeline real
- Create: `AGENTS.md` — notas de reprodução e comandos
- Modify: `.gitignore` — acrescentar ignores do Node/Next
- Preservar sem tocar: `README.md`, `CLAUDE.md`, `PRD.md`, `docs/`, os dois `linear-*.md`

---

## Task 1: Scaffold do Next.js dentro do repositório

O `create-next-app` recusa rodar se houver arquivos conflitantes na pasta (ex.: `README.md`, `.gitignore`). Para preservar os docs do repo, geramos em pasta temporária **fora** do repo e copiamos só o que é novo.

- [ ] **Step 1: Gerar o projeto numa pasta temporária**

Run:
```bash
cd "$(git -C . rev-parse --show-toplevel)/.."
npx create-next-app@latest mtm-scaffold-tmp \
  --typescript --eslint --app --src-dir --no-tailwind \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```
Expected: cria `../mtm-scaffold-tmp` com `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `src/app/`, `public/`. Se a CLI perguntar algo apesar do `--yes`, responda conforme as flags acima e **anote a divergência** para ajustar este plano.

- [ ] **Step 2: Copiar os arquivos gerados para o repo (sem sobrescrever docs)**

Run (a partir da raiz do repo):
```bash
REPO="$(git rev-parse --show-toplevel)"
SRC="$REPO/../mtm-scaffold-tmp"
cp -r "$SRC/src" "$REPO/"
cp -r "$SRC/public" "$REPO/"
cp "$SRC/package.json" "$SRC/package-lock.json" "$SRC/tsconfig.json" \
   "$SRC/next.config.ts" "$SRC/eslint.config.mjs" "$SRC/next-env.d.ts" "$REPO/"
cat "$SRC/.gitignore" >> "$REPO/.gitignore"
rm -rf "$SRC"
```
Expected: o repo agora tem `src/app/`, `public/`, e os arquivos de config na raiz; `.gitignore` ganhou os ignores do Next (`/node_modules`, `/.next/`, etc.).

- [ ] **Step 3: Instalar dependências e provar que o app builda**

Run:
```bash
npm install
npm run build
```
Expected: `npm run build` conclui sem erro (compila a página inicial padrão do Next).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "GC-7 scaffold Next.js 16 (App Router, TS) no repo"
```

---

## Task 2: Scripts de qualidade no package.json

- [ ] **Step 1: Garantir os scripts `typecheck` e `test`**

Edite `package.json` para que a seção `scripts` contenha exatamente:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest"
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem saída de erro (exit 0).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "GC-7 adiciona scripts typecheck e test"
```

---

## Task 3: Configurar o Vitest

- [ ] **Step 1: Instalar dependências de teste**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom \
  vite-tsconfig-paths
```
Expected: pacotes adicionados em `devDependencies`.

- [ ] **Step 2: Criar `vitest.config.mts`**

Create `vitest.config.mts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 3: Criar `vitest.setup.ts`**

Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Rodar o Vitest (ainda sem testes)**

Run: `npm run test -- --run`
Expected: Vitest inicia e reporta "No test files found" (exit 0 ou aviso; nenhum erro de configuração).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.mts vitest.setup.ts package.json package-lock.json
git commit -m "GC-7 configura Vitest (jsdom + testing-library)"
```

---

## Task 4: Primeiro teste de domínio puro (TDD) — validação de título

Prova a esteira TDD com a regra do RF-3.2 (título vazio é rejeitado).

- [ ] **Step 1: Escrever o teste que falha**

Create `src/domain/task.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateTitle } from './task'

describe('validateTitle', () => {
  it('retorna o título aparado quando válido', () => {
    expect(validateTitle('  Comprar café  ')).toBe('Comprar café')
  })

  it('rejeita título vazio ou só com espaços', () => {
    expect(() => validateTitle('   ')).toThrow('vazio')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: FAIL — módulo `./task` não existe / `validateTitle` não definido.

- [ ] **Step 3: Implementação mínima**

Create `src/domain/task.ts`:
```ts
/** Valida e normaliza o título de uma tarefa (RF-3.2). Lança se vazio. */
export function validateTitle(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('O título da tarefa não pode ser vazio.')
  }
  return trimmed
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-7 dominio: validateTitle com teste (RF-3.2)"
```

---

## Task 5: CI real (substituir o `echo ok`)

- [ ] **Step 1: Reescrever `.github/workflows/ci.yml`**

Replace `.github/workflows/ci.yml` com:
```yaml
name: CI

# Gate real da integração: install -> typecheck -> lint -> test.
# O ruleset protect-main exige o check "ci" verde para mesclar na main.
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    name: ci
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install
        run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm run test -- --run
```

- [ ] **Step 2: Rodar a sequência do CI localmente**

Run:
```bash
npm ci && npm run typecheck && npm run lint && npm run test -- --run
```
Expected: as quatro etapas passam (exit 0). Se `npm run lint` reclamar de config interativa na primeira execução, aceite o default do Next (ESLint estrito) e rode de novo.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "GC-7 CI real: install/typecheck/lint/test barrando merge"
```

---

## Task 6: AGENTS.md (notas de reprodução)

- [ ] **Step 1: Criar `AGENTS.md`**

Create `AGENTS.md`:
```markdown
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

## Convenções de fluxo
Ver `CLAUDE.md` (Linear ↔ GitHub, prefixo GC). Toda story: branch com o ID, PR com
`Fixes GC-<n>`, CI verde para mesclar.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "GC-7 adiciona AGENTS.md com comandos e convencoes"
```

---

## Self-Review (preenchido)

**Spec coverage (design §4 GC-a):** scaffolding Next 16 (T1) ✓; Vitest+lint (T2,T3) ✓; estrutura domínio puro isolado (T4, `src/domain`) ✓; `ci.yml` real install→typecheck→lint→test (T5) ✓; AGENTS.md com pré-requisitos/comandos (T6) ✓; DoD "1 teste de domínio passa local e no CI + check barra merge" (T4 + T5) ✓.

**Placeholder scan:** sem TBD/TODO; todos os steps têm comando ou código concreto. A única incerteza sinalizada (flags/saída do `create-next-app` da versão instalada) é intencional e coberta pela regra de versão do PRD.

**Type consistency:** `validateTitle(raw: string): string` definido em T4 e usado só ali; scripts (`typecheck`, `test`, `lint`) definidos em T2 e reutilizados igualzinho em T5. `ci.yml` usa `name: ci` (casa com o required status check do ruleset `protect-main`).

---

## Nota sobre os commits

Os commits deste plano usam `GC-7` (issue de planejamento/fundação). Se a story de
scaffolding receber um ID próprio (ex.: `GC-8`) na criação das issues, ajuste o prefixo
das mensagens para o ID real antes de abrir o PR.
