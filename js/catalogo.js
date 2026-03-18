// ==============================
// ULTIMATE KITS — CATALOGO + CARRITO + WHATSAPP + SUPABASE
// ==============================

const API_URL =
  "https://ultimate-kits-api.ultimatekits00.workers.dev/";
const WHATSAPP_NUMBER = "34648972815";
const DEFAULT_LIMIT = 60;
const CART_KEY = "uk_cart_v2";
const LONG_SLEEVE_EXTRA = 5;

// SUPABASE
const SB_URL = "https://zjsqnhatvowjsvfwnqao.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqc3FuaGF0dm93anN2ZnducWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI4MTcsImV4cCI6MjA4OTI4ODgxN30.aZ7ed4j533yCB4BEFVIDnavuy_Nt0mUqVWYO52xzczM";
const SB_H = {"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json","Prefer":"return=representation"};

async function sbPost(table, data) {
  const r = await fetch(SB_URL+"/rest/v1/"+table, {method:"POST",headers:SB_H,body:JSON.stringify(data)});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbGet(table, query) {
  const r = await fetch(SB_URL+"/rest/v1/"+table+query, {headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY}});
  return r.json();
}
async function sbPatch(table, query, data) {
  await fetch(SB_URL+"/rest/v1/"+table+query, {method:"PATCH",headers:SB_H,body:JSON.stringify(data)});
}

async function saveOrderToPanel(orderData, items) {
  try {
    var res = await sbPost("pedidos", orderData);
    var pedidoId = res[0] && res[0].id;
    if (pedidoId && items && items.length) {
      for (var i = 0; i < items.length; i++) {
        await sbPost("pedido_items", Object.assign({}, items[i], { pedido_id: pedidoId }));
      }
    }
    for (var j = 0; j < (items || []).length; j++) {
      var prod = items[j].producto;
      if (!prod) continue;
      try {
        var existing = await sbGet("ventas_producto", "?producto=eq." + encodeURIComponent(prod));
        if (existing && existing.length > 0) {
          await sbPatch("ventas_producto", "?producto=eq." + encodeURIComponent(prod), { cantidad: existing[0].cantidad + 1 });
        } else {
          await sbPost("ventas_producto", { producto: prod, cantidad: 1 });
        }
      } catch(e) { console.warn("Sales error:", e); }
    }
    var cliente = orderData.cliente;
    if (cliente) {
      try {
        var cliData = await sbGet("clientes", "?nombre=ilike." + encodeURIComponent(cliente));
        var totalPrecio = Number(orderData.precio || 0);
        if (cliData && cliData.length > 0) {
          var cl = cliData[0];
          await sbPatch("clientes", "?id=eq." + cl.id, { pedidos: (cl.pedidos || 0) + 1, total_gastado: Number(cl.total_gastado || 0) + totalPrecio });
        } else {
          await sbPost("clientes", { nombre: cliente, telefono: orderData.telefono || "", pais: "", pedidos: 1, total_gastado: totalPrecio });
        }
      } catch(e) { console.warn("Client error:", e); }
    }
    console.log("✅ Pedido guardado:", orderData.codigo, "(" + (items ? items.length : 1) + " items)");
  } catch (err) {
    console.warn("⚠️ Panel error:", err);
  }
}

function money(n) { return "$" + Number(n || 0); }
function getFinalPrice(item) { return Number(item && item.precio || 0) + (item && item.isLongSleeve ? LONG_SLEEVE_EXTRA : 0); }
function formatLongSleeve(v) { return v ? "Sí (+$" + LONG_SLEEVE_EXTRA + ")" : "No"; }
function norm(s) { return (s || "").toString().toLowerCase().trim(); }
function unique(arr) { return [].concat(new Set((arr || []).filter(Boolean))).sort(function(a, b) { return a.localeCompare(b, "es"); }); }

function setOptions(select, values, placeholder) {
  if (!select) return;
  placeholder = placeholder || "Todos";
  select.innerHTML = "";
  var opt0 = document.createElement("option");
  opt0.value = "all"; opt0.textContent = placeholder;
  select.appendChild(opt0);
  (values || []).forEach(function(v) {
    var o = document.createElement("option");
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
}

function priceLabelUSD(p) {
  var n = Number(p);
  if (n === 25) return "$25 (Fan)";
  if (n === 30) return "$30 (Edición especial)";
  if (n === 35) return "$35 (Polos/Retro/Player)";
  if (n === 40) return "$40 (Chaquetas F1)";
  return money(n);
}

function makeOrderId() {
  var d = new Date();
  return "UK-" + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0") + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
}

function makeTracking() {
  return "TRK-" + Date.now().toString(36).toUpperCase().slice(-8);
}

function openWhatsApp(text) {
  var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
  var w = window.open(url, "_blank");
  if (!w) window.location.href = url;
}

function loadJSONP(url) {
  return new Promise(function(resolve, reject) {
    var cbName = "cb_" + Math.random().toString(36).slice(2);
    var s = document.createElement("script");
    window[cbName] = function(data) { resolve(data); cleanup(); };
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cbName + "&_=" + Date.now();
    s.onerror = function() { reject(new Error("JSONP load error")); cleanup(); };
    document.body.appendChild(s);
    function cleanup() {
      try { delete window[cbName]; } catch (e) {}
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  });
}

var MODE = (document.body.getAttribute("data-mode") || "football").toLowerCase();
var grid = document.getElementById("grid");
var emptyEl = document.getElementById("empty");
var activeFiltersEl = document.getElementById("activeFilters");
var loadMoreBtn = document.getElementById("loadMoreBtn");
var qEl = document.getElementById("q");
var clearBtn = document.getElementById("clearBtn");
var editionChips = document.getElementById("editionChips");
var clubSel = document.getElementById("club");
var tipoSel = document.getElementById("tipo");
var precioSel = document.getElementById("precio");
var orderModal = document.getElementById("orderModal");
var closeModalBtn = document.getElementById("closeModal");
var cancelOrderBtn = document.getElementById("cancelOrder");
var productSummary = document.getElementById("productSummary");
var orderForm = document.getElementById("orderForm");
var longSleeveEl = document.getElementById("longSleeve");
var cartBar = document.getElementById("cartBar");
var cartCountEl = document.getElementById("cartCount");
var cartOpenBtn = document.getElementById("cartOpenBtn");
var cartSendBtn = document.getElementById("cartSendBtn");
var cartModal = document.getElementById("cartModal");
var closeCartBtn = document.getElementById("closeCart");
var cartList = document.getElementById("cartList");
var cartTotalEl = document.getElementById("cartTotal");
var cartClearBtn = document.getElementById("cartClearBtn");
var cartSendBtn2 = document.getElementById("cartSendBtn2");
var checkoutModal = document.getElementById("checkoutModal");
var checkoutForm = document.getElementById("checkoutForm");

var state = { mode: MODE, f1Team: "all", edicion: "all", club: "all", tipo: "all", precio: "all", q: "" };
var allItems = [];
var page = 1;
var total = 0;
var loading = false;
var checkoutContext = { type: null, orderId: null, singleItem: null };

function renderActive() {
  if (!activeFiltersEl) return;
  var parts = [];
  parts.push(state.mode === "f1" ? "Modo: F1" : "Modo: Fútbol");
  if (state.mode === "f1") { if (state.f1Team !== "all") parts.push("Escudería: " + state.f1Team); }
  else { if (state.edicion !== "all") parts.push("Edición: " + state.edicion); if (state.club !== "all") parts.push("Club: " + state.club); }
  if (state.tipo !== "all") parts.push("Tipo: " + state.tipo);
  if (state.precio !== "all") parts.push("Precio: " + money(state.precio));
  if (state.q) parts.push('Buscar: "' + state.q + '"');
  activeFiltersEl.innerHTML = parts.length
    ? '<span class="afLabel">Filtros:</span> ' + parts.map(function(p) { return '<span class="afPill">' + p + '</span>'; }).join("")
    : '<span class="afLabel muted">Sin filtros activos</span>';
}

function cardHTML(it) {
  var metaLine = [it.club || "", it.tipo || ""].filter(Boolean).join(" · ");
  var imgSrc = window._ukCloud ? window._ukCloud(it.img) : it.img;
  return '<article class="productCard"><div class="productImg"><img src="' + imgSrc + '" alt="' + (it.nombre || "Producto") + '" loading="lazy" /><span class="pFloat">' + (it.edicion || "") + '</span></div><div class="productInfo"><h3>' + (it.nombre || "Producto") + '</h3><p class="muted">' + metaLine + '</p><div class="productBottom"><span class="price">' + money(Number(it.precio || 0)) + '</span><div style="display:flex; gap:8px;"><a class="miniBtn js-order" href="#" data-id="' + it.id + '">Pedir</a><a class="miniBtn js-add" href="#" data-id="' + it.id + '">Añadir</a></div></div></div></article>';
}

function renderEditionChips() {
  if (!editionChips) return;
  if (state.mode !== "football") { editionChips.style.display = "none"; return; }
  editionChips.style.display = "flex";
  var base = ["Fan", "Player", "Retro", "Edición especial"];
  var all = ["all"].concat(base);
  editionChips.innerHTML = all.map(function(v) {
    var label = v === "all" ? "Todo" : v;
    var on = state.edicion === v;
    return '<button class="chip ' + (on ? "isOn" : "") + '" data-ed="' + v + '" type="button">' + label + '</button>';
  }).join("");
  editionChips.querySelectorAll("button[data-ed]").forEach(function(btn) {
    btn.addEventListener("click", function() { state.edicion = btn.getAttribute("data-ed") || "all"; renderEditionChips(); fetchPage(true); });
  });
}

function buildParams() {
  var params = new URLSearchParams();
  params.set("page", String(page)); params.set("limit", String(DEFAULT_LIMIT));
  params.set("q", state.q || ""); params.set("tipo", state.tipo); params.set("precio", state.precio);
  if (state.mode === "f1") { params.set("liga", "F1"); params.set("club", state.f1Team); params.set("edicion", "all"); }
  else { params.set("liga", "all"); params.set("club", state.club); params.set("edicion", state.edicion); }
  return params;
}

function filterOutF1(arr) {
  return (arr || []).filter(function(it) { var liga = String(it.liga || "").toLowerCase().trim(); if (!liga) return true; return liga !== "f1" && liga.indexOf("formula 1") === -1; });
}

async function fetchPage(reset) {
  if (loading) return;
  loading = true;
  try {
    if (reset) { page = 1; allItems = []; if (grid) grid.innerHTML = ""; }
    var params = buildParams();
    var guard = 0, rawItems = [], safeItems = [];
    while (guard < 10) {
      params.set("page", String(page));
      var data = await loadJSONP(API_URL + "?" + params.toString());
      total = Number(data && data.total || 0); rawItems = data && data.items || [];
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
  } catch (err) { console.error(err); if (grid) grid.innerHTML = '<p class="muted">No se pudo cargar el catálogo.</p>'; }
  finally { loading = false; }
}

var cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); if (!Array.isArray(cart)) cart = []; } catch (e) { cart = []; }

function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartBar(); }
function updateCartBar() { if (!cartBar || !cartCountEl) return; var n = cart.length; cartBar.style.display = n ? "block" : "none"; cartCountEl.textContent = n + " item" + (n === 1 ? "" : "s"); }

function cartItemHTML(item, idx) {
  return '<div class="panel" style="padding:12px; display:flex; gap:12px; align-items:flex-start;"><img src="' + item.img + '" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:14px;flex:0 0 auto;" loading="lazy"><div style="flex:1;"><strong>' + (item.nombre || "Producto") + '</strong><div class="muted" style="margin-top:4px;font-size:.85rem;">' + [item.liga, item.club, item.tipo, item.edicion].filter(Boolean).join(" · ") + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;"><label class="field" style="margin:0;"><span>Nombre</span><input data-cart="name" data-idx="' + idx + '" type="text" value="' + (item.customName || "") + '" maxlength="16"></label><label class="field" style="margin:0;"><span>Número</span><input data-cart="number" data-idx="' + idx + '" type="text" value="' + (item.customNumber || "") + '" maxlength="3"></label><label class="field" style="margin:0;"><span>Talla</span><select data-cart="size" data-idx="' + idx + '"><option value="">Selecciona talla</option>' + ["XS","S","M","L","XL","2XL"].map(function(s) { return '<option value="' + s + '"' + (item.size === s ? " selected" : "") + '>' + s + '</option>'; }).join("") + '</select></label><label class="field" style="margin:0;"><span>Parches</span><input data-cart="patches" data-idx="' + idx + '" type="text" value="' + (item.patches || "") + '"></label><label class="field" style="grid-column:1/-1;margin:0;"><span>Notas</span><input data-cart="notes" data-idx="' + idx + '" type="text" value="' + (item.notes || "") + '"></label></div><label class="longSleeveField" style="margin:10px 0 0;"><span>Manga larga</span><div class="longSleeveBox"><div class="longSleeveLeft"><div class="longSleeveTitle">Manga larga</div><div class="longSleeveSub">+$' + LONG_SLEEVE_EXTRA + '</div></div><input data-cart="longSleeve" data-idx="' + idx + '" type="checkbox"' + (item.isLongSleeve ? " checked" : "") + '></div></label><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;"><span class="muted">' + money(getFinalPrice(item)) + '</span><button class="btn btnGhost" type="button" data-cart="remove" data-idx="' + idx + '" style="padding:6px 12px;font-size:.8rem;">Quitar</button></div></div></div>';
}

function renderCart() {
  if (!cartList || !cartTotalEl) return;
  if (!cart.length) { cartList.innerHTML = '<p class="muted">Tu carrito está vacío.</p>'; cartTotalEl.textContent = ""; updateCartBar(); return; }
  cartList.innerHTML = cart.map(cartItemHTML).join("");
  cartTotalEl.textContent = "Total estimado: " + money(cart.reduce(function(sum, x) { return sum + getFinalPrice(x); }, 0));
  updateCartBar();
}

function openCart() { renderCart(); if (cartModal) { cartModal.hidden = false; document.body.style.overflow = "hidden"; } }
function closeCart() { if (cartModal) { cartModal.hidden = true; document.body.style.overflow = ""; } }

if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
if (cartModal) cartModal.addEventListener("click", function(e) { if (e.target === cartModal) closeCart(); });
if (cartOpenBtn) cartOpenBtn.addEventListener("click", openCart);
if (cartClearBtn) cartClearBtn.addEventListener("click", function() { cart = []; saveCart(); renderCart(); });

document.addEventListener("input", function(e) {
  var el = e.target; if (!el || !el.dataset) return;
  var key = el.dataset.cart; if (!key) return;
  var idx = Number(el.dataset.idx);
  if (!Number.isFinite(idx) || !cart[idx]) return;
  if (key === "name") cart[idx].customName = el.value;
  if (key === "number") cart[idx].customNumber = el.value;
  if (key === "patches") cart[idx].patches = el.value;
  if (key === "notes") cart[idx].notes = el.value;
  saveCart();
});

document.addEventListener("change", function(e) {
  var el = e.target; if (!el || !el.dataset) return;
  var key = el.dataset.cart; var idx = Number(el.dataset.idx);
  if (!Number.isFinite(idx) || !cart[idx]) return;
  if (key === "size") { cart[idx].size = el.value; saveCart(); return; }
  if (key === "longSleeve") { cart[idx].isLongSleeve = !!el.checked; saveCart(); renderCart(); return; }
});

document.addEventListener("click", function(e) {
  var btn = e.target.closest("[data-cart='remove']");
  if (!btn) return; var idx = Number(btn.dataset.idx);
  if (!Number.isFinite(idx)) return;
  cart.splice(idx, 1); saveCart(); renderCart();
});

var selectedProduct = null;

function refreshOrderSummary() {
  if (!selectedProduct || !productSummary) return;
  var isLong = longSleeveEl && longSleeveEl.checked;
  var finalPrice = Number(selectedProduct.precio || 0) + (isLong ? LONG_SLEEVE_EXTRA : 0);
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

function closeOrderModal() { if (orderModal) orderModal.hidden = true; document.body.style.overflow = ""; selectedProduct = null; }

if (closeModalBtn) closeModalBtn.addEventListener("click", closeOrderModal);
if (cancelOrderBtn) cancelOrderBtn.addEventListener("click", closeOrderModal);
if (orderModal) orderModal.addEventListener("click", function(e) { if (e.target === orderModal) closeOrderModal(); });
if (longSleeveEl) longSleeveEl.addEventListener("change", refreshOrderSummary);

document.addEventListener("click", function(e) {
  var orderBtn = e.target.closest("a.js-order");
  var addBtn = e.target.closest("a.js-add");
  if (!orderBtn && !addBtn) return;
  e.preventDefault();
  var btn = orderBtn || addBtn;
  var id = btn.getAttribute("data-id");
  var product = allItems.find(function(x) { return x.id === id; });
  if (!product) return;
  if (addBtn) { cart.push(Object.assign({}, product, { customName: "", customNumber: "", size: "", patches: "", notes: "", isLongSleeve: false })); saveCart(); updateCartBar(); return; }
  openOrderModal(product);
});

function openCheckout(type, payload) {
  if (!checkoutModal) return;
  checkoutContext.type = type; checkoutContext.orderId = makeOrderId();
  checkoutContext.singleItem = payload && payload.singleItem || null;
  checkoutModal.hidden = false; document.body.style.overflow = "hidden";
  if (checkoutForm) checkoutForm.reset();
}

function closeCheckout() { if (!checkoutModal) return; checkoutModal.hidden = true; document.body.style.overflow = ""; checkoutContext = { type: null, orderId: null, singleItem: null }; }

if (checkoutModal) { checkoutModal.addEventListener("click", function(e) { var closeBtn = e.target.closest("[data-close='1']"); if (closeBtn || e.target === checkoutModal) closeCheckout(); }); }

if (orderForm) {
  orderForm.addEventListener("submit", function(e) {
    e.preventDefault(); if (!selectedProduct) return;
    var singleItem = Object.assign({}, selectedProduct, {
      customName: (document.getElementById("shirtName") ? document.getElementById("shirtName").value : "").trim(),
      customNumber: (document.getElementById("shirtNumber") ? document.getElementById("shirtNumber").value : "").trim(),
      size: document.getElementById("shirtSize") ? document.getElementById("shirtSize").value : "",
      patches: (document.getElementById("patches") ? document.getElementById("patches").value : "").trim(),
      notes: (document.getElementById("notes") ? document.getElementById("notes").value : "").trim(),
      isLongSleeve: !!(document.getElementById("longSleeve") && document.getElementById("longSleeve").checked)
    });
    closeOrderModal(); openCheckout("single", { singleItem: singleItem });
  });
}

function startCartCheckout() { if (!cart.length) return; closeCart(); openCheckout("cart", {}); }
if (cartSendBtn) cartSendBtn.addEventListener("click", startCartCheckout);
if (cartSendBtn2) cartSendBtn2.addEventListener("click", startCartCheckout);

function buildItemData(p) {
  var productName = p.nombre || [p.club, p.edicion].filter(Boolean).join(" · ");
  return {
    producto: productName,
    liga: p.liga || "",
    talla: p.size || "",
    precio: getFinalPrice(p),
    personalizacion: [p.customName, p.customNumber].filter(Boolean).join(" "),
    notas: [p.patches ? "Parches: " + p.patches : "", p.notes, p.isLongSleeve ? "Manga larga" : ""].filter(Boolean).join(" | ")
  };
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", function(e) {
    e.preventDefault();
    var fd = new FormData(checkoutForm);
    var nombre = String(fd.get("nombre") || "").trim();
    var direccion = String(fd.get("direccion") || "").trim();
    var postal = String(fd.get("postal") || "").trim();
    var ciudad = String(fd.get("ciudad") || "").trim();
    var pais = String(fd.get("pais") || "").trim();
    var telefono = String(fd.get("telefono") || "").trim();

    if (!nombre || !direccion || !postal || !ciudad || !pais || !telefono) { alert("Por favor rellena todos los campos del envío."); return; }

    var orderId = checkoutContext.orderId || makeOrderId();

    if (checkoutContext.type === "single" && checkoutContext.singleItem) {
      var p = checkoutContext.singleItem;
      var finalPrice = getFinalPrice(p);
      var itemData = buildItemData(p);

      saveOrderToPanel({
        codigo: orderId, cliente: nombre, telefono: telefono,
        producto: itemData.producto, liga: p.liga || "", talla: p.size || "",
        precio: finalPrice, metodo: "Web", destino: pais || "Internacional",
        personalizacion: itemData.personalizacion, notas: itemData.notas,
        tracking: makeTracking(), estado: "Hecho"
      }, [itemData]);

      var textLines = [
        "Hola Ultimate Kits 👋", "Quiero hacer este pedido:", "",
        "OrderID: " + orderId, "",
        "📦 Datos de envío:",
        "• Nombre: " + nombre, "• Teléfono: " + telefono,
        "• Dirección: " + direccion, "• Código postal: " + postal,
        "• Ciudad: " + ciudad, "• País: " + pais, "",
        "🧾 Producto:",
        "• Producto: " + (p.nombre || ""),
        p.club ? "• Club/Escudería: " + p.club : null,
        p.liga ? "• Categoría: " + p.liga : null,
        p.tipo ? "• Tipo: " + p.tipo : null,
        p.edicion ? "• Edición: " + p.edicion : null,
        p.temporada ? "• Temporada: " + p.temporada : null,
        "• Manga larga: " + formatLongSleeve(!!p.isLongSleeve),
        p.size ? "• Talla: " + p.size : "• Talla: (sin talla)",
        p.customName ? "• Nombre: " + p.customName : "• Nombre: (sin nombre)",
        p.customNumber ? "• Número: " + p.customNumber : "• Número: (sin número)",
        p.patches ? "• Parches: " + p.patches : null,
        p.notes ? "• Notas: " + p.notes : null,
        "• Foto: " + p.img, "• Precio: " + money(finalPrice), "", "Gracias!"
      ].filter(Boolean);
      closeCheckout(); openWhatsApp(textLines.join("\n")); return;
    }

    if (checkoutContext.type === "cart") {
      if (!cart.length) { alert("Tu carrito está vacío."); return; }
      var totalAmount = cart.reduce(function(sum, p) { return sum + getFinalPrice(p); }, 0);

      var allItemsData = cart.map(function(p) { return buildItemData(p); });
      var prodSummary = cart.length === 1 ? allItemsData[0].producto : cart.length + " camisetas";

      saveOrderToPanel({
        codigo: orderId, cliente: nombre, telefono: telefono,
        producto: prodSummary, liga: "", talla: "",
        precio: totalAmount, metodo: "Web", destino: pais || "Internacional",
        personalizacion: "", notas: cart.length + " items en carrito",
        tracking: makeTracking(), estado: "Hecho"
      }, allItemsData);

      var blocks = cart.map(function(p, i) {
        return [
          "🧾 Item #" + (i + 1),
          "• Producto: " + (p.nombre || ""),
          p.club ? "• Club/Escudería: " + p.club : null,
          p.liga ? "• Categoría: " + p.liga : null,
          p.tipo ? "• Tipo: " + p.tipo : null,
          p.edicion ? "• Edición: " + p.edicion : null,
          p.temporada ? "• Temporada: " + p.temporada : null,
          "• Manga larga: " + formatLongSleeve(!!p.isLongSleeve),
          p.size ? "• Talla: " + p.size : "• Talla: (sin talla)",
          p.customName ? "• Nombre: " + p.customName : "• Nombre: (sin nombre)",
          p.customNumber ? "• Número: " + p.customNumber : "• Número: (sin número)",
          p.patches ? "• Parches: " + p.patches : null,
          p.notes ? "• Notas: " + p.notes : null,
          "• Foto: " + p.img, "• Precio: " + money(getFinalPrice(p))
        ].filter(Boolean).join("\n");
      });

      var header = [
        "Hola Ultimate Kits 👋", "Quiero hacer este pedido (carrito):", "",
        "OrderID: " + orderId, "",
        "📦 Datos de envío:",
        "• Nombre: " + nombre, "• Teléfono: " + telefono,
        "• Dirección: " + direccion, "• Código postal: " + postal,
        "• Ciudad: " + ciudad, "• País: " + pais, "",
        "💰 Total estimado: " + money(totalAmount), "", "🛒 Items:", ""
      ].join("\n");

      closeCheckout();
      openWhatsApp(header + blocks.join("\n\n————————————\n\n"));
      return;
    }

    alert("Error: no se pudo determinar el tipo de checkout.");
  });
}

if (loadMoreBtn) loadMoreBtn.addEventListener("click", function() { fetchPage(false); });

function debounce(fn, wait) { var t; wait = wait || 250; return function() { var args = arguments; clearTimeout(t); t = setTimeout(function() { fn.apply(null, args); }, wait); }; }

if (tipoSel) tipoSel.addEventListener("change", function() { state.tipo = tipoSel.value; fetchPage(true); });
if (precioSel) precioSel.addEventListener("change", function() { state.precio = precioSel.value; fetchPage(true); });
if (clubSel) clubSel.addEventListener("change", function() { state.club = clubSel.value; fetchPage(true); });
if (qEl) qEl.addEventListener("input", debounce(function() { state.q = norm(qEl.value); fetchPage(true); }, 250));

if (clearBtn) {
  clearBtn.addEventListener("click", function() {
    state.f1Team = "all"; state.edicion = "all"; state.club = "all";
    state.tipo = "all"; state.precio = "all"; state.q = "";
    if (qEl) qEl.value = "";
    if (tipoSel) tipoSel.value = "all";
    if (precioSel) precioSel.value = "all";
    if (clubSel) clubSel.value = "all";
    renderEditionChips(); fetchPage(true);
  });
}

async function init() {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
  updateCartBar(); renderEditionChips();
  var metaData = await loadJSONP(API_URL + "?mode=meta");
  var meta = metaData && metaData.meta || { clubs: [], tipos: [], precios: [], f1Teams: [] };
  setOptions(tipoSel, meta.tipos || [], "Todos");
  if (precioSel) {
    precioSel.innerHTML = '<option value="all">Todos</option>' +
      (meta.precios || []).map(function(v) { return '<option value="' + v + '">' + priceLabelUSD(Number(v)) + '</option>'; }).join("");
  }
  if (state.mode === "football") setOptions(clubSel, meta.clubs || [], "Todos");
  await fetchPage(true);
}

init().catch(function(err) { console.error(err); if (grid) grid.innerHTML = '<p class="muted">No se pudo iniciar el catálogo.</p>'; });