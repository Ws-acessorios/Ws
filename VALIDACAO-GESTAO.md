# Validação da Gestão

## Verificação pública

Na versão publicada em 20 de agosto de 2026, a página `/gestao` apresentou correctamente a marca WS Acessórios, o catálogo com 15 produtos e as quatro colecções publicadas. A área de edição permaneceu oculta até à acção explícita **Gerir conteúdos**.

## Controlo de acesso

Foi submetido um token de teste deliberadamente inválido. A Gestão apresentou a mensagem **“O token GitHub é inválido ou expirou.”** e não revelou os controlos autenticados de produtos, colecções ou workspace. Não foi criada qualquer alteração no repositório.

## Apresentação e comportamento inicial

Na vista pública de 1280 px, a largura do documento foi de 1265 px, sem transbordo horizontal. O editor só ficou visível após a acção explícita do utilizador e o workspace continuou bloqueado enquanto a sessão GitHub não foi validada.

A página publicada apresentou a directiva `noindex, nofollow, noarchive` e carregou a versão `admin.js?v=gestao-segura-1`. Após a rejeição do token de teste, os controlos autenticados permaneceram ocultos.

## Validações automatizadas

O comando `pnpm test && pnpm run typecheck && pnpm run build` terminou com sucesso. A verificação confirmou a preservação dos 12 produtos originais, a inexistência de persistência do token no código cliente e a presença dos controlos de sessão e workspace.
