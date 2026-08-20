interface CatalogProduct {
  id: string;
  name: string;
  collection: string;
  description: string;
  image: string;
  price?: string;
  active?: boolean;
  source?: "original" | "admin";
  removedByAdmin?: boolean;
}

interface CatalogCollection {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
}

interface Catalog {
  version?: number;
  updatedAt?: string;
  collections?: CatalogCollection[];
  products?: CatalogProduct[];
}

interface GitHubContent {
  type?: "file" | "dir";
  name?: string;
  path?: string;
  sha?: string;
  size?: number;
  content?: string;
  encoding?: string;
}

interface GitHubRepository {
  permissions?: { pull?: boolean; push?: boolean; admin?: boolean };
}

interface GitHubCommitResult {
  content?: { sha?: string; path?: string };
  commit?: { sha?: string };
}

const REPOSITORY = "Ws-acessorios/Ws";
const BRANCH = "main";
const CATALOG_URL = "catalogo.json";
const EDIT_URL = `https://github.com/${REPOSITORY}/edit/${BRANCH}/${CATALOG_URL}`;
const ACTIONS_URL = `https://github.com/${REPOSITORY}/actions/workflows/update-catalog.yml`;
const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;
const MANAGED_IMAGE_PREFIX = "assets/catalogo/";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const TEXT_EXTENSIONS = new Set(["html", "css", "js", "json", "md", "txt", "xml", "svg"]);
const BINARY_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

const ORIGINAL_COLLECTIONS: CatalogCollection[] = [
  { id: "collection_feminina", name: "Feminina", description: "Peças delicadas para todos os dias.", active: true },
  { id: "collection_masculina", name: "Masculina", description: "Acessórios com presença e identidade.", active: true },
  { id: "collection_casais", name: "Casais", description: "Peças para partilhar.", active: true },
  { id: "collection_personalizados", name: "Personalizados", description: "Criações feitas à medida.", active: true },
];

const ORIGINAL_PRODUCTS: CatalogProduct[] = [
  { id: "feminina_hidra_azul", name: "Colar & brincos: Hidra azul", collection: "Feminina", description: "Colar floral com detalhes em vermelho e coloração lápis-lazúli, acompanhado por brincos semelhantes.", image: "assets/femininas1.jpg", source: "original", active: true },
  { id: "feminina_verde_floral", name: "Colar: Verde floral rosa", collection: "Feminina", description: "Colar verde com gema central e detalhes com contas estilo pérolas oceânicas.", image: "assets/femininas2.jpg", source: "original", active: true },
  { id: "feminina_pantera_rosa", name: "Brincos: Pantera rosa", collection: "Feminina", description: "Brincos circulares com aspecto exótico e detalhes em verde e preto.", image: "assets/femininas3.jpg", source: "original", active: true },
  { id: "feminina_telemovel", name: "Acessórios para telemóvel e armações", collection: "Feminina", description: "Acessórios criados para ligar segurança com beleza.", image: "assets/femininas4.jpg", source: "original", active: true },
  { id: "masculina_bracelet", name: "pulseiras: bracelet", collection: "Masculina", description: "pulseiras simples e minimalista.", image: "assets/masculinas1.jpg", source: "original", active: true },
  { id: "masculina_sete_nos", name: "pulseiras: 7 nós perfeitos", collection: "Masculina", description: "Cada nó representa 1 dimensão espiritual. Os 7 nós juntos bloqueiam inveja, mau-olhado e energia negativa, enquanto atraem proteção, prosperidade e força.", image: "assets/masculinas2.jpg", source: "original", active: true },
  { id: "masculina_britanico", name: "pulseira: britanico", collection: "Masculina", description: "pulseira simples e personalizada.", image: "assets/masculinas3.jpg", source: "original", active: true },
  { id: "masculina_conchas", name: "colar:conchas", collection: "Masculina", description: "colar castanho brown com concha central, contas brancas e castanhas e uma forte ligação a praia e a liberdade.", image: "assets/masculinas4.jpg", source: "original", active: true },
  { id: "casais_sempre_juntos", name: "pulseiras: sempre juntos", collection: "Casais", description: "pulseiras criadas para aqueles que estão destinados a estar juntos", image: "assets/casais1.jpg", source: "original", active: true },
  { id: "casais_azul_azul", name: "pulseiras: azul & azul", collection: "Casais", description: "Pulseiras que simbolizam união e compromisso", image: "assets/casais2.jpg", source: "original", active: true },
  { id: "personalizados_identidade", name: "Pulseiras com identidade", collection: "Personalizados", description: "Uma composição personalizada com nomes, letras e símbolos especiais.", image: "assets/IMG_5123.jpeg", source: "original", active: true },
  { id: "personalizados_historias", name: "Detalhes que contam histórias", collection: "Personalizados", description: "Fios, letras e pequenos elementos reunidos numa peça única.", image: "assets/IMG_5122.jpeg", source: "original", active: true },
];

let catalog: Catalog = { version: 1, collections: [], products: [] };
let githubToken = "";
let githubAuthenticated = false;
let catalogSha: string | null = null;
let editingProductId: string | null = null;
let editingCollectionId: string | null = null;
let selectedImage: File | null = null;
let workspaceItems: GitHubContent[] = [];
let workspaceSha: string | null = null;
let workspacePath = "";

function restoreOriginals<T extends { id: string }>(existing: T[], originals: T[]): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  originals.forEach((item) => {
    const current = byId.get(item.id);
    byId.set(item.id, current ? { ...item, ...current } : { ...item });
  });
  return [...byId.values()];
}

function normaliseCatalog(input: Catalog): Catalog {
  const restoredProducts = restoreOriginals(input.products || [], ORIGINAL_PRODUCTS).map((item) => ({
    ...item,
    source: item.source || (ORIGINAL_PRODUCTS.some((original) => original.id === item.id) ? "original" : "admin"),
    active: item.active !== false,
  }));
  return {
    version: input.version || 1,
    updatedAt: input.updatedAt,
    collections: restoreOriginals(input.collections || [], ORIGINAL_COLLECTIONS).map((item) => ({ ...item, active: item.active !== false })),
    products: restoredProducts,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function publicImagePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.replace(/^\.?\//, "");
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || `produto-${Date.now()}`;
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function setStatus(message: string, error = false, target = "[data-editor-status]"): void {
  const element = document.querySelector<HTMLElement>(target);
  if (element) {
    element.textContent = message;
    element.dataset.error = error ? "true" : "false";
  }
}

function setAuthStatus(message: string, error = false): void {
  setStatus(message, error, "[data-auth-status]");
}

function collections(): CatalogCollection[] {
  return catalog.collections || (catalog.collections = []);
}

function products(): CatalogProduct[] {
  return catalog.products || (catalog.products = []);
}

function activeProducts(): CatalogProduct[] {
  return products().filter((item) => item.active !== false);
}

function extensionFor(path: string): string {
  const name = path.split("/").pop() || "";
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function isTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extensionFor(path));
}

function isSupportedPath(path: string): boolean {
  const extension = extensionFor(path);
  return TEXT_EXTENSIONS.has(extension) || BINARY_EXTENSIONS.has(extension);
}

function assertSafeWorkspacePath(input: string): string {
  const path = input.trim().replace(/^\/+/, "");
  const segments = path.split("/");
  if (!path || path.includes("\\") || segments.some((segment) => !segment || segment === "." || segment === ".." || segment === ".git" || segment === "node_modules" || segment === "dist" || segment === ".env" || segment.startsWith(".env."))) {
    throw new Error("O caminho não é permitido para edição na Gestão.");
  }
  if (!isSupportedPath(path)) throw new Error("Este tipo de ficheiro não é suportado. Use HTML, CSS, JavaScript, JSON, Markdown, texto, XML, SVG ou imagens.");
  return path;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function githubHeaders(init: HeadersInit | undefined = undefined): Headers {
  if (!githubToken.trim()) throw new Error("Introduza e valide o token GitHub antes de publicar.");
  const headers = new Headers(init);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${githubToken.trim()}`);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return headers;
}

function contentsUrl(path: string, includeRef = true): string {
  const ref = includeRef ? `?ref=${encodeURIComponent(BRANCH)}` : "";
  return `${GITHUB_API}/contents/${encodePath(path)}${ref}`;
}

async function githubContentsRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(contentsUrl(path, init.method !== "PUT" && init.method !== "DELETE"), { ...init, headers: githubHeaders(init.headers) });
}

async function errorFromResponse(response: Response, fallback: string): Promise<Error> {
  if (response.status === 401) return new Error("O token GitHub é inválido ou expirou.");
  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    return new Error(remaining === "0" ? "O limite temporário da API GitHub foi atingido. Tente novamente mais tarde." : "O token foi aceite, mas não tem permissão de escrita.");
  }
  if (response.status === 404) return new Error("O token não tem acesso ao repositório configurado ou o ficheiro não existe.");
  if (response.status === 409 || response.status === 422) return new Error("O ficheiro remoto mudou ou já existe. Reabra-o para obter o SHA actual antes de publicar.");
  return new Error(`${fallback} (${response.status}).`);
}

async function readGitHubFile(path: string): Promise<GitHubContent> {
  const safePath = assertSafeWorkspacePath(path);
  const response = await githubContentsRequest(safePath);
  if (!response.ok) throw await errorFromResponse(response, `Não foi possível ler ${safePath}`);
  return response.json() as Promise<GitHubContent>;
}

async function writeGitHubFile(path: string, content: string, message: string, expectedSha: string | null = null): Promise<GitHubCommitResult> {
  const safePath = assertSafeWorkspacePath(path);
  const response = await githubContentsRequest(safePath, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch: BRANCH, content, ...(expectedSha ? { sha: expectedSha } : {}) }),
  });
  if (!response.ok) throw await errorFromResponse(response, "O GitHub recusou a publicação");
  return response.json() as Promise<GitHubCommitResult>;
}

async function deleteGitHubFile(path: string, message: string): Promise<void> {
  const existing = await readGitHubFile(path);
  if (!existing.sha) throw new Error("Não foi possível identificar a versão actual da imagem a apagar.");
  const response = await githubContentsRequest(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch: BRANCH, sha: existing.sha }),
  });
  if (!response.ok) throw await errorFromResponse(response, "O GitHub recusou apagar a imagem");
}

function setAuthenticatedView(authenticated: boolean): void {
  document.querySelectorAll<HTMLElement>("[data-authenticated-only]").forEach((element) => element.toggleAttribute("hidden", !authenticated));
  document.querySelectorAll<HTMLElement>("[data-anonymous-only]").forEach((element) => element.toggleAttribute("hidden", authenticated));
}

async function refreshRemoteCatalog(): Promise<void> {
  const file = await readGitHubFile(CATALOG_URL);
  if (!file.content || !file.sha) throw new Error("Não foi possível preparar a versão remota do catálogo.");
  const parsed = JSON.parse(decodeBase64Utf8(file.content)) as Catalog;
  catalog = normaliseCatalog(parsed);
  catalogSha = file.sha;
  renderCatalog(catalog);
}

async function validateGitHubSession(token: string): Promise<void> {
  githubToken = token.trim();
  if (!githubToken) throw new Error("Introduza o token GitHub para continuar.");
  let repositoryResponse: Response;
  try {
    repositoryResponse = await fetch(GITHUB_API, { headers: githubHeaders() });
  } catch {
    githubToken = "";
    throw new Error("Não foi possível contactar o GitHub. Verifique a ligação.");
  }
  if (!repositoryResponse.ok) {
    const error = await errorFromResponse(repositoryResponse, "Não foi possível validar o repositório");
    githubToken = "";
    throw error;
  }
  const repository = await repositoryResponse.json() as GitHubRepository;
  if (repository.permissions?.push === false) {
    githubToken = "";
    throw new Error("O token foi aceite, mas não tem permissão de escrita.");
  }
  let branchResponse: Response;
  try {
    branchResponse = await fetch(`${GITHUB_API}/branches/${encodeURIComponent(BRANCH)}`, { headers: githubHeaders() });
  } catch {
    githubToken = "";
    throw new Error("Não foi possível contactar o GitHub. Verifique a ligação.");
  }
  if (branchResponse.status === 404) {
    githubToken = "";
    throw new Error("A branch configurada não foi encontrada.");
  }
  if (!branchResponse.ok) {
    const error = await errorFromResponse(branchResponse, "Não foi possível validar a branch");
    githubToken = "";
    throw error;
  }
  githubAuthenticated = true;
  await refreshRemoteCatalog();
  setAuthenticatedView(true);
  setAuthStatus(`Sessão validada para ${REPOSITORY} · branch ${BRANCH}. O token ficará apenas nesta memória.`);
  await loadWorkspaceInventory();
}

function endGitHubSession(): void {
  githubToken = "";
  githubAuthenticated = false;
  catalogSha = null;
  workspaceItems = [];
  workspaceSha = null;
  workspacePath = "";
  const tokenField = document.querySelector<HTMLInputElement>("[data-github-token]");
  if (tokenField) tokenField.value = "";
  const workspacePanel = document.querySelector<HTMLElement>("[data-workspace-panel]");
  if (workspacePanel) workspacePanel.innerHTML = "";
  setAuthenticatedView(false);
  setAuthStatus("Sessão terminada. O token foi removido da memória desta página.");
  renderCatalog(catalog);
}

function renderCatalog(catalogData: Catalog): void {
  catalog = normaliseCatalog(catalogData);
  const collectionsElement = document.querySelector<HTMLElement>("[data-published-collections]");
  const productsElement = document.querySelector<HTMLElement>("[data-published-products]");
  const updatedElement = document.querySelector<HTMLElement>("[data-catalog-updated]");
  if (updatedElement && catalog.updatedAt) {
    const date = new Date(catalog.updatedAt);
    updatedElement.textContent = Number.isNaN(date.getTime()) ? "Catálogo publicado" : `Publicado em ${date.toLocaleDateString("pt-PT")}`;
  }
  if (collectionsElement) {
    const visibleCollections = collections().filter((item) => item.active !== false);
    collectionsElement.innerHTML = `<h2>Colecções publicadas</h2><div class="published-grid">${visibleCollections.length ? visibleCollections.map((item) => `<article class="published-row"><strong>${escapeHtml(item.name)}</strong>${item.description ? `<span>${escapeHtml(item.description)}</span>` : ""}</article>`).join("") : "<p class=\"admin-empty\">Ainda não existem colecções publicadas.</p>"}</div>`;
  }
  if (productsElement) {
    const controls = (item: CatalogProduct) => githubAuthenticated ? `<button type="button" data-edit-product="${escapeHtml(item.id)}">Editar</button><button type="button" class="remove" data-remove-product="${escapeHtml(item.id)}">Apagar</button>` : "";
    productsElement.innerHTML = `<h2>Produtos publicados</h2><div class="published-products">${activeProducts().length ? activeProducts().map((item) => `<article class="published-product"><img src="${escapeHtml(publicImagePath(item.image))}" alt="${escapeHtml(item.name)}" loading="lazy"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.collection)} · ${item.source === "original" ? "Catálogo original" : "Adicionado pela gestão"}</span>${item.price ? `<b>${escapeHtml(item.price)}</b>` : ""}${controls(item)}</div></article>`).join("") : "<p class=\"admin-empty\">Ainda não existem produtos publicados.</p>"}</div>`;
  }
  renderEditorLists();
}

function renderEditorLists(): void {
  const collectionList = document.querySelector<HTMLElement>("[data-editor-collections]");
  const productList = document.querySelector<HTMLElement>("[data-editor-products]");
  if (collectionList) {
    collectionList.innerHTML = collections().map((item) => `<li><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "Sem descrição")}</small></span><span><button type="button" data-edit-collection="${escapeHtml(item.id)}">Editar</button><button type="button" data-remove-collection="${escapeHtml(item.id)}">Remover</button></span></li>`).join("");
  }
  if (productList) {
    productList.innerHTML = activeProducts().map((item) => `<li><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.collection)} · ${item.source === "original" ? "Original" : "Gestão"}${item.price ? ` · ${escapeHtml(item.price)}` : ""}</small></span><button type="button" data-edit-product="${escapeHtml(item.id)}">Editar</button><button type="button" class="remove" data-remove-product="${escapeHtml(item.id)}">Apagar</button></li>`).join("");
  }
  const collectionSelect = document.querySelector<HTMLSelectElement>("[data-product-collection]");
  if (collectionSelect) {
    const current = collectionSelect.value;
    collectionSelect.innerHTML = collections().filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");
    if (current && collections().some((item) => item.name === current)) collectionSelect.value = current;
  }
}

async function loadCatalog(): Promise<void> {
  const response = await fetch(`${CATALOG_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar o catálogo publicado.");
  renderCatalog(await response.json() as Catalog);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File): Promise<{ path: string; base64: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Seleccione uma imagem válida.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 8 MB.");
  const source = await fileToDataUrl(file);
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Imagem inválida.")); });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.86);
  const baseName = slugify(file.name.replace(/\.[^.]+$/, ""));
  return { path: `assets/catalogo/${baseName}-${Date.now().toString(36)}.jpg`, base64: compressed.split(",")[1] };
}

function readInput(selector: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim() || "";
}

function requireAuthenticated(): void {
  if (!githubAuthenticated) throw new Error("Valide primeiro o token GitHub para gerir conteúdos.");
}

function clearProductForm(): void {
  editingProductId = null;
  selectedImage = null;
  document.querySelector<HTMLFormElement>("[data-product-form]")?.reset();
  const collectionField = document.querySelector<HTMLSelectElement>("[data-product-collection]");
  if (collectionField) collectionField.disabled = false;
  const title = document.querySelector<HTMLElement>("[data-product-form-title]");
  if (title) title.textContent = "Adicionar produto";
  const imageName = document.querySelector<HTMLElement>("[data-image-name]");
  if (imageName) imageName.textContent = "Nenhuma imagem seleccionada";
}

function editProduct(id: string): void {
  const product = products().find((item) => item.id === id);
  if (!product) return;
  document.querySelector<HTMLElement>("[data-editor-panel]")?.removeAttribute("hidden");
  editingProductId = id;
  (document.querySelector<HTMLInputElement>("[data-product-name]")!).value = product.name;
  const collectionField = document.querySelector<HTMLSelectElement>("[data-product-collection]")!;
  collectionField.value = product.collection;
  collectionField.disabled = product.source === "original";
  (document.querySelector<HTMLTextAreaElement>("[data-product-description]")!).value = product.description;
  (document.querySelector<HTMLInputElement>("[data-product-price]")!).value = product.price || "";
  const title = document.querySelector<HTMLElement>("[data-product-form-title]");
  if (title) title.textContent = product.source === "original" ? "Editar produto original" : "Editar produto";
  setStatus(`A editar: ${product.name}`);
  window.setTimeout(() => document.querySelector<HTMLElement>("[data-product-form]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

async function saveProduct(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  requireAuthenticated();
  const name = readInput("[data-product-name]");
  const collection = (document.querySelector<HTMLSelectElement>("[data-product-collection]")?.value || "").trim();
  const description = readInput("[data-product-description]");
  const price = readInput("[data-product-price]");
  if (!name || !collection || !description || (!editingProductId && !selectedImage)) {
    setStatus("Preencha nome, colecção, descrição e uma imagem para um produto novo.", true);
    return;
  }
  let product = editingProductId ? products().find((item) => item.id === editingProductId) : undefined;
  if (!product) {
    const baseId = `${slugify(collection)}_${slugify(name).replace(/-/g, "_")}`;
    const id = products().some((item) => item.id === baseId) ? `${baseId}_${Date.now()}` : baseId;
    product = { id, name, collection, description, image: "", source: "admin", active: true };
    products().push(product);
  } else {
    product.name = name;
    product.collection = collection;
    product.description = description;
  }
  product.price = price || undefined;
  if (selectedImage) {
    setStatus("A preparar e publicar a imagem…");
    const prepared = await prepareImage(selectedImage);
    await writeGitHubFile(prepared.path, prepared.base64, `Adicionar imagem: ${name}`);
    product.image = prepared.path;
  }
  if (!product.image) {
    setStatus("O produto precisa de uma imagem publicada.", true);
    return;
  }
  await publishCatalog(`Actualizar produto: ${name}`);
  clearProductForm();
  renderCatalog(catalog);
  setStatus("Produto publicado com sucesso.");
}

async function publishCatalog(message = "Actualizar catálogo"): Promise<void> {
  requireAuthenticated();
  if (!catalogSha) throw new Error("A versão remota do catálogo ainda não foi preparada. Termine sessão e valide novamente o token.");
  catalog = normaliseCatalog(catalog);
  catalog.version = (catalog.version || 1) + 1;
  catalog.updatedAt = new Date().toISOString();
  const result = await writeGitHubFile(CATALOG_URL, encodeBase64Utf8(`${JSON.stringify(catalog, null, 2)}\n`), message, catalogSha);
  catalogSha = result.content?.sha || catalogSha;
}

async function removeProduct(id: string): Promise<void> {
  requireAuthenticated();
  const product = products().find((item) => item.id === id);
  if (!product) return;
  const imageIsManaged = product.image.startsWith(MANAGED_IMAGE_PREFIX);
  const imageIsShared = products().some((item) => item.id !== id && item.image === product.image);
  const removeImage = imageIsManaged && !imageIsShared;
  const confirmation = removeImage
    ? `Apagar “${product.name}” e a sua imagem publicada? Esta acção não pode ser desfeita.`
    : `Apagar “${product.name}” do catálogo? A imagem será mantida porque é partilhada ou faz parte dos conteúdos originais.`;
  if (!confirm(confirmation)) return;
  const previousProducts = products().map((item) => ({ ...item }));
  if (product.source === "original") {
    product.active = false;
    product.removedByAdmin = true;
  } else {
    catalog.products = previousProducts.filter((item) => item.id !== id);
  }
  try {
    await publishCatalog(`Apagar produto individualmente: ${product.name}`);
    renderCatalog(catalog);
    if (product.source === "original") {
      setStatus("Produto original removido apenas por esta acção do administrador. A imagem foi preservada.");
      return;
    }
    if (removeImage) {
      try {
        await deleteGitHubFile(product.image, `Apagar imagem: ${product.name}`);
        setStatus("Produto e imagem apagados com sucesso.");
      } catch (error) {
        setStatus(error instanceof Error ? `Produto removido, mas a imagem foi mantida: ${error.message}` : "Produto removido, mas a imagem foi mantida.", true);
      }
    } else {
      setStatus("Produto apagado do catálogo. A imagem foi mantida em segurança.");
    }
  } catch (error) {
    catalog.products = previousProducts;
    renderCatalog(catalog);
    throw error;
  }
}

function editCollection(id: string): void {
  const collection = collections().find((item) => item.id === id);
  if (!collection) return;
  editingCollectionId = id;
  (document.querySelector<HTMLInputElement>("[data-collection-name]")!).value = collection.name;
  (document.querySelector<HTMLInputElement>("[data-collection-description]")!).value = collection.description || "";
  const title = document.querySelector<HTMLElement>("[data-collection-form-title]");
  if (title) title.textContent = "Editar colecção";
  setStatus(`A editar colecção: ${collection.name}`);
  window.setTimeout(() => document.querySelector<HTMLElement>("[data-collection-form]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

async function saveCollection(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  requireAuthenticated();
  const name = readInput("[data-collection-name]");
  const description = readInput("[data-collection-description]");
  if (!name || !description) { setStatus("Preencha o nome e a descrição da colecção.", true); return; }
  if (collections().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== editingCollectionId)) { setStatus("Essa colecção já existe.", true); return; }
  if (editingCollectionId) {
    const collection = collections().find((item) => item.id === editingCollectionId);
    if (!collection) return;
    const previousName = collection.name;
    collection.name = name;
    collection.description = description;
    products().forEach((item) => { if (item.collection === previousName) item.collection = name; });
  } else {
    collections().push({ id: `collection_${slugify(name)}`, name, description, active: true });
  }
  const wasEditing = Boolean(editingCollectionId);
  await publishCatalog(`${wasEditing ? "Editar" : "Adicionar"} colecção: ${name}`);
  document.querySelector<HTMLFormElement>("[data-collection-form]")?.reset();
  editingCollectionId = null;
  const title = document.querySelector<HTMLElement>("[data-collection-form-title]");
  if (title) title.textContent = "Nova colecção";
  renderCatalog(catalog);
  setStatus("Colecção guardada e publicada com sucesso.");
}

function renderWorkspaceInventory(): void {
  const list = document.querySelector<HTMLElement>("[data-workspace-inventory]");
  const filter = document.querySelector<HTMLInputElement>("[data-workspace-filter]")?.value.trim().toLowerCase() || "";
  if (!list) return;
  const visible = workspaceItems.filter((item) => `${item.name || ""} ${item.path || ""}`.toLowerCase().includes(filter));
  list.innerHTML = visible.length
    ? visible.map((item) => `<li><span><strong>${escapeHtml(item.name || item.path || "Ficheiro")}</strong><small>${escapeHtml(item.path || "")} · ${item.type === "dir" ? "Pasta" : `${Math.ceil((item.size || 0) / 1024)} KB`}</small></span>${item.type === "file" && item.path && isSupportedPath(item.path) ? `<button type="button" data-workspace-open="${escapeHtml(item.path)}">${isTextPath(item.path) ? "Abrir" : "Ver regra"}</button>` : ""}</li>`).join("")
    : "<li class=\"admin-empty\">Nenhum ficheiro permitido corresponde à pesquisa.</li>";
}

async function loadWorkspaceInventory(): Promise<void> {
  requireAuthenticated();
  const list = document.querySelector<HTMLElement>("[data-workspace-inventory]");
  if (list) list.innerHTML = "<li class=\"admin-empty\">A carregar inventário…</li>";
  const response = await githubContentsRequest("");
  if (!response.ok) throw await errorFromResponse(response, "Não foi possível listar o repositório");
  const payload = await response.json() as GitHubContent | GitHubContent[];
  workspaceItems = Array.isArray(payload) ? payload.filter((item) => item.type === "dir" || Boolean(item.path && isSupportedPath(item.path))) : [];
  renderWorkspaceInventory();
}

function setWorkspaceEditor(path: string, content: string, sha: string | null): void {
  workspacePath = path;
  workspaceSha = sha;
  const pathField = document.querySelector<HTMLInputElement>("[data-workspace-path]");
  const contentField = document.querySelector<HTMLTextAreaElement>("[data-workspace-content]");
  if (pathField) pathField.value = path;
  if (contentField) contentField.value = content;
  const shaElement = document.querySelector<HTMLElement>("[data-workspace-sha]");
  if (shaElement) shaElement.textContent = sha ? `SHA remoto: ${sha.slice(0, 12)}` : "Novo ficheiro — sem SHA remoto";
}

async function openWorkspaceFile(path: string): Promise<void> {
  const safePath = assertSafeWorkspacePath(path);
  if (!isTextPath(safePath)) {
    setStatus("Este ficheiro é binário e não pode ser editado como texto. Para imagens de produto, use o formulário de produtos.", true);
    return;
  }
  const file = await readGitHubFile(safePath);
  if (!file.content) throw new Error("O ficheiro remoto não contém conteúdo textual editável.");
  setWorkspaceEditor(safePath, decodeBase64Utf8(file.content), file.sha || null);
  setStatus(`Ficheiro aberto para revisão: ${safePath}`);
}

function clearWorkspaceEditor(): void {
  setWorkspaceEditor("", "", null);
  const upload = document.querySelector<HTMLInputElement>("[data-workspace-upload]");
  if (upload) upload.value = "";
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.split("/").pop() || "ficheiro.txt";
  link.click();
  URL.revokeObjectURL(url);
}

async function saveWorkspaceFile(): Promise<void> {
  requireAuthenticated();
  const path = assertSafeWorkspacePath(readInput("[data-workspace-path]"));
  if (!isTextPath(path)) throw new Error("A edição de texto aceita apenas ficheiros textuais permitidos.");
  const content = document.querySelector<HTMLTextAreaElement>("[data-workspace-content]")?.value || "";
  if (new Blob([content]).size > MAX_TEXT_FILE_BYTES) throw new Error("O ficheiro de texto deve ter no máximo 1 MB.");
  if (!confirm(`Publicar “${path}” na branch ${BRANCH}? O GitHub criará um commit.`)) return;
  const result = await writeGitHubFile(path, encodeBase64Utf8(content), `Actualizar através da gestão: ${path}`, workspacePath === path ? workspaceSha : null);
  setWorkspaceEditor(path, content, result.content?.sha || null);
  await loadWorkspaceInventory();
  setStatus(`Ficheiro publicado. Commit: ${result.commit?.sha?.slice(0, 12) || "criado"}.`);
}

async function importCatalog(file: File): Promise<void> {
  if (file.size > MAX_TEXT_FILE_BYTES) throw new Error("O ficheiro de catálogo deve ter no máximo 1 MB.");
  const parsed = JSON.parse(await file.text()) as Catalog;
  if (!Array.isArray(parsed.products) || !Array.isArray(parsed.collections)) throw new Error("O ficheiro não contém a estrutura de catálogo esperada.");
  catalog = normaliseCatalog(parsed);
  renderCatalog(catalog);
  setStatus("Rascunho de catálogo importado apenas para revisão. Use “Gerar catálogo” e publique-o no editor quando confirmar.");
}

function generateCatalogForWorkspace(): void {
  requireAuthenticated();
  const draft: Catalog = { ...normaliseCatalog(catalog), updatedAt: new Date().toISOString() };
  setWorkspaceEditor(CATALOG_URL, `${JSON.stringify(draft, null, 2)}\n`, catalogSha);
  setStatus("Catálogo gerado no editor para revisão. Ainda não foi publicado.");
}

function wireEditor(): void {
  document.querySelector<HTMLButtonElement>("[data-open-editor]")?.addEventListener("click", () => {
    document.querySelector<HTMLElement>("[data-editor-panel]")?.toggleAttribute("hidden");
  });
  document.querySelector<HTMLFormElement>("[data-auth-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = document.querySelector<HTMLInputElement>("[data-github-token]")?.value || "";
    setAuthStatus("A validar o token e a branch configurada…");
    validateGitHubSession(token).catch((error) => setAuthStatus(error instanceof Error ? error.message : "Não foi possível validar a sessão.", true));
  });
  document.querySelector<HTMLButtonElement>("[data-end-session]")?.addEventListener("click", endGitHubSession);
  document.querySelector<HTMLInputElement>("[data-product-image]")?.addEventListener("change", (event) => {
    selectedImage = (event.target as HTMLInputElement).files?.[0] || null;
    const name = document.querySelector<HTMLElement>("[data-image-name]");
    if (name) name.textContent = selectedImage ? `${selectedImage.name} · ${(selectedImage.size / 1024 / 1024).toFixed(1)} MB` : "Nenhuma imagem seleccionada";
  });
  document.querySelector<HTMLFormElement>("[data-product-form]")?.addEventListener("submit", (event) => { saveProduct(event).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao publicar produto.", true)); });
  document.querySelector<HTMLFormElement>("[data-collection-form]")?.addEventListener("submit", (event) => { saveCollection(event).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao publicar colecção.", true)); });
  document.querySelector<HTMLInputElement>("[data-workspace-filter]")?.addEventListener("input", renderWorkspaceInventory);
  document.querySelector<HTMLButtonElement>("[data-refresh-workspace]")?.addEventListener("click", () => loadWorkspaceInventory().catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao actualizar o inventário.", true)));
  document.querySelector<HTMLButtonElement>("[data-new-workspace-file]")?.addEventListener("click", clearWorkspaceEditor);
  document.querySelector<HTMLButtonElement>("[data-save-workspace-file]")?.addEventListener("click", () => saveWorkspaceFile().catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao publicar ficheiro.", true)));
  document.querySelector<HTMLButtonElement>("[data-download-workspace-file]")?.addEventListener("click", () => {
    const path = readInput("[data-workspace-path]") || "ficheiro.txt";
    const content = document.querySelector<HTMLTextAreaElement>("[data-workspace-content]")?.value || "";
    downloadText(path, content);
    setStatus("Ficheiro descarregado localmente. Nenhuma publicação foi feita.");
  });
  document.querySelector<HTMLButtonElement>("[data-generate-catalog]")?.addEventListener("click", () => { try { generateCatalogForWorkspace(); } catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível gerar o catálogo.", true); } });
  document.querySelector<HTMLButtonElement>("[data-export-catalog]")?.addEventListener("click", () => downloadText(CATALOG_URL, `${JSON.stringify(normaliseCatalog(catalog), null, 2)}\n`));
  document.querySelector<HTMLInputElement>("[data-import-catalog]")?.addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) importCatalog(file).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao importar catálogo.", true));
  });
  document.querySelector<HTMLInputElement>("[data-workspace-upload]")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_TEXT_FILE_BYTES) { setStatus("O ficheiro de texto deve ter no máximo 1 MB.", true); return; }
    const path = readInput("[data-workspace-path]") || file.name;
    try {
      const safePath = assertSafeWorkspacePath(path);
      if (!isTextPath(safePath)) throw new Error("O carregamento local aceita apenas ficheiros textuais permitidos.");
      setWorkspaceEditor(safePath, await file.text(), null);
      setStatus("Ficheiro local carregado no editor para revisão. Ainda não foi publicado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível carregar o ficheiro.", true);
    }
  });
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const editId = target.closest<HTMLElement>("[data-edit-product]")?.dataset.editProduct;
    if (editId) editProduct(editId);
    const removeId = target.closest<HTMLElement>("[data-remove-product]")?.dataset.removeProduct;
    if (removeId) removeProduct(removeId).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao apagar produto.", true));
    const editCollectionId = target.closest<HTMLElement>("[data-edit-collection]")?.dataset.editCollection;
    if (editCollectionId) editCollection(editCollectionId);
    const removeCollectionId = target.closest<HTMLElement>("[data-remove-collection]")?.dataset.removeCollection;
    const collectionToRemove = collections().find((item) => item.id === removeCollectionId);
    if (removeCollectionId && collectionToRemove && products().some((item) => item.collection === collectionToRemove.name)) {
      setStatus("Não é possível remover uma colecção com produtos associados. Edite primeiro esses produtos.", true);
      return;
    }
    if (removeCollectionId && confirm("Remover esta colecção?")) {
      catalog.collections = collections().filter((item) => item.id !== removeCollectionId);
      publishCatalog("Remover colecção").then(() => { renderCatalog(catalog); setStatus("Colecção removida e catálogo publicado."); }).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao remover colecção.", true));
    }
    const workspaceFile = target.closest<HTMLElement>("[data-workspace-open]")?.dataset.workspaceOpen;
    if (workspaceFile) openWorkspaceFile(workspaceFile).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao abrir ficheiro.", true));
  });
  document.querySelector<HTMLButtonElement>("[data-clear-product]")?.addEventListener("click", clearProductForm);
}

async function setup(): Promise<void> {
  try { await loadCatalog(); } catch {
    const status = document.querySelector<HTMLElement>("[data-catalog-status]");
    if (status) status.textContent = "O catálogo publicado está temporariamente indisponível.";
  }
  document.querySelector<HTMLAnchorElement>("[data-edit-catalog]")?.setAttribute("href", EDIT_URL);
  document.querySelector<HTMLAnchorElement>("[data-open-actions]")?.setAttribute("href", ACTIONS_URL);
  setAuthenticatedView(false);
  wireEditor();
}

document.addEventListener("DOMContentLoaded", setup);
