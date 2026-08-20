function guestStorageKey(guestId: string): string {
  return `wswattson-cart-${guestId}`;
}

interface CartItem {
  id: string;
  name: string;
  description: string;
  image: string;
  quantity: number;
}

const WHATSAPP_NUMBER = "244933224116";
const GUEST_ID_KEY = "wswattson-guest-id";
function createGuestId(): string {
  const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof cryptoApi?.randomUUID === "function") return `guest_${cryptoApi.randomUUID()}`;
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

const guestId = localStorage.getItem(GUEST_ID_KEY) || createGuestId();
localStorage.setItem(GUEST_ID_KEY, guestId);
const CART_STORAGE_KEY = guestStorageKey(guestId);

function readCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function productCards(): HTMLElement[] {
  const productPages = ["feminina.html", "masculina.html", "casais.html", "personalizados.html"];
  const page = window.location.pathname.split("/").pop() || "index.html";
  return productPages.includes(page)
    ? Array.from(document.querySelectorAll<HTMLElement>("article.cartao"))
    : [];
}

async function hydratePublishedCatalog(): Promise<void> {
  try {
    const response = await fetch("catalogo.json", { cache: "no-store" });
    if (!response.ok) return;
    const catalog = await response.json() as { products?: Array<{ id: string; name: string; collection: string; description: string; image: string; price?: string; source?: "original" | "admin"; active?: boolean }> };
    const page = window.location.pathname.split("/").pop() || "index.html";
    const collectionByPage: Record<string, string> = { "feminina.html": "Feminina", "masculina.html": "Masculina", "casais.html": "Casais", "personalizados.html": "Personalizados" };
    const collection = collectionByPage[page];
    if (!collection) return;
    const allCollectionProducts = catalog.products?.filter((product) => (!collection || product.collection.toLowerCase() === collection.toLowerCase())) || [];
    const products = allCollectionProducts.filter((product) => product.active !== false);
    const grid = document.querySelector<HTMLElement>(".grelha");
    if (!grid || !products.length) return;
    const key = (name: string, image: string) => `${name.trim().toLowerCase()}|${image.replace(/^\.\//, "")}`;
    const fallbackProducts = Array.from(grid.querySelectorAll<HTMLElement>("article.cartao")).map((card) => ({
      name: card.querySelector("h3")?.textContent?.trim() || "",
      description: card.querySelector("p")?.textContent?.trim() || "",
      image: card.querySelector("img")?.getAttribute("src") || "",
    }));
    const catalogKeys = new Set(allCollectionProducts.map((product) => key(product.name, product.image)));
    const extraFallbacks = fallbackProducts.filter((product) => product.name && !catalogKeys.has(key(product.name, product.image)));
    const originalsInCatalog = allCollectionProducts.filter((product) => product.source === "original");
    const catalogCoversOriginals = originalsInCatalog.length >= fallbackProducts.length;
    const shownProducts = catalogCoversOriginals ? products : [...products, ...extraFallbacks];
    grid.innerHTML = shownProducts.map((product) => `<article class="cartao">${product.image ? `<img src="${product.image}" alt="${product.name}">` : ""}<div><h3>${product.name}</h3><p>${product.description}</p></div></article>`).join("");
  } catch {
    // As páginas HTML existentes continuam a funcionar se o catálogo não estiver disponível.
  }
}

function addProductButtons(): void {
  productCards().forEach((card, index) => {
    const title = card.querySelector<HTMLElement>("h3")?.textContent?.trim() || `Produto ${index + 1}`;
    const description = card.querySelector<HTMLElement>("p")?.textContent?.trim() || "Encomenda artesanal WS Wattson";
    const image = card.querySelector<HTMLImageElement>("img")?.getAttribute("src") || "";
    const id = `${window.location.pathname}-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
    card.dataset.productId = id;

    if (card.querySelector("[data-add-product]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "botao adicionar-carrinho";
    button.dataset.addProduct = id;
    button.textContent = "Adicionar ao carrinho";
    button.addEventListener("click", () => addToCart({ id, name: title, description, image, quantity: 1 }));
    card.appendChild(button);
  });
}

function addToCart(item: CartItem): void {
  const cart = readCart();
  const existing = cart.find((product) => product.id === item.id);
  if (existing) existing.quantity += 1;
  else cart.push(item);
  saveCart(cart);
  renderCart();
  openCart();
}

function removeFromCart(id: string): void {
  saveCart(readCart().filter((item) => item.id !== id));
  renderCart();
}

function changeQuantity(id: string, change: number): void {
  const cart = readCart();
  const item = cart.find((product) => product.id === id);
  if (!item) return;
  item.quantity += change;
  saveCart(item.quantity > 0 ? cart : cart.filter((product) => product.id !== id));
  renderCart();
}

function cartTotalItems(): number {
  return readCart().reduce((total, item) => total + item.quantity, 0);
}

function whatsappOrder(): void {
  const cart = readCart();
  if (!cart.length) return;
  const lines = cart.map((item) => `- ${item.name} (${item.quantity}x)`);
  const message = `Olá WS Wattson, gostaria de fazer esta encomenda:\n${lines.join("\n")}\n\nPodem confirmar disponibilidade e preço?`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function createCartPanel(): void {
  if (document.querySelector("[data-cart-panel]")) return;
  const panel = document.createElement("aside");
  panel.className = "painel-carrinho";
  panel.dataset.cartPanel = "true";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="carrinho-cabecalho"><h2>O seu carrinho</h2><button type="button" class="fechar-carrinho" aria-label="Fechar carrinho">×</button></div>
    <div class="carrinho-itens" data-cart-items></div>
    <div class="carrinho-rodape"><button type="button" class="botao finalizar-carrinho">Encomendar por WhatsApp</button><button type="button" class="limpar-carrinho">Limpar carrinho</button></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector(".fechar-carrinho")?.addEventListener("click", closeCart);
  panel.querySelector(".finalizar-carrinho")?.addEventListener("click", whatsappOrder);
  panel.querySelector(".limpar-carrinho")?.addEventListener("click", () => { saveCart([]); renderCart(); });
}

function renderCart(): void {
  const itemsContainer = document.querySelector<HTMLElement>("[data-cart-items]");
  if (!itemsContainer) return;
  const cart = readCart();
  itemsContainer.innerHTML = cart.length ? cart.map((item) => `
    <div class="linha-carrinho"><div><strong>${item.name}</strong><small>${item.description}</small><div class="quantidade"><button type="button" data-minus="${item.id}">−</button><span>${item.quantity}</span><button type="button" data-plus="${item.id}">+</button></div></div><button type="button" class="remover-item" data-remove="${item.id}">Remover</button></div>
  `).join("") : `<p class="carrinho-vazio">Ainda não adicionou nenhuma peça.</p>`;
  itemsContainer.querySelectorAll<HTMLButtonElement>("[data-minus]").forEach((button) => button.addEventListener("click", () => changeQuantity(button.dataset.minus || "", -1)));
  itemsContainer.querySelectorAll<HTMLButtonElement>("[data-plus]").forEach((button) => button.addEventListener("click", () => changeQuantity(button.dataset.plus || "", 1)));
  itemsContainer.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.remove || "")));
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((counter) => { counter.textContent = String(cartTotalItems()); });
}

function openCart(): void {
  const panel = document.querySelector<HTMLElement>("[data-cart-panel]");
  panel?.classList.add("aberto");
  panel?.setAttribute("aria-hidden", "false");
}

function closeCart(): void {
  const panel = document.querySelector<HTMLElement>("[data-cart-panel]");
  panel?.classList.remove("aberto");
  panel?.setAttribute("aria-hidden", "true");
}

function setupMobileMenu(): void {
  const button = document.querySelector<HTMLButtonElement>(".menu");
  const navigation = document.querySelector<HTMLElement>(".navegacao");
  if (!button || !navigation) return;
  button.addEventListener("click", () => { const isOpen = navigation.classList.toggle("aberto"); button.setAttribute("aria-expanded", String(isOpen)); });
}

function setupEntranceAnimations(): void {
  const elements = document.querySelectorAll<HTMLElement>(".entrada");
  if (!("IntersectionObserver" in window)) { elements.forEach((element) => element.classList.add("visivel")); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("visivel"); observer.unobserve(entry.target); } }), { threshold: 0.12 });
  elements.forEach((element) => observer.observe(element));
}

function ensureGuestSession(): void {
  // A sessão anónima é local ao dispositivo; nenhuma chamada externa é necessária.
}

function applyBrand(): void {
  const replaceBrand = (value: string) => value.split("WS Wattson Acessórios").join("WS Acessórios").split("WS Wattson").join("WS Acessórios");
  document.title = replaceBrand(document.title);
  document.querySelectorAll<HTMLElement>("[alt], [title], meta[name='description']").forEach((element) => {
    for (const attribute of ["alt", "title", "content"]) {
      const value = element.getAttribute(attribute);
      if (value?.includes("WS Wattson")) element.setAttribute(attribute, replaceBrand(value));
    }
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach((node) => {
    if (node.nodeValue?.includes("WS Wattson")) node.nodeValue = replaceBrand(node.nodeValue);
  });
}

async function initialiseSite(): Promise<void> {
  applyBrand();
  ensureGuestSession();
  setupMobileMenu();
  setupEntranceAnimations();
  createCartPanel();
  await hydratePublishedCatalog();
  addProductButtons();
  renderCart();
  document.querySelectorAll<HTMLElement>("[data-cart]").forEach((button) => button.addEventListener("click", openCart));
}

document.addEventListener("DOMContentLoaded", initialiseSite);
