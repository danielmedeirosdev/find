# ONEFIND — Design skills e MCPs (configuração do ambiente)

Este documento prepara o ambiente de desenvolvimento, **não instala ferramentas no site de produção**. Execute na raiz do repositório, após revisar os instaladores externos. Requer Node.js e um agente compatível (Codex, Claude Code ou Cursor).

## Skills oficiais

```bash
npx skills@latest add emilkowalski/skills
npx impeccable install
npx skills add Leonxlnx/taste-skill --skill design-taste-frontend
```

Escolha instalação **no projeto** e o agente efetivamente utilizado. Inspecione os SKILL.md e qualquer hook antes de autorizar. Reinicie o agente. Inicialize o Impeccable no agente para gerar contexto de produto.

## MCPs (configuração por agente)

Para **Codex**:

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
codex mcp add playwright npx "@playwright/mcp@latest"
```

Para **Claude Code**:

```bash
claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
claude mcp add playwright npx @playwright/mcp@latest
```

Figma requer autenticação interativa do proprietário. Não grave tokens no repositório. Para Cursor, configure os servidores pela tela Tools & MCP.

## Fluxo de trabalho ONEFIND

1. Fazer auditoria de UI antes de alterar componentes.
2. Usar Taste para tipografia/layout, Emil para motion e Impeccable para crítica e polimento.
3. Usar Figma somente com arquivos autorizados.
4. Testar via Playwright em 390px e 1440px, com screenshots, console e navegação; complementar com 320px e 430px.
5. Executar `npm run lint`, `npm test` e `npm run build` antes de publicar.
6. Não alterar Supabase, pagamentos, autenticação, RLS, agendamentos ou dados reais durante uma revisão visual.

O projeto já possui `@playwright/test` como dependência de desenvolvimento. Isso **não** significa que o servidor Playwright MCP esteja conectado.

Fontes: https://github.com/emilkowalski/skills ; https://github.com/pbakaus/impeccable ; https://github.com/Leonxlnx/taste-skill ; https://github.com/microsoft/playwright-mcp ; https://mcp.figma.com/mcp
