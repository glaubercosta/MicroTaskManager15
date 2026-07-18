# CLAUDE.md — MicroTaskManager15

Repositório de **teste operacional** da integração Linear ↔ GitHub, validando o fluxo
**Superpowers → Linear → código → PR → status automático**.

> **Linear é a fonte de verdade das stories.** Todo trabalho começa por uma issue no Linear.
> Prefixo do time: **`GC`** (ex.: `GC-12`).

---

## Convenções obrigatórias (valem para você e para qualquer agente IA)

Um PR aberto **sem o ID do Linear** quebra o rastreamento. Nunca abra PR sem o ID.

### Branch
- Gere o nome pelo atalho do Linear na issue (`Cmd/Ctrl + Shift + .`), que já inclui o ID.
- Formato: `glauber/gc-<n>-<slug-curto>` — ex.: `glauber/gc-12-crud-tarefa`.

### Título do PR
- Sempre inclua o ID: `GC-12 CRUD de tarefa`.

### Descrição do PR — magic word
- **Fechar/mover ao concluir:** `Fixes GC-12` (também servem `Closes`, `Resolves`, `Implements`).
- **Vincular sem fechar automático:** `Ref GC-12` ou `Part of GC-12`.
- **Múltiplas issues:** `Fixes GC-12, GC-13 and GC-14`.
- **Desvincular** um PR que herdou o ID pela branch: `skip GC-12` ou `ignore GC-12`.

### Commit (apenas se o commit linking estiver ligado — §4.6 do roteiro)
- Magic word antes do ID na mensagem: `Fixes GC-12`.

---

## Fluxo ponta a ponta

1. Requisitos no VSCode + Superpowers: brainstorming → spec → plano numerado (markdown no repo).
2. Claude cria Project/épico e Issues no **Linear via MCP** a partir do plano. Cada spec recebe o ID no topo (ex.: `GC-12`).
3. Iniciar story → copiar branch com o atalho do Linear → criar a branch.
4. Codificar e commitar.
5. Abrir PR (ID no título + `Fixes GC-<n>` na descrição) → issue vai para **In Progress**.
6. Review/checks → **In Review** / **Ready**.
7. Merge na `main` → issue vai para **Done**.

---

## Regras do repositório (já configuradas)

- **Branch protection (ruleset `protect-main`) na `main`:** merge só via **Pull Request**; exige o
  status check **`ci`** verde; sem force-push nem deleção da branch. Push direto na `main` é bloqueado.
- **Workflow `ci`** (`.github/workflows/ci.yml`): check trivial (`echo ok`) para exercitar a
  automação "ready for merge" do Linear. Substituir por lint/testes reais quando houver stack.
- Repo **público** (necessário para branch protection no plano free do GitHub).

---

## Notas do teste (repo pessoal / dev solo)

- Sem exigir *review* (0 aprovações no ruleset): o estado "In Review" do Linear só aparece se você
  **solicitar um review** explicitamente. A automação "ready for merge" dispara pelo check `ci`.
- Check `ci` falho deixa o PR "unstable" e a automação de "ready for merge" não roda.
- **Sync de GitHub Issues fica DESLIGADO** nesta rodada (ligar só em teste dedicado).
