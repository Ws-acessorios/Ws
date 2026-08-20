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

type GitHubContent = { sha?: string; content?: string; encoding?: string };

const REPOSITORY = "Ws-acessorios/Ws";
const BRANCH = "main";
const CATALOG_URL = "catalogo.json";
const EDIT_URL = `https://github.com/${REPOSITORY}/edit/${BRANCH}/catalogo.json`;
const ACTIONS_URL = `https://github.com/${REPOSITORY}/actions/workflows/update-catalog.yml`;
const API_BASE = `https://api.github.com/repos/${REPOSITORY}/contents`;
const MANAGED_IMAGE_PREFIX = "assets/catalogo/";

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
let editingProductId: string | null = null;
let editingCollectionId: string | null = null;
let selectedImage: File | null = null;

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

function setStatus(message: string, error = false): void {
  const element = document.querySelector<HTMLElement>("[data-editor-status]");
  if (element) {
    element.textContent = message;
    element.dataset.error = error ? "true" : "false";
  }
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
    collectionsElement.innerHTML = visibleCollections.length ? visibleCollections.map((item) => `<article class="published-row"><strong>${escapeHtml(item.name)}</strong>${item.description ? `<span>${escapeHtml(item.description)}</span>` : ""}</article>`).join("") : "<p class=\"admin-empty\">Ainda não existem colecções publicadas.</p>";
  }
  if (productsElement) {
    productsElement.innerHTML = activeProducts().length ? activeProducts().map((item) => `<article class="published-product"><img src="${escapeHtml(publicImagePath(item.image))}" alt="${escapeHtml(item.name)}" loading="lazy"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.collection)} · ${item.source === "original" ? "Catálogo original" : "Adicionado pela gestão"}</span>${item.price ? `<b>${escapeHtml(item.price)}</b>` : ""}<button type="button" data-edit-product="${escapeHtml(item.id)}">Editar</button><button type="button" class="remove" data-remove-product="${escapeHtml(item.id)}">Apagar</button></div></article>`).join("") : "<p class=\"admin-empty\">Ainda não existem produtos publicados.</p>";
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

async function githubRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!githubToken.trim()) throw new Error("Introduza o token do GitHub para publicar.");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${githubToken.trim()}`);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return fetch(`${API_BASE}/${path}`, { ...init, headers });
}

async function readGitHubFile(path: string): Promise<GitHubContent> {
  const response = await githubRequest(path);
  if (!response.ok) throw new Error(`GitHub não permitiu ler ${path} (${response.status}).`);
  return response.json() as Promise<GitHubContent>;
}

async function writeGitHubFile(path: string, content: string, message: string): Promise<void> {
  let existing: GitHubContent = {};
  try { existing = await readGitHubFile(path); } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("404")) throw error;
  }
  const response = await githubRequest(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch: BRANCH, content, ...(existing.sha ? { sha: existing.sha } : {}) }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub recusou a publicação (${response.status}): ${details.slice(0, 180)}`);
  }
}

async function deleteGitHubFile(path: string, message: string): Promise<void> {
  const existing = await readGitHubFile(path);
  if (!existing.sha) throw new Error("Não foi possível identificar a versão da imagem a apagar.");
  const response = await githubRequest(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, branch: BRANCH, sha: existing.sha }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub recusou apagar a imagem (${response.status}): ${details.slice(0, 180)}`);
  }
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
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
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
  const base64 = compressed.split(",")[1];
  const baseName = slugify(file.name.replace(/\.[^.]+$/, ""));
  return { path: `assets/catalogo/${baseName}-${Date.now().toString(36)}.jpg`, base64 };
}

function readInput(selector: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value.trim() || "";
}

function clearProductForm(): void {
  editingProductId = null;
  selectedImage = null;
  const form = document.querySelector<HTMLFormElement>("[data-product-form]");
  form?.reset();
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
  const editorPanel = document.querySelector<HTMLElement>("[data-editor-panel]");
  editorPanel?.removeAttribute("hidden");
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
    setStatus("A preparar a imagem…");
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
  catalog = normaliseCatalog(catalog);
  catalog.version = (catalog.version || 1) + 1;
  catalog.updatedAt = new Date().toISOString();
  const content = encodeBase64Utf8(`${JSON.stringify(catalog, null, 2)}\n`);
  await writeGitHubFile(CATALOG_URL, content, message);
}

async function removeProduct(id: string): Promise<void> {
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
  const editorPanel = document.querySelector<HTMLElement>("[data-editor-panel]");
  editorPanel?.removeAttribute("hidden");
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

function wireEditor(): void {
  document.querySelector<HTMLButtonElement>("[data-open-editor]")?.addEventListener("click", () => {
    document.querySelector<HTMLElement>("[data-editor-panel]")?.toggleAttribute("hidden");
  });
  document.querySelector<HTMLInputElement>("[data-github-token]")?.addEventListener("input", (event) => { githubToken = (event.target as HTMLInputElement).value; });
  document.querySelector<HTMLInputElement>("[data-product-image]")?.addEventListener("change", (event) => {
    selectedImage = (event.target as HTMLInputElement).files?.[0] || null;
    const name = document.querySelector<HTMLElement>("[data-image-name]");
    if (name) name.textContent = selectedImage ? `${selectedImage.name} · ${(selectedImage.size / 1024 / 1024).toFixed(1)} MB` : "Nenhuma imagem seleccionada";
  });
  document.querySelector<HTMLFormElement>("[data-product-form]")?.addEventListener("submit", (event) => { saveProduct(event).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao publicar produto.", true)); });
  document.querySelector<HTMLFormElement>("[data-collection-form]")?.addEventListener("submit", (event) => { saveCollection(event).catch((error) => setStatus(error instanceof Error ? error.message : "Falha ao publicar colecção.", true)); });
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
  wireEditor();
}

document.addEventListener("DOMContentLoaded", setup);
