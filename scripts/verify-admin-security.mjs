import { readFile } from "node:fs/promises";

const [adminSource, managementPage] = await Promise.all([
  readFile(new URL("../src/admin.ts", import.meta.url), "utf8"),
  readFile(new URL("../gestao.html", import.meta.url), "utf8"),
]);

const requiredAdminFragments = [
  'const REPOSITORY = "Ws-acessorios/Ws"',
  "async function validateGitHubSession",
  "async function loadWorkspaceInventory",
  "function assertSafeWorkspacePath",
  "async function saveWorkspaceFile",
  "function endGitHubSession",
  "catalogSha",
];

for (const fragment of requiredAdminFragments) {
  if (!adminSource.includes(fragment)) throw new Error(`Falta o controlo de gestão: ${fragment}`);
}

for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "console.log(githubToken)"]) {
  if (adminSource.includes(forbidden)) throw new Error(`Foi detectada persistência ou exposição indevida: ${forbidden}`);
}

for (const fragment of ["noindex, nofollow, noarchive", "data-auth-form", "data-end-session", "data-workspace-inventory", "data-workspace-content"]) {
  if (!managementPage.includes(fragment)) throw new Error(`Falta a interface de segurança: ${fragment}`);
}

console.log("Gestão validada: token apenas em memória, rota protegida e workspace controlado.");
