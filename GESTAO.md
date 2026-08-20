# Gestão da WS Acessórios

A Gestão está disponível em [`/gestao`](https://ws-acessorios.github.io/Ws/gestao). É uma ferramenta estática publicada pelo GitHub Pages: o token é utilizado directamente pelo navegador apenas durante a página aberta e não é guardado em armazenamento persistente, cookies, ficheiros do catálogo ou commits.

## Token GitHub recomendado

Crie um **fine-grained personal access token** limitado exclusivamente ao repositório `Ws-acessorios/Ws`. Seleccione as permissões mínimas abaixo.

| Permissão | Nível | Utilização |
|---|---:|---|
| Metadata | Read-only | Verificar o repositório configurado |
| Contents | Read and write | Ler e publicar o catálogo, imagens e ficheiros permitidos |

Depois de validar o token na Gestão, o navegador confirma o repositório e a branch `main`, obtém o SHA remoto do catálogo e só então disponibiliza os controlos de publicação. Ao terminar, use **Terminar sessão** para remover o token da memória. Revogue o token nas definições do GitHub quando deixar de ser necessário.

## Operações suportadas

O painel mantém os produtos originais protegidos e permite gerir produtos, colecções e imagens do catálogo. Também inclui um workspace limitado a ficheiros HTML, CSS, JavaScript, JSON, Markdown, texto, XML, SVG e imagens. Ficheiros de texto até 1 MB podem ser revistos, carregados localmente, descarregados ou publicados depois de confirmação. Imagens de produto têm limite de 8 MB e são comprimidas antes da publicação.

Os caminhos `.git`, `.env`, `node_modules` e `dist`, bem como referências com `..`, são bloqueados. O editor de texto não abre binários; utilize o formulário de produto para imagens. Cada publicação utiliza o SHA que foi lido do GitHub, pelo que alterações remotas concorrentes originam uma mensagem de conflito em vez de uma substituição silenciosa.

## Limitação importante

O GitHub Pages é um alojamento estático. A rota de Gestão tem `noindex`, não aparece na navegação pública e requer um token válido para revelar operações de escrita, mas não substitui um controlo de acesso de servidor. Nunca partilhe o token nem o guarde no navegador.
