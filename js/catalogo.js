// ==============================
// CONFIG
// ==============================
const API_URL = "https://script.google.com/macros/s/AKfycbxQ1fCIQRCBZh94mRx3tW6-L1ABz2TxBE8YOUGpDQPDoGvAQdksizP-vXAUTtIbRVVMFA/exec";
const WHATSAPP_NUMBER = "584246392010";
function money(n){ return `$${Number(n || 0)}`; }

// ==============================
// JSONP
// ==============================
function loadJSONP(url){
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    window[cbName] = (data) => { resolve(data); cleanup(); };

    const s = document.createElement("script");
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cbName + "&_=" + Date.now();
    s.onerror = () => { reject(new Error("JSONP load error")); cleanup(); };
    document.body.appendChild(s);

    function cleanup(){
      try { delete window[cbName]; } catch(e) {}
      if (s.parentNode) s.parentNode.removeChild(s);
    }
  });
}

// ==============================
// Helpers
// ==============================
function norm(s){ return (s || "").toString().toLowerCase().trim(); }
function unique(arr){ return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")); }

function setOptions(select, values, placeholder="Todos"){
  if(!select) return;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "all";
  opt0.textContent = placeholder;
  select.appendChild(opt0);

  (values || []).forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function priceLabelUSD(p){
  if (p === 25) return "$25 (Fan)";
  if (p === 30) return "$30 (Edición especial)";
  if (p === 35) return "$35 (Retro/Player)";
  if (p === 40) return "$40 (Chaquetas F1)";
  return money(p);
}

function cardHTML(it){
  const metaLine = [it.club || "", it.tipo || ""].filter(Boolean).join(" · ");
  return `
    <article class="productCard">
      <div class="productImg">
        <img src="${it.img}" alt="${it.nombre}" loading="lazy" />
        <span class="pFloat">${it.edicion || ""}</span>
      </div>
      <div class="productInfo">
        <h3>${it.nombre}</h3>
        <p class="muted">${metaLine}</p>

        <div class="productBottom">
          <span class="price">${money(it.precio)}</span>
          <div style="display:flex; gap:10px;">
            <a class="miniBtn js-order" href="#" data-id="${it.id}">Pedir</a>
            <a class="miniBtn js-add" href="#" data-id="${it.id}">Añadir</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

const ORDERS_WEBAPP_URL = "7ef6f4db-a669-48fe-a830-692804c6f509";

function makeOrderId(){
  return "UK-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7);
}

async function saveOrderToAppSheetFromWeb(cart){
  const orderId = makeOrderId();
  const total = cart.reduce((s, p) => s + Number(p.precio || 0), 0);

  const payload = {
    orderId,
    customerId: "WEB",
    customerName: "CLIENTE WEB",
    status: "DRAFT",
    total,
    shipping: {
      destinoFinal: "SI",
      country: "PENDIENTE",
      state: "PENDIENTE",
      city: "PENDIENTE",
      address: "PENDIENTE",
      postal: "00000"
    },
    notes: `Pedido creado desde la web. Total: ${total}`,
    createdBy: "WEB-ULTIMATE-KITS",
    items: cart.map(p => ({
      nombre: p.nombre,
      liga: p.liga,
      club: p.club,
      tipo: p.tipo,
      edicion: p.edicion,
      temporada: p.temporada,
      precio: p.precio,
      img: p.img,
      size: p.size,
      customName: p.customName,
      customNumber: p.customNumber,
      patches: p.patches,
      notes: p.notes
    }))
  };

  await fetch(ORDERS_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return orderId;
}

// ==============================
// DOM
// ==============================
const MODE = document.body.dataset.mode; // "football" | "f1"

const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const activeFiltersEl = document.getElementById("activeFilters");
const loadMoreBtn = document.getElementById("loadMoreBtn");

const qEl = document.getElementById("q");
const clearBtn = document.getElementById("clearBtn");

const editionChips = document.getElementById("editionChips"); // solo fútbol
const f1TeamsEl = document.getElementById("f1Teams");         // solo f1

const clubSel = document.getElementById("club");   // solo fútbol
const tipoSel = document.getElementById("tipo");   // ambos
const precioSel = document.getElementById("precio"); // ambos

// Modal pedido
const modal = document.getElementById("orderModal");
const closeModalBtn = document.getElementById("closeModal");
const cancelOrderBtn = document.getElementById("cancelOrder");
const productSummary = document.getElementById("productSummary");
const orderForm = document.getElementById("orderForm");
let selectedProduct = null;

// Carrito
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

const CART_KEY = "uk_cart_v1";
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

// ==============================
// Estado
// ==============================
const state = {
  mode: MODE,          // fijo por página
  f1Team: "all",
  edicion: "all",
  club: "all",
  tipo: "all",
  precio: "all",
  q: ""
};

// ==============================
// UI: Active filters
// ==============================
function renderActive(){
  if(!activeFiltersEl) return;

  const parts = [];
  if(state.mode === "f1"){
    parts.push("Modo: F1");
    if(state.f1Team !== "all") parts.push(`Escudería: ${state.f1Team}`);
  } else {
    parts.push("Modo: Fútbol");
    if(state.edicion !== "all") parts.push(`Edición: ${state.edicion}`);
    if(state.club !== "all") parts.push(`Club: ${state.club}`);
  }

  if(state.tipo !== "all") parts.push(`Tipo: ${state.tipo}`);
  if(state.precio !== "all") parts.push(`Precio: ${money(state.precio)}`);
  if(state.q) parts.push(`Buscar: “${state.q}”`);

  activeFiltersEl.innerHTML = parts.length
    ? `<span class="afLabel">Filtros:</span> ${parts.map(p => `<span class="afPill">${p}</span>`).join("")}`
    : `<span class="afLabel muted">Sin filtros activos</span>`;
}

// ==============================
// Ediciones (solo fútbol)
// ==============================
function renderEditionChips(){
  if(!editionChips) return;
  if(state.mode !== "football"){
    editionChips.style.display = "none";
    return;
  }

  editionChips.style.display = "flex";
  const base = ["Fan","Player","Retro","Edición especial"];
  const all = ["all", ...base];

  editionChips.innerHTML = all.map(v => {
    const label = v === "all" ? "Todo" : v;
    const on = (state.edicion === v);
    return `<button class="chip ${on ? "isOn" : ""}" data-ed="${v}" type="button">${label}</button>`;
  }).join("");

  editionChips.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.edicion = btn.dataset.ed;
      renderEditionChips();
      fetchPage(true);
    });
  });
}

// ==============================
// Escuderías (solo F1)
// ==============================
function renderF1Teams(teams){
  if(!f1TeamsEl) return;
  if(state.mode !== "f1"){
    f1TeamsEl.style.display = "none";
    return;
  }

  f1TeamsEl.style.display = "flex";

  f1TeamsEl.innerHTML =
    `<button class="chip isOn" type="button" data-team="all">Todas</button>` +
    teams.map(t => `<button class="chip" type="button" data-team="${t}">${t}</button>`).join("");

  f1TeamsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-team]");
    if(!btn) return;

    f1TeamsEl.querySelectorAll(".chip").forEach(b => b.classList.remove("isOn"));
    btn.classList.add("isOn");

    state.f1Team = btn.dataset.team || "all";
    fetchPage(true);
  });
}

// ==============================
// Paginación / Fetch
// ==============================
let items = [];
let page = 1;
const limit = 60;
let total = 0;
let loading = false;

async function fetchPage(reset=false){
  if(loading) return;
  loading = true;

  if(reset){
    page = 1;
    items = [];
    if(grid) grid.innerHTML = "";
  }

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("q", state.q || "");
  params.set("tipo", state.tipo);
  params.set("precio", state.precio);

  if(state.mode === "f1"){
    // Separación REAL
    params.set("liga", "F1");
    params.set("club", state.f1Team); // escudería
    params.set("edicion", "all");
  } else {
    // Fútbol (NO F1)
    params.set("liga", "all");
    params.set("club", state.club);
    params.set("edicion", state.edicion);
  }

try{
  const pageMode = (document.body.dataset.mode || state?.mode || "").toLowerCase();

  let data = await loadJSONP(API_URL + "?" + params.toString());
  total = Number(data.total || 0);

  let newItems = data.items || [];

  // ✅ filtro anti F1 en fútbol
  const filterOutF1 = (arr) => arr.filter(it => {
    const liga = String(it.liga || "").toLowerCase().trim();

    // si liga viene vacío, NO lo mates (así no te quedas sin items)
    if (!liga) return true;

    // saca F1
    return liga !== "f1" && !liga.includes("formula 1");
  });

  let safeItems = (pageMode === "football") ? filterOutF1(newItems) : newItems;

  // ✅ AUTO-SKIP: si estamos en fútbol y esta página quedó vacía por ser solo F1,
  // busca en las siguientes páginas (hasta 8 intentos)
  let guard = 0;
  while (pageMode === "football" && newItems.length > 0 && safeItems.length === 0 && guard < 8) {
    guard++;

    page += 1; // saltamos a la siguiente
    const params2 = new URLSearchParams(params);
    params2.set("page", String(page));

    data = await loadJSONP(API_URL + "?" + params2.toString());
    newItems = data.items || [];
    safeItems = filterOutF1(newItems);
  }

  // ✅ acumulamos solo lo seguro
  items = items.concat(safeItems);

  if(grid) grid.innerHTML = items.map(cardHTML).join("");
  if(emptyEl) emptyEl.hidden = items.length !== 0;

  renderActive();

  // ✅ botón cargar más: si la API ya no devuelve nada, se oculta
  if(loadMoreBtn) loadMoreBtn.hidden = (newItems.length === 0);

  page += 1;

}catch(err){
  console.error(err);
  if(grid) grid.innerHTML = `<p class="muted">No se pudo cargar el catálogo. Revisa tu API (Apps Script).</p>`;
}finally{
  loading = false;
}}



// ==============================
// Carrito
// ==============================
function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBar();
}

function updateCartBar(){
  if(!cartBar || !cartCountEl) return;
  const n = cart.length;
  cartBar.style.display = n ? "block" : "none";
  cartCountEl.textContent = `${n} item${n === 1 ? "" : "s"}`;
}

function cartItemHTML(item, idx){
  return `
    <div style="display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:10px;">
      <img src="${item.img}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:12px;flex:0 0 auto;">
      <div style="flex:1;">
        <strong>${item.nombre}</strong>
        <div class="muted" style="margin-top:4px;">
          ${[item.liga, item.club, item.tipo, item.edicion].filter(Boolean).join(" · ")}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <label class="field" style="margin:0;">
            <span>Nombre</span>
            <input data-cart="name" data-idx="${idx}" type="text" value="${item.customName || ""}" maxlength="16">
          </label>
          <label class="field" style="margin:0;">
            <span>Número</span>
            <input data-cart="number" data-idx="${idx}" type="text" value="${item.customNumber || ""}" maxlength="3">
          </label>
          <label class="field" style="margin:0;">
            <span>Talla</span>
            <select data-cart="size" data-idx="${idx}">
              <option value="">Selecciona talla</option>
              ${["XS","S","M","L","XL","2XL"].map(s => `<option ${item.size === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
          <label class="field" style="margin:0;">
            <span>Parches</span>
            <input data-cart="patches" data-idx="${idx}" type="text" value="${item.patches || ""}">
          </label>
          <label class="field" style="grid-column:1 / -1;margin:0;">
            <span>Notas</span>
            <input data-cart="notes" data-idx="${idx}" type="text" value="${item.notes || ""}">
          </label>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span class="muted">${money(item.precio)}</span>
          <button class="btn btnGhost" type="button" data-cart="remove" data-idx="${idx}">Quitar</button>
        </div>
      </div>
    </div>
  `;
}

function renderCart(){
  if(!cartList || !cartTotalEl) return;
  cartList.innerHTML = cart.map(cartItemHTML).join("") || `<p class="muted">Tu carrito está vacío.</p>`;
  const t = cart.reduce((sum, x) => sum + Number(x.precio || 0), 0);
  cartTotalEl.textContent = cart.length ? `Total estimado: ${money(t)}` : "";
  updateCartBar();
}

function openCart(){
  renderCart();
  if(!cartModal) return;
  cartModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCart(){
  if(!cartModal) return;
  cartModal.hidden = true;
  document.body.style.overflow = "";
}

closeCartBtn?.addEventListener("click", closeCart);
cartModal?.addEventListener("click", (e) => { if(e.target === cartModal) closeCart(); });
cartOpenBtn?.addEventListener("click", openCart);

cartClearBtn?.addEventListener("click", () => {
  cart = [];
  saveCart();
  renderCart();
});

async function sendCartToWhatsApp(){
  if(!cart.length) return;

  // 🔹 1) GUARDAR PEDIDO EN APPSHEET
  let orderId = "";
  try {
    orderId = await saveOrderToAppSheetFromWeb(cart);
  } catch (err) {
    console.error("Error guardando pedido", err);
    alert("Error guardando el pedido. Intenta nuevamente.");
    return; // ⛔ NO abrimos WhatsApp
  }

  // 🔹 2) TU CÓDIGO ORIGINAL (WhatsApp)
  const blocks = cart.map((p, i) => {
    const lines = [
      `🧾 Item #${i + 1}`,
      `• Producto: ${p.nombre || ""}`.trim(),
      p.club ? `• Club/Escudería: ${p.club}` : null,
      p.liga ? `• Categoría: ${p.liga}` : null,
      p.tipo ? `• Tipo: ${p.tipo}` : null,
      p.edicion ? `• Edición: ${p.edicion}` : null,
      p.size ? `• Talla: ${p.size}` : `• Talla: (sin talla)`,
      p.customName ? `• Nombre: ${p.customName}` : `• Nombre: (sin nombre)`,
      p.customNumber ? `• Número: ${p.customNumber}` : `• Número: (sin número)`,
      p.patches ? `• Parches: ${p.patches}` : null,
      `• Foto: ${p.img}`,
      `• Precio: ${money(p.precio)}`,
      p.notes ? `• Notas: ${p.notes}` : null
    ].filter(Boolean);

    return lines.join("\n");
  });

  const header = [
    "Hola Ultimate Kits 👋",
    "Pedido WEB registrado correctamente ✅",
    `OrderID: ${orderId}`,
    "",
    "Quiero hacer este pedido (carrito):",
    ""
  ].join("\n");

  const text = encodeURIComponent(
    header + blocks.join("\n\n" + "—".repeat(12) + "\n\n")
  );

  // 🔹 3) ABRIR WHATSAPP (solo si guardó)
  window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}


cartSendBtn?.addEventListener("click", sendCartToWhatsApp);
cartSendBtn2?.addEventListener("click", sendCartToWhatsApp);

// Inputs del carrito
document.addEventListener("input", (e) => {
  const el = e.target;
  const key = el.dataset.cart;
  if(!key) return;

  const idx = Number(el.dataset.idx);
  if(!Number.isFinite(idx) || !cart[idx]) return;

  if(key === "name") cart[idx].customName = el.value;
  if(key === "number") cart[idx].customNumber = el.value;
  if(key === "patches") cart[idx].patches = el.value;
  if(key === "notes") cart[idx].notes = el.value;

  saveCart();
});

document.addEventListener("change", (e) => {
  const el = e.target;
  const key = el.dataset.cart;
  if(key !== "size") return;

  const idx = Number(el.dataset.idx);
  if(!Number.isFinite(idx) || !cart[idx]) return;

  cart[idx].size = el.value;
  saveCart();
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cart='remove']");
  if(!btn) return;
  const idx = Number(btn.dataset.idx);
  if(!Number.isFinite(idx)) return;
  cart.splice(idx, 1);
  saveCart();
  renderCart();
});

// ==============================
// Modal pedido individual
// ==============================
function openModal(product){
  selectedProduct = product;
  if(productSummary){
    const line = [product.edicion || "", product.club || "", product.tipo || "", money(product.precio)]
      .filter(Boolean).join(" · ");
    productSummary.textContent = line;
  }
  if(modal) modal.hidden = false;
  document.body.style.overflow = "hidden";
  orderForm?.reset();
}

function closeModal(){
  if(modal) modal.hidden = true;
  document.body.style.overflow = "";
  selectedProduct = null;
}

closeModalBtn?.addEventListener("click", closeModal);
cancelOrderBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

document.addEventListener("click", (e) => {
  const orderBtn = e.target.closest("a.js-order");
  const addBtn = e.target.closest("a.js-add");
  if(!orderBtn && !addBtn) return;

  e.preventDefault();
  const btn = orderBtn || addBtn;
  const id = btn.dataset.id;
  const product = items.find(x => x.id === id);
  if(!product) return;

  if(addBtn){
    cart.push({ ...product, customName:"", customNumber:"", size:"", patches:"", notes:"" });
    saveCart();
    updateCartBar();
    return;
  }

  openModal(product);
});

orderForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if(!selectedProduct) return;

  const shirtName = (document.getElementById("shirtName")?.value || "").trim();
  const shirtNumber = (document.getElementById("shirtNumber")?.value || "").trim();
  const shirtSize = document.getElementById("shirtSize")?.value || "";
  const patches = (document.getElementById("patches")?.value || "").trim();
  const notes = (document.getElementById("notes")?.value || "").trim();

  const lines = [
    "Hola Ultimate Kits 👋",
    "Quiero pedir:",
    "",
    `• Producto: ${selectedProduct.nombre || ""}`.trim(),
    selectedProduct.club ? `• Club/Escudería: ${selectedProduct.club}` : null,
    selectedProduct.liga ? `• Categoría: ${selectedProduct.liga}` : null,
    selectedProduct.tipo ? `• Tipo: ${selectedProduct.tipo}` : null,
    selectedProduct.edicion ? `• Edición: ${selectedProduct.edicion}` : null,
    shirtSize ? `• Talla: ${shirtSize}` : "• Talla: (sin talla)",
    shirtName ? `• Nombre camiseta: ${shirtName}` : "• Nombre camiseta: (sin nombre)",
    shirtNumber ? `• Número: ${shirtNumber}` : "• Número: (sin número)",
    patches ? `• Parches: ${patches}` : null,
    `• Foto: ${selectedProduct.img}`,
    `• Precio: ${money(selectedProduct.precio)}`,
    notes ? `• Notas: ${notes}` : null,
    "",
    "Gracias!"
  ].filter(Boolean);

  window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
});

// ==============================
// Init
// ==============================
function debounce(fn, wait=250){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function init(){
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();

  const metaData = await loadJSONP(API_URL + "?mode=meta");
  const meta = metaData.meta || { clubs: [], tipos: [], precios: [], f1Teams: [] };

  // Selects comunes
  setOptions(tipoSel, meta.tipos || [], "Todos");
  if(precioSel){
    precioSel.innerHTML =
      `<option value="all">Todos</option>` +
      (meta.precios || []).map(v => `<option value="${v}">${priceLabelUSD(Number(v))}</option>`).join("");
  }

  // Fútbol
  if(state.mode === "football"){
    renderEditionChips();
    setOptions(clubSel, meta.clubs || [], "Todos");

    clubSel?.addEventListener("change", () => { state.club = clubSel.value; fetchPage(true); });
  }

  // F1
  if(state.mode === "f1"){
    const fallbackTeams = [
      "Alpine","Aston Martin","Ferrari","Haas","Kick Sauber",
      "McLaren","Mercedes","RB VISA","Red Bull","Williams"
    ];
    const rawTeams = (meta.f1Teams || meta.f1teams || []);
    const teams = unique(rawTeams.length ? rawTeams : fallbackTeams);
    renderF1Teams(teams);
  }

  // Listeners comunes
  tipoSel?.addEventListener("change", () => { state.tipo = tipoSel.value; fetchPage(true); });
  precioSel?.addEventListener("change", () => { state.precio = precioSel.value; fetchPage(true); });

  qEl?.addEventListener("input", debounce(() => {
    state.q = norm(qEl.value);
    fetchPage(true);
  }, 250));

  clearBtn?.addEventListener("click", () => {
    state.f1Team = "all";
    state.edicion = "all";
    state.club = "all";
    state.tipo = "all";
    state.precio = "all";
    state.q = "";

    if(qEl) qEl.value = "";
    if(tipoSel) tipoSel.value = "all";
    if(precioSel) precioSel.value = "all";
    if(clubSel) clubSel.value = "all";

    // reset chips
    if(editionChips) renderEditionChips();
    if(f1TeamsEl){
      f1TeamsEl.querySelectorAll(".chip").forEach(b => b.classList.remove("isOn"));
      f1TeamsEl.querySelector(`.chip[data-team="all"]`)?.classList.add("isOn");
    }

    fetchPage(true);
  });

  updateCartBar();
  fetchPage(true);
}

init().catch(err => {
  console.error(err);
  if(grid) grid.innerHTML = `<p class="muted">No se pudo iniciar el catálogo. Revisa tu Apps Script.</p>`;
});
