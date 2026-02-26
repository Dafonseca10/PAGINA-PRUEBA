// ==============================
// ULTIMATE KITS — CATALOGO + CARRITO + WHATSAPP
// ==============================

const API_URL =
  "https://ultimate-kits-api.ultimatekits00.workers.dev/";
const WHATSAPP_NUMBER = "584246392010";
const DEFAULT_LIMIT = 60;
const CART_KEY = "uk_cart_v2";
const LONG_SLEEVE_EXTRA = 5;

// HELPERS
function money(n) { return `$${Number(n || 0)}`; }
function getFinalPrice(item) {
  return Number(item?.precio || 0) + (item?.isLongSleeve ? LONG_SLEEVE_EXTRA : 0);
}
function formatLongSleeve(v) { return v ? `Sí (+$${LONG_SLEEVE_EXTRA})` : "No"; }
function norm(s) { return (s || "").toString().toLowerCase().trim(); }
function unique(arr) { return [...new Set((arr || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")); }

function setOptions(select, values, placeholder = "Todos") {
  if (!select) return;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "all"; opt0.textContent = placeholder;
  select.appendChild(opt0);
  (values || []).forEach((v) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
}

function priceLabelUSD(p) {
  const n = Number(p);
  if (n === 25) return "$25 (Fan)";
  if (n === 30) return "$30 (Edición especial)";
  if (n === 35) return "$35 (Polos/Retro/Player)";
  if (n === 40) return "$40 (Chaquetas F1)";
  return money(n);
}

function makeOrderId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return "UK-" + ymd + "-" + Math.random().toString(36).slice(2, 7).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
}

function openWhatsApp(text) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  const w = window.open(url, "_blank");
  if (!w) window.location.href = url;
}

// JSONP
function loadJSONP(url) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    window[cbName] = (data) => { resolve(data); cleanup(); };
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cbName + "&_=" + Date.now();
    s.onerror = () => { reject(new Error("JSONP load error")); cleanup(); };
    document.body.appendChild(s);
    function cleanup() {
      try { delete window[cbName]; } catch (e) {}
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  });
}

// DOM
const MODE = (document.body.getAttribute("data-mode") || "football").toLowerCase();
const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const activeFiltersEl = document.getElementById("activeFilters");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const qEl = document.getElementById("q");
const clearBtn = document.getElementById("clearBtn");
const editionChips = document.getElementById("editionChips");
const clubSel = document.getElementById("club");
const tipoSel = document.getElementById("tipo");
const precioSel = document.getElementById("precio");

const orderModal = document.getElementById("orderModal");
const closeModalBtn = document.getElementById("closeModal");
const cancelOrderBtn = document.getElementById("cancelOrder");
const productSummary = document.getElementById("productSummary");
const orderForm = document.getElementById("orderForm");
const longSleeveEl = document.getElementById("longSleeve");

const cartBar = document.getElementById("cartBar");
const cartCountEl = document.getElementById("cartCount");
const cartOpenBtn = document.getElementById("cartOpenBtn");
const cartSendBtn = document.getElementById("cartSendBtn");
const cartModal = document.getElementById("cartModal");
const closeCartBtn = document.getElementById("closeCart");
const cartList = document.getElementById("cartList");
const cartTotalEl = document.getElementById("cartTotal");
const cartClearBtn = document.getElementById("cartClearBtn");
const cartSendBtn2 = document.getElementById("cartSendBtn2");

const checkoutModal = document.getElementById("checkoutModal");
const checkoutForm = document.getElementById("checkoutForm");

// STATE
const state = { mode: MODE, f1Team: "all", edicion: "all", club: "all", tipo: "all", precio: "all", q: "" };
let allItems = [];
let page = 1;
let total = 0;
let loading = false;

let checkoutContext = { type: null, orderId: null, singleItem: null };

// ACTIVE FILTERS UI
function renderActive() {
  if (!activeFiltersEl) return;
  const parts = [];
  parts.push(state.mode === "f1" ? "Modo: F1" : "Modo: Fútbol");
  if (state.mode === "f1") {
    if (state.f1Team !== "all") parts.push(`Escudería: ${state.f1Team}`);
  } else {
    if (state.edicion !== "all") parts.push(`Edición: ${state.edicion}`);
    if (state.club !== "all") parts.push(`Club: ${state.club}`);
  }
  if (state.tipo !== "all") parts.push(`Tipo: ${state.tipo}`);
  if (state.precio !== "all") parts.push(`Precio: ${money(state.precio)}`);
  if (state.q) parts.push(`Buscar: "${state.q}"`);

  activeFiltersEl.innerHTML = parts.length
    ? `<span class="afLabel">Filtros:</span> ${parts.map((p) => `<span class="afPill">${p}</span>`).join("")}`
    : `<span class="afLabel muted">Sin filtros activos</span>`;
}

// CARD HTML
function cardHTML(it) {
  const metaLine = [it.club || "", it.tipo || ""].filter(Boolean).join(" · ");
  return `
    <article class="productCard">
      <div class="productImg">
        <img src="${window._ukCloud ? window._ukCloud(it.img) : it.img}" alt="${it.nombre || "Producto"}" loading="lazy" />
        <span class="pFloat">${it.edicion || ""}</span>
      </div>
      <div class="productInfo">
        <h3>${it.nombre || "Producto"}</h3>
        <p class="muted">${metaLine}</p>
        <div class="productBottom">
          <span class="price">${money(Number(it.precio || 0))}</span>
          <div style="display:flex; gap:8px;">
            <a class="miniBtn js-order" href="#" data-id="${it.id}">Pedir</a>
            <a class="miniBtn js-add" href="#" data-id="${it.id}">Añadir</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

// EDITION CHIPS
function renderEditionChips() {
  if (!editionChips) return;
  if (state.mode !== "football") { editionChips.style.display = "none"; return; }
  editionChips.style.display = "flex";
  const base = ["Fan", "Player", "Retro", "Edición especial"];
  const all = ["all", ...base];
  editionChips.innerHTML = all.map((v) => {
    const label = v === "all" ? "Todo" : v;
    const on = state.edicion === v;
    return `<button class="chip ${on ? "isOn" : ""}" data-ed="${v}" type="button">${label}</button>`;
  }).join("");

  editionChips.querySelectorAll("button[data-ed]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.edicion = btn.getAttribute("data-ed") || "all";
      renderEditionChips();
      fetchPage(true);
    });
  });
}

// FETCH
function buildParams() {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(DEFAULT_LIMIT));
  params.set("q", state.q || "");
  params.set("tipo", state.tipo);
  params.set("precio", state.precio);
  if (state.mode === "f1") {
    params.set("liga", "F1");
    params.set("club", state.f1Team);
    params.set("edicion", "all");
  } else {
    params.set("liga", "all");
    params.set("club", state.club);
    params.set("edicion", state.edicion);
  }
  return params;
}

function filterOutF1(arr) {
  return (arr || []).filter((it) => {
    const liga = String(it.liga || "").toLowerCase().trim();
    if (!liga) return true;
    return liga !== "f1" && !liga.includes("formula 1");
  });
}

async function fetchPage(reset = false) {
  if (loading) return;
  loading = true;
  try {
    if (reset) { page = 1; allItems = []; if (grid) grid.innerHTML = ""; }
    const params = buildParams();
    let guard = 0, rawItems = [], safeItems = [];

    while (guard < 10) {
      params.set("page", String(page));
      const data = await loadJSONP(API_URL + "?" + params.toString());
      total = Number(data?.total || 0);
      rawItems = data?.items || [];
      if (rawItems.length === 0) { safeItems = []; break; }
      safeItems = state.mode === "football" ? filterOutF1(rawItems) : rawItems;
      if (state.mode === "football" && safeItems.length === 0) { page += 1; guard += 1; continue; }
      break;
    }

    allItems = allItems.concat(safeItems);
    if (grid) grid.innerHTML = allItems.map(cardHTML).join("");
    if (emptyEl) emptyEl.hidden = allItems.length !== 0;
    renderActive();
    if (loadMoreBtn) loadMoreBtn.hidden = rawItems.length === 0;
    page += 1;
  } catch (err) {
    console.error(err);
    if (grid) grid.innerHTML = `<p class="muted">No se pudo cargar el catálogo. Revisa tu API.</p>`;
  } finally {
    loading = false;
  }
}

// CART
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); if (!Array.isArray(cart)) cart = []; } catch (e) { cart = []; }

function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartBar(); }
function updateCartBar() {
  if (!cartBar || !cartCountEl) return;
  const n = cart.length;
  cartBar.style.display = n ? "block" : "none";
  cartCountEl.textContent = `${n} item${n === 1 ? "" : "s"}`;
}

function cartItemHTML(item, idx) {
  return `
    <div class="panel" style="padding:12px; display:flex; gap:12px; align-items:flex-start;">
      <img src="${item.img}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:14px;flex:0 0 auto;" loading="lazy">
      <div style="flex:1;">
        <strong>${item.nombre || "Producto"}</strong>
        <div class="muted" style="margin-top:4px;font-size:.85rem;">
          ${[item.liga, item.club, item.tipo, item.edicion].filter(Boolean).join(" · ")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <label class="field" style="margin:0;"><span>Nombre</span><input data-cart="name" data-idx="${idx}" type="text" value="${item.customName || ""}" maxlength="16"></label>
          <label class="field" style="margin:0;"><span>Número</span><input data-cart="number" data-idx="${idx}" type="text" value="${item.customNumber || ""}" maxlength="3"></label>
          <label class="field" style="margin:0;">
            <span>Talla</span>
            <select data-cart="size" data-idx="${idx}">
              <option value="">Selecciona talla</option>
              ${["XS","S","M","L","XL","2XL"].map((s) => `<option value="${s}" ${item.size === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
          <label class="field" style="margin:0;"><span>Parches</span><input data-cart="patches" data-idx="${idx}" type="text" value="${item.patches || ""}"></label>
          <label class="field" style="grid-column:1/-1;margin:0;"><span>Notas</span><input data-cart="notes" data-idx="${idx}" type="text" value="${item.notes || ""}"></label>
        </div>
        <label class="longSleeveField" style="margin:10px 0 0;">
          <span>Manga larga</span>
          <div class="longSleeveBox">
            <div class="longSleeveLeft"><div class="longSleeveTitle">Manga larga</div><div class="longSleeveSub">+$${LONG_SLEEVE_EXTRA}</div></div>
            <input data-cart="longSleeve" data-idx="${idx}" type="checkbox" ${item.isLongSleeve ? "checked" : ""}>
          </div>
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span class="muted">${money(getFinalPrice(item))}</span>
          <button class="btn btnGhost" type="button" data-cart="remove" data-idx="${idx}" style="padding:6px 12px;font-size:.8rem;">Quitar</button>
        </div>
      </div>
    </div>
  `;
}

function renderCart() {
  if (!cartList || !cartTotalEl) return;
  if (!cart.length) {
    cartList.innerHTML = `<p class="muted">Tu carrito está vacío.</p>`;
    cartTotalEl.textContent = ""; updateCartBar(); return;
  }
  cartList.innerHTML = cart.map(cartItemHTML).join("");
  cartTotalEl.textContent = `Total estimado: ${money(cart.reduce((sum, x) => sum + getFinalPrice(x), 0))}`;
  updateCartBar();
}

function openCart() { renderCart(); if (cartModal) { cartModal.hidden = false; document.body.style.overflow = "hidden"; } }
function closeCart() { if (cartModal) { cartModal.hidden = true; document.body.style.overflow = ""; } }

if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
if (cartModal) cartModal.addEventListener("click", (e) => { if (e.target === cartModal) closeCart(); });
if (cartOpenBtn) cartOpenBtn.addEventListener("click", openCart);
if (cartClearBtn) cartClearBtn.addEventListener("click", () => { cart = []; saveCart(); renderCart(); });

document.addEventListener("input", (e) => {
  const el = e.target; if (!el?.dataset) return;
  const key = el.dataset.cart; if (!key) return;
  const idx = Number(el.dataset.idx);
  if (!Number.isFinite(idx) || !cart[idx]) return;
  if (key === "name") cart[idx].customName = el.value;
  if (key === "number") cart[idx].customNumber = el.value;
  if (key === "patches") cart[idx].patches = el.value;
  if (key === "notes") cart[idx].notes = el.value;
  saveCart();
});

document.addEventListener("change", (e) => {
  const el = e.target; if (!el?.dataset) return;
  const key = el.dataset.cart;
  const idx = Number(el.dataset.idx);
  if (!Number.isFinite(idx) || !cart[idx]) return;
  if (key === "size") { cart[idx].size = el.value; saveCart(); return; }
  if (key === "longSleeve") { cart[idx].isLongSleeve = !!el.checked; saveCart(); renderCart(); return; }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cart='remove']");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  if (!Number.isFinite(idx)) return;
  cart.splice(idx, 1); saveCart(); renderCart();
});

// ORDER MODAL
let selectedProduct = null;

function refreshOrderSummary() {
  if (!selectedProduct || !productSummary) return;
  const isLong = !!longSleeveEl?.checked;
  const finalPrice = Number(selectedProduct.precio || 0) + (isLong ? LONG_SLEEVE_EXTRA : 0);
  productSummary.textContent = [selectedProduct.edicion, selectedProduct.club, selectedProduct.tipo, money(finalPrice)].filter(Boolean).join(" · ");
}

function openOrderModal(product) {
  selectedProduct = product;
  if (orderModal) orderModal.hidden = false;
  document.body.style.overflow = "hidden";
  if (orderForm) orderForm.reset();
  if (longSleeveEl) longSleeveEl.checked = false;
  refreshOrderSummary();
}

function closeOrderModal() {
  if (orderModal) orderModal.hidden = true;
  document.body.style.overflow = "";
  selectedProduct = null;
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeOrderModal);
if (cancelOrderBtn) cancelOrderBtn.addEventListener("click", closeOrderModal);
if (orderModal) orderModal.addEventListener("click", (e) => { if (e.target === orderModal) closeOrderModal(); });
if (longSleeveEl) longSleeveEl.addEventListener("change", refreshOrderSummary);

document.addEventListener("click", (e) => {
  const orderBtn = e.target.closest("a.js-order");
  const addBtn = e.target.closest("a.js-add");
  if (!orderBtn && !addBtn) return;
  e.preventDefault();
  const btn = orderBtn || addBtn;
  const id = btn.getAttribute("data-id");
  const product = allItems.find((x) => x.id === id);
  if (!product) return;
  if (addBtn) {
    cart.push({ ...product, customName: "", customNumber: "", size: "", patches: "", notes: "", isLongSleeve: false });
    saveCart(); updateCartBar(); return;
  }
  openOrderModal(product);
});

// CHECKOUT MODAL
function openCheckout(type, payload) {
  if (!checkoutModal) return;
  checkoutContext.type = type;
  checkoutContext.orderId = makeOrderId();
  checkoutContext.singleItem = payload?.singleItem || null;
  checkoutModal.hidden = false;
  document.body.style.overflow = "hidden";
  if (checkoutForm) checkoutForm.reset();
}

function closeCheckout() {
  if (!checkoutModal) return;
  checkoutModal.hidden = true;
  document.body.style.overflow = "";
  checkoutContext = { type: null, orderId: null, singleItem: null };
}

if (checkoutModal) {
  checkoutModal.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close='1']");
    if (closeBtn || e.target === checkoutModal) closeCheckout();
  });
}

if (orderForm) {
  orderForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const singleItem = {
      ...selectedProduct,
      customName: (document.getElementById("shirtName")?.value || "").trim(),
      customNumber: (document.getElementById("shirtNumber")?.value || "").trim(),
      size: document.getElementById("shirtSize")?.value || "",
      patches: (document.getElementById("patches")?.value || "").trim(),
      notes: (document.getElementById("notes")?.value || "").trim(),
      isLongSleeve: !!document.getElementById("longSleeve")?.checked,
    };
    closeOrderModal();
    openCheckout("single", { singleItem });
  });
}

function startCartCheckout() { if (!cart.length) return; closeCart(); openCheckout("cart", {}); }
if (cartSendBtn) cartSendBtn.addEventListener("click", startCartCheckout);
if (cartSendBtn2) cartSendBtn2.addEventListener("click", startCartCheckout);

if (checkoutForm) {
  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(checkoutForm);
    const nombre = String(fd.get("nombre") || "").trim();
    const direccion = String(fd.get("direccion") || "").trim();
    const postal = String(fd.get("postal") || "").trim();
    const ciudad = String(fd.get("ciudad") || "").trim();
    const pais = String(fd.get("pais") || "").trim();
    const telefono = String(fd.get("telefono") || "").trim();

    if (!nombre || !direccion || !postal || !ciudad || !pais || !telefono) {
      alert("Por favor rellena todos los campos del envío."); return;
    }

    const orderId = checkoutContext.orderId || makeOrderId();

    if (checkoutContext.type === "single" && checkoutContext.singleItem) {
      const p = checkoutContext.singleItem;
      const finalPrice = getFinalPrice(p);
      const textLines = [
        "Hola Ultimate Kits 👋", "Quiero hacer este pedido:", "",
        `OrderID: ${orderId}`, "",
        "📦 Datos de envío:",
        `• Nombre: ${nombre}`, `• Teléfono: ${telefono}`,
        `• Dirección: ${direccion}`, `• Código postal: ${postal}`,
        `• Ciudad: ${ciudad}`, `• País: ${pais}`, "",
        "🧾 Producto:",
        `• Producto: ${p.nombre || ""}`.trim(),
        p.club ? `• Club/Escudería: ${p.club}` : null,
        p.liga ? `• Categoría: ${p.liga}` : null,
        p.tipo ? `• Tipo: ${p.tipo}` : null,
        p.edicion ? `• Edición: ${p.edicion}` : null,
        p.temporada ? `• Temporada: ${p.temporada}` : null,
        `• Manga larga: ${formatLongSleeve(!!p.isLongSleeve)}`,
        p.size ? `• Talla: ${p.size}` : `• Talla: (sin talla)`,
        p.customName ? `• Nombre: ${p.customName}` : `• Nombre: (sin nombre)`,
        p.customNumber ? `• Número: ${p.customNumber}` : `• Número: (sin número)`,
        p.patches ? `• Parches: ${p.patches}` : null,
        p.notes ? `• Notas: ${p.notes}` : null,
        `• Foto: ${p.img}`, `• Precio: ${money(finalPrice)}`, "", "Gracias!",
      ].filter(Boolean);
      closeCheckout(); openWhatsApp(textLines.join("\n")); return;
    }

    if (checkoutContext.type === "cart") {
      if (!cart.length) { alert("Tu carrito está vacío."); return; }
      const totalAmount = cart.reduce((sum, p) => sum + getFinalPrice(p), 0);
      const blocks = cart.map((p, i) => {
        return [
          `🧾 Item #${i + 1}`,
          `• Producto: ${p.nombre || ""}`.trim(),
          p.club ? `• Club/Escudería: ${p.club}` : null,
          p.liga ? `• Categoría: ${p.liga}` : null,
          p.tipo ? `• Tipo: ${p.tipo}` : null,
          p.edicion ? `• Edición: ${p.edicion}` : null,
          p.temporada ? `• Temporada: ${p.temporada}` : null,
          `• Manga larga: ${formatLongSleeve(!!p.isLongSleeve)}`,
          p.size ? `• Talla: ${p.size}` : `• Talla: (sin talla)`,
          p.customName ? `• Nombre: ${p.customName}` : `• Nombre: (sin nombre)`,
          p.customNumber ? `• Número: ${p.customNumber}` : `• Número: (sin número)`,
          p.patches ? `• Parches: ${p.patches}` : null,
          p.notes ? `• Notas: ${p.notes}` : null,
          `• Foto: ${p.img}`, `• Precio: ${money(getFinalPrice(p))}`,
        ].filter(Boolean).join("\n");
      });

      const header = [
        "Hola Ultimate Kits 👋", "Quiero hacer este pedido (carrito):", "",
        `OrderID: ${orderId}`, "",
        "📦 Datos de envío:",
        `• Nombre: ${nombre}`, `• Teléfono: ${telefono}`,
        `• Dirección: ${direccion}`, `• Código postal: ${postal}`,
        `• Ciudad: ${ciudad}`, `• País: ${pais}`, "",
        `💰 Total estimado: ${money(totalAmount)}`, "", "🛒 Items:", "",
      ].join("\n");

      closeCheckout();
      openWhatsApp(header + blocks.join("\n\n" + "—".repeat(12) + "\n\n"));
      return;
    }

    alert("Error: no se pudo determinar el tipo de checkout.");
  });
}

// PAGINATION
if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => fetchPage(false));

// FILTERS
function debounce(fn, wait = 250) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

if (tipoSel) tipoSel.addEventListener("change", () => { state.tipo = tipoSel.value; fetchPage(true); });
if (precioSel) precioSel.addEventListener("change", () => { state.precio = precioSel.value; fetchPage(true); });
if (clubSel) clubSel.addEventListener("change", () => { state.club = clubSel.value; fetchPage(true); });
if (qEl) qEl.addEventListener("input", debounce(() => { state.q = norm(qEl.value); fetchPage(true); }, 250));

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    state.f1Team = "all"; state.edicion = "all"; state.club = "all";
    state.tipo = "all"; state.precio = "all"; state.q = "";
    if (qEl) qEl.value = "";
    if (tipoSel) tipoSel.value = "all";
    if (precioSel) precioSel.value = "all";
    if (clubSel) clubSel.value = "all";
    renderEditionChips(); fetchPage(true);
  });
}

// INIT
async function init() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  updateCartBar();
  renderEditionChips();

  const metaData = await loadJSONP(API_URL + "?mode=meta");
  const meta = metaData?.meta || { clubs: [], tipos: [], precios: [], f1Teams: [] };

  setOptions(tipoSel, meta.tipos || [], "Todos");

  if (precioSel) {
    precioSel.innerHTML = `<option value="all">Todos</option>` +
      (meta.precios || []).map((v) => `<option value="${v}">${priceLabelUSD(Number(v))}</option>`).join("");
  }

  if (state.mode === "football") setOptions(clubSel, meta.clubs || [], "Todos");

  await fetchPage(true);
}

init().catch((err) => {
  console.error(err);
  if (grid) grid.innerHTML = `<p class="muted">No se pudo iniciar el catálogo.</p>`;
});
