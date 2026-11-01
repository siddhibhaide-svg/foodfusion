/* =========================================================
   FOODFUSION  –  core script (Supabase version)
   Sections: helpers · supabase · photos · cards · cart ·
             login · checkout · orders · page chrome ·
             page: home · menu · orders
========================================================= */

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rupee = n => "₹" + Math.round(n);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = iso => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- small browser storage (cart, coupon, photo cache) ---------- */
const store = {
  get(k, fallback) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

/* ---------- Supabase ---------- */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const STATUSES = ["Placed", "Preparing", "Out for delivery", "Delivered", "Cancelled"];

let FOODS = [];            // menu, loaded from the foods table
let ME = null;             // {id, email, name, role} when logged in
let MY_ORDER_COUNT = 0;    // used for the FIRST30 first-order coupon

function rowToFood(r) {
  return {
    id: r.id, name: r.name, cuisine: r.cuisine, category: r.category, price: r.price,
    rating: Number(r.rating), veg: r.veg, desc: r.description || "", badge: r.badge || "",
    wiki: r.wiki || r.name, img: r.img || ""
  };
}

const DB = {
  async loadFoods() {
    const { data, error } = await sb.from("foods").select("*")
      .order("created_at", { ascending: false }).order("name");
    if (error) { console.error(error); toast("Could not load the menu: " + error.message); FOODS = []; return; }
    FOODS = data.map(rowToFood);
  },
  foods() { return FOODS; }
};

const Auth = {
  user:     () => (ME ? ME.name : ""),
  loggedIn: () => !!ME,
  isAdmin:  () => !!ME && ME.role === "admin"
};

async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { ME = null; MY_ORDER_COUNT = 0; return; }
  const { data: p } = await sb.from("profiles").select("name, role").eq("id", session.user.id).maybeSingle();
  ME = {
    id: session.user.id,
    email: session.user.email,
    name: (p && p.name) || session.user.email.split("@")[0],
    role: (p && p.role) || "customer"
  };
  const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("user_id", ME.id);
  MY_ORDER_COUNT = count || 0;
}

function lookup(id) { return FOODS.find(f => f.id === id) || COMBOS.find(c => c.id === id); }

/* ---------- photos: real dish photos from Wikipedia, cached ---------- */
const imgCache = Object.fromEntries(Object.entries(store.get("ff_imgs_v1", {})).filter(([, v]) => v));
const pending = {}, missing = {};

async function fetchSummary(title) {
  const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("network");
  const j = await r.json();
  if (!j.thumbnail) return null;
  let u = j.thumbnail.source;
  if (j.originalimage && j.originalimage.width >= 500) u = u.replace(/\/\d+px-/, "/500px-");
  else if (j.originalimage) u = j.originalimage.source;
  return u;
}

async function fetchSearch(term) {
  const url = "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=0&gsrlimit=6&prop=pageimages&piprop=thumbnail&pithumbsize=500&format=json&origin=*&gsrsearch=" + encodeURIComponent(term);
  const r = await fetch(url);
  if (!r.ok) throw new Error("network");
  const j = await r.json();
  const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
  const p = pages.find(x => x.thumbnail);
  return p ? p.thumbnail.source : null;
}

function wikiThumb(title, alt) {
  if (imgCache[title]) return Promise.resolve(imgCache[title]);
  if (missing[title]) return Promise.resolve(null);
  if (pending[title]) return pending[title];
  pending[title] = (async () => {
    let u = null;
    try {
      u = await fetchSummary(title);
      if (!u) u = await fetchSearch(title + " food");
      if (!u && alt && alt !== title) u = await fetchSearch(alt + " dish");
    } catch { return null; }
    if (u) { imgCache[title] = u; store.set("ff_imgs_v1", imgCache); } else missing[title] = 1;
    return u;
  })().finally(() => delete pending[title]);
  return pending[title];
}

function hydrateImages(root = document) {
  $$("img[data-wiki]:not([data-w])", root).forEach(img => {
    img.dataset.w = "1";
    wikiThumb(img.dataset.wiki, img.dataset.alt).then(u => { if (u) img.src = u; else img.remove(); });
  });
}

function pic(item, useAlt = !!item.id && !item.wikis) {
  const emoji = (CUISINES[item.cuisine] || {}).emoji || "🍽️";
  const wiki = item.wiki || (item.wikis && item.wikis[0]) || item.name;
  const src = item.img ? `src="${esc(item.img)}"` : `data-wiki="${esc(wiki)}"${useAlt ? ` data-alt="${esc(item.name)}"` : ""}`;
  return `<span class="ph">${emoji}</span><img alt="${esc(item.name || "")}" ${src} onload="this.classList.add('ok')" onerror="this.remove()">`;
}

/* ---------- cards ---------- */
function dishCard(d) {
  const emoji = (CUISINES[d.cuisine] || {}).emoji || "";
  return `
  <article class="card">
    <div class="card-img imgbox">
      ${pic(d)}
      ${d.badge ? `<span class="badge">${esc(d.badge)}</span>` : ""}
      <span class="veg ${d.veg ? "is-veg" : "is-non"}" title="${d.veg ? "Vegetarian" : "Non-vegetarian"}"></span>
    </div>
    <div class="card-body">
      <div class="card-meta"><span>${emoji} ${esc(d.cuisine)} • ${esc(d.category)}</span><span class="rating">★ ${Number(d.rating).toFixed(1)}</span></div>
      <h3>${esc(d.name)}</h3>
      <p>${esc(d.desc)}</p>
      <div class="card-foot">
        <strong>${rupee(d.price)}</strong>
        <button class="add-btn" data-add="${d.id}">+ Add</button>
      </div>
    </div>
  </article>`;
}

function comboCard(c) {
  return `
  <article class="combo">
    <div class="combo-img">
      ${c.wikis.map(w => `<div class="imgbox">${pic({ name: c.name, cuisine: c.cuisine, wiki: w })}</div>`).join("")}
    </div>
    <div class="combo-body">
      <span class="save">Save ${rupee(c.old - c.price)}</span>
      <h3>${esc(c.name)}</h3>
      <p>${esc(c.items)}</p>
      <div class="price"><del>${rupee(c.old)}</del><strong>${rupee(c.price)}</strong></div>
      <button class="add-btn" data-add="${c.id}">Add combo</button>
    </div>
  </article>`;
}

/* ---------- cart (kept in this browser) ---------- */
const getCart = () => store.get("ff_cart", {});
const saveCart = c => { store.set("ff_cart", c); renderCart(); };

function addToCart(id) {
  const item = lookup(id); if (!item) return;
  const cart = getCart();
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  toast(item.name + " added to cart");
}

function changeQty(id, delta) {
  const cart = getCart();
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart(cart);
}

// FIRST30 only works if this customer has never ordered before
const couponOk = () => MY_ORDER_COUNT === 0;

function cartTotals() {
  const raw = getCart(), cart = {};
  let subtotal = 0;
  Object.entries(raw).forEach(([id, q]) => {
    const it = lookup(id);
    if (it) { cart[id] = q; subtotal += it.price * q; }
  });
  const code = store.get("ff_coupon", "");
  const discount = code === "FIRST30" && couponOk() ? Math.round(subtotal * 0.3) : 0;
  const delivery = subtotal === 0 || subtotal - discount >= 500 ? 0 : 40;
  return { cart, subtotal, discount, delivery, total: subtotal - discount + delivery };
}

function renderCart() {
  const { cart, subtotal, discount, delivery, total } = cartTotals();
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const badge = $("#cartCount");
  if (badge) badge.textContent = count;
  const list = $("#cartItems");
  if (!list) return;

  if (!count) {
    list.innerHTML = `<div class="cart-empty"><p>Your cart is empty.</p><a class="btn-solid" href="menu.html">Browse the menu</a></div>`;
    $("#cartFoot").hidden = true;
    return;
  }
  $("#cartFoot").hidden = false;
  list.innerHTML = Object.entries(cart).map(([id, q]) => {
    const d = lookup(id);
    return `
    <div class="cart-row">
      <div class="thumb imgbox">${pic(d)}</div>
      <div class="cart-info"><strong>${esc(d.name)}</strong><span>${rupee(d.price)}</span></div>
      <div class="qty">
        <button onclick="changeQty('${id}',-1)" aria-label="Remove one">−</button>
        <b>${q}</b>
        <button onclick="changeQty('${id}',1)" aria-label="Add one">+</button>
      </div>
    </div>`;
  }).join("");
  hydrateImages(list);

  $("#sumSub").textContent = rupee(subtotal);
  $("#sumDisc").textContent = discount ? "−" + rupee(discount) : "—";
  $("#sumDel").textContent = delivery ? rupee(delivery) : "Free";
  $("#sumTotal").textContent = rupee(total);
  const code = store.get("ff_coupon", "");
  $("#couponMsg").textContent = code === "FIRST30" && !couponOk()
    ? "FIRST30 is only valid on your first order"
    : discount ? "FIRST30 applied: 30% off" : "Free delivery above ₹500";
}

function applyCoupon() {
  const code = $("#couponInput").value.trim().toUpperCase();
  if (code === "FIRST30") { store.set("ff_coupon", code); toast(couponOk() ? "Coupon applied: 30% off" : "Only valid on your first order"); }
  else { store.set("ff_coupon", ""); toast(code ? "That code isn't valid" : "Enter a coupon code"); }
  renderCart();
}

function openCart()  { $("#drawer").classList.add("open");  $("#scrim").classList.add("show"); }
function closeCart() { $("#drawer").classList.remove("open"); $("#scrim").classList.remove("show"); }
const showCart = openCart;

function copyCoupon() {
  const done = () => toast("FIRST30 copied. Apply it in your cart.");
  if (navigator.clipboard) navigator.clipboard.writeText("FIRST30").then(done, done); else done();
}

/* ---------- modal + toast ---------- */
function openModal(html, wide = false) {
  const card = $("#modalBody");
  card.innerHTML = html;
  card.classList.toggle("wide", wide);
  $("#modal").classList.add("show");
}
function closeModal() { $("#modal").classList.remove("show"); }

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------- login / sign up (Supabase Auth) ---------- */
let afterLogin = null;

function loginUI() {
  const btn = $(".login-btn");
  if (btn) btn.textContent = ME ? "Hi, " + ME.name : "Login";
  const adminLink = $("#adminLink");
  if (adminLink) adminLink.hidden = !Auth.isAdmin();
}

function openLogin(mode = "login") {
  if (ME) {
    openModal(`
      <h2>Signed in</h2>
      <p><b>${esc(ME.name)}</b><br>${esc(ME.email)} (${ME.role})</p>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Close</button>
        <button class="btn-solid" onclick="logout()">Sign out</button>
      </div>`);
    return;
  }
  const signup = mode === "signup";
  openModal(`
    <h2>${signup ? "Create your account" : "Welcome back"}</h2>
    <p>${signup ? "Sign up to order food and track your orders." : "Log in to order food and see your orders."}</p>
    <form onsubmit="doAuth(event, '${mode}')">
      ${signup ? `<input id="authName" class="text-input" placeholder="Your name" required>` : ""}
      <input id="authEmail" type="email" class="text-input" placeholder="Email" required>
      <input id="authPw" type="password" minlength="6" class="text-input" placeholder="Password (at least 6 characters)" required>
      <div class="modal-actions"><button class="btn-solid">${signup ? "Sign up" : "Log in"}</button></div>
    </form>
    <p class="switch">${signup
      ? `Already have an account? <button type="button" class="link-btn" onclick="openLogin('login')">Log in</button>`
      : `New here? <button type="button" class="link-btn" onclick="openLogin('signup')">Create an account</button>`}</p>`);
}

async function doAuth(e, mode) {
  e.preventDefault();
  const email = $("#authEmail").value.trim(), password = $("#authPw").value;
  const btn = e.target.querySelector("button.btn-solid");
  btn.disabled = true;
  const res = mode === "signup"
    ? await sb.auth.signUp({ email, password, options: { data: { name: $("#authName").value.trim() } } })
    : await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (res.error) { toast(res.error.message); return; }
  if (!res.data.session) { closeModal(); toast("Check your email to confirm your account, then log in"); return; }
  await afterAuthChange();
  closeModal();
  toast("Welcome, " + ME.name);
  if (afterLogin) { const f = afterLogin; afterLogin = null; f(); }
}

async function afterAuthChange() {
  await loadSession();
  loginUI(); renderCart();
  if (typeof pageRefresh === "function") pageRefresh();
}

async function logout() {
  await sb.auth.signOut();
  closeModal();
  await afterAuthChange();
}

/* ---------- checkout ---------- */
function checkout() {
  const { cart } = cartTotals();
  if (!Object.keys(cart).length) return;
  if (!ME) { afterLogin = checkout; openLogin("login"); return; }
  closeCart();
  const { total } = cartTotals();
  const last = store.get("ff_contact", { phone: "", address: "" });
  openModal(`
    <form class="form" onsubmit="submitOrder(event)">
      <h2>Delivery details</h2>
      <label>Name<input class="text-input" id="coName" required value="${esc(ME.name)}"></label>
      <label>Phone<input class="text-input" id="coPhone" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile number" value="${esc(last.phone)}"></label>
      <label>Address<textarea class="text-input" id="coAddr" required rows="3" placeholder="Flat, building, area, city">${esc(last.address)}</textarea></label>
      <fieldset class="pay">
        <legend>Payment</legend>
        <label><input type="radio" name="pay" value="Cash on delivery" checked> Cash on delivery</label>
        <label><input type="radio" name="pay" value="UPI"> UPI</label>
        <label><input type="radio" name="pay" value="Card"> Card</label>
      </fieldset>
      <div class="modal-actions">
        <button type="button" class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-solid">Place order • ${rupee(total)}</button>
      </div>
    </form>`, true);
}

async function submitOrder(e) {
  e.preventDefault();
  const t = cartTotals();
  if (!Object.keys(t.cart).length) { closeModal(); return; }
  const btn = e.target.querySelector("button.btn-solid");
  btn.disabled = true;
  const phone = $("#coPhone").value.trim(), address = $("#coAddr").value.trim();
  store.set("ff_contact", { phone, address });

  const code = "FF" + Math.floor(10000 + Math.random() * 90000);
  const { data: o, error } = await sb.from("orders").insert({
    code, user_id: ME.id, name: $("#coName").value.trim(), phone, address,
    payment: $("input[name=pay]:checked").value,
    subtotal: Math.round(t.subtotal), discount: Math.round(t.discount),
    delivery: t.delivery, total: Math.round(t.total)
  }).select().single();
  if (error) { btn.disabled = false; toast("Could not place the order: " + error.message); return; }

  const items = Object.entries(t.cart).map(([id, q]) => {
    const d = lookup(id);
    return { order_id: o.id, food_id: UUID_RE.test(id) ? id : null, name: d.name, price: d.price, qty: q, cuisine: d.cuisine };
  });
  const { error: e2 } = await sb.from("order_items").insert(items);
  if (e2) { btn.disabled = false; toast("Order saved, but items failed: " + e2.message); return; }

  MY_ORDER_COUNT++;
  store.set("ff_cart", {}); store.set("ff_coupon", "");
  renderCart();
  openModal(`
    <div class="done-mark">✓</div>
    <h2>Order placed</h2>
    <p>Order <b>${code}</b> for <b>${rupee(t.total)}</b> is being prepared. Estimated delivery: 30–40 minutes.</p>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Keep browsing</button>
      <a class="btn-solid" href="orders.html">View my orders</a>
    </div>`);
}

/* ---------- orders (customer + admin) ---------- */
let ORDERS_CACHE = [];

async function fetchOrders(all) {
  let q = sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
  if (!all) q = q.eq("user_id", ME.id);
  const { data, error } = await q;
  if (error) { toast("Could not load orders: " + error.message); return []; }
  return data.map(r => ({
    id: r.id, code: r.code, name: r.name, phone: r.phone, address: r.address, payment: r.payment,
    subtotal: r.subtotal, discount: r.discount, delivery: r.delivery, total: r.total,
    status: r.status, date: r.created_at,
    items: (r.order_items || []).map(i => ({ id: i.food_id, name: i.name, price: i.price, qty: i.qty, cuisine: i.cuisine }))
  }));
}

function statusPill(s) { return `<span class="pill s-${s.replace(/\s+/g, "-").toLowerCase()}">${s}</span>`; }

function orderCard(o, admin = false) {
  const lines = o.items.map(i => `<li><span>${i.qty} × ${esc(i.name)}</span><span>${rupee(i.price * i.qty)}</span></li>`).join("");
  const who = admin
    ? `<p class="who"><b>${esc(o.name)}</b> • ${esc(o.phone)}<br>${esc(o.address)}</p>`
    : "";
  const action = admin
    ? `<label class="status-edit">Status
         <select class="text-input" onchange="setOrderStatus('${o.id}', this.value)">
           ${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
         </select></label>`
    : `<div class="order-actions">
         <button class="btn-ghost" onclick="reorder('${o.id}')">Order again</button>
         ${o.status === "Placed" ? `<button class="btn-ghost danger" onclick="cancelOrder('${o.id}')">Cancel order</button>` : ""}
       </div>`;
  return `
  <article class="order">
    <div class="order-head">
      <div><h3>${esc(o.code)}</h3><small>${fmtDate(o.date)} • ${esc(o.payment)}</small></div>
      ${statusPill(o.status)}
    </div>
    ${who}
    <ul class="order-items">${lines}</ul>
    <div class="order-total">
      <span>${o.discount ? "Discount −" + rupee(o.discount) + " • " : ""}${o.delivery ? "Delivery " + rupee(o.delivery) : "Free delivery"}</span>
      <strong>${rupee(o.total)}</strong>
    </div>
    ${action}
  </article>`;
}

async function setOrderStatus(id, status) {
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) { toast("Could not update: " + error.message); return; }
  toast("Order is now " + status);
  if (typeof pageRefresh === "function") pageRefresh();
}

async function cancelOrder(id) {
  if (!confirm("Cancel this order?")) return;
  const { error } = await sb.from("orders").update({ status: "Cancelled" }).eq("id", id).eq("status", "Placed");
  if (error) { toast("Could not cancel: " + error.message); return; }
  toast("Order cancelled");
  pageRefresh();
}

function reorder(id) {
  const o = ORDERS_CACHE.find(x => x.id === id);
  if (!o) return;
  const cart = getCart();
  let added = 0;
  o.items.forEach(i => { if (i.id && lookup(i.id)) { cart[i.id] = (cart[i.id] || 0) + i.qty; added++; } });
  saveCart(cart);
  toast(added ? "Items added to your cart" : "Those dishes are no longer available");
  if (added) openCart();
}

/* ---------- page chrome: header, footer, cart drawer, modal ---------- */
function injectChrome() {
  const page = document.body.dataset.page || "";
  const link = (href, label, key, extra = "") => `<a href="${href}" class="${page === key ? "active" : ""}" ${extra}>${label}</a>`;
  document.body.insertAdjacentHTML("afterbegin", `
  <header>
    <nav class="navbar">
      <a href="index.html" class="logo">🍴 Food<span>Fusion</span></a>
      <div class="nav-links">
        ${link("index.html", "Home", "home")}
        ${link("index.html#cuisines", "Cuisines", "")}
        ${link("menu.html", "Menu", "menu")}
        ${link("index.html#combos", "Combos", "")}
        ${link("orders.html", "My orders", "orders")}
        ${link("admin.html", "Admin", "admin", 'id="adminLink" hidden')}
      </div>
      <div class="nav-actions">
        <button class="login-btn" onclick="openLogin()">Login</button>
        <button class="cart-btn" onclick="openCart()" aria-label="Open cart">🛒 <span>Cart</span> <b id="cartCount">0</b></button>
      </div>
    </nav>
  </header>`);

  document.body.insertAdjacentHTML("beforeend", `
  <footer>
    <div class="footer-content">
      <div><a href="index.html" class="logo">🍴 Food<span>Fusion</span></a><p>Smart food ordering from around the world.</p></div>
      <div class="footer-links"><a href="index.html">Home</a><a href="menu.html">Menu</a><a href="orders.html">My orders</a></div>
    </div>
    <div class="footer-bottom">© 2026 FoodFusion • Built with ❤️</div>
  </footer>
  <div class="scrim" id="scrim" onclick="closeCart()"></div>
  <aside class="drawer" id="drawer" aria-label="Your cart">
    <div class="drawer-head"><h2>Your cart</h2><button class="icon-btn" onclick="closeCart()" aria-label="Close cart">✕</button></div>
    <div class="drawer-items" id="cartItems"></div>
    <div class="drawer-foot" id="cartFoot" hidden>
      <div class="coupon-row">
        <input id="couponInput" class="text-input" placeholder="Coupon code" value="${esc(store.get("ff_coupon", ""))}">
        <button class="btn-ghost" onclick="applyCoupon()">Apply</button>
      </div>
      <small id="couponMsg"></small>
      <dl class="sum">
        <div><dt>Subtotal</dt><dd id="sumSub"></dd></div>
        <div><dt>Discount</dt><dd id="sumDisc"></dd></div>
        <div><dt>Delivery</dt><dd id="sumDel"></dd></div>
        <div class="sum-total"><dt>Total</dt><dd id="sumTotal"></dd></div>
      </dl>
      <button class="btn-solid wide" onclick="checkout()">Place order</button>
    </div>
  </aside>
  <div class="modal" id="modal" onclick="if(event.target===this)closeModal()"><div class="modal-card" id="modalBody"></div></div>
  <div class="toast" id="toast" role="status"></div>`);
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-add]");
  if (b) addToCart(b.dataset.add);
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeCart(); closeModal(); } });

/* =========================================================
   PAGE: index.html
========================================================= */
async function initHome() {
  const foods = DB.foods();
  $("#statDishes").textContent = foods.length;
  $("#statCuisines").textContent = Object.keys(CUISINES).length;
  $("#statRating").textContent = (foods.reduce((s, d) => s + Number(d.rating), 0) / (foods.length || 1)).toFixed(1) + " ★";

  const shots = [["Biryani", "Chicken Biryani", "Indian"], ["Ramen", "Spicy Ramen", "Japanese"], ["Pizza Margherita", "Margherita Pizza", "Italian"]];
  $("#collage").innerHTML = shots.map(([w, label, c]) =>
    `<a class="shot imgbox" href="menu.html?cuisine=${c}">${pic({ name: label, cuisine: c, wiki: w })}<span class="shot-label">${label}</span></a>`).join("");

  $("#heroChips").innerHTML = ["Biryani", "Pizza", "Ramen", "Tacos", "Dosa"]
    .map(c => `<a href="menu.html?q=${c}">${c}</a>`).join("");

  $("#cuisineGrid").innerHTML = Object.entries(CUISINES).map(([name, c]) => `
    <a class="tile imgbox" href="menu.html?cuisine=${name}">
      ${pic({ name, cuisine: name, wiki: c.wiki })}
      <div class="tile-text"><span class="flag">${c.emoji}</span><h3>${name}</h3><p>${c.line}</p></div>
    </a>`).join("");

  $("#trendingGrid").innerHTML = foods.filter(d => d.badge).sort((a, b) => b.rating - a.rating).slice(0, 6).map(dishCard).join("");
  $("#comboGrid").innerHTML = COMBOS.map(comboCard).join("");
  hydrateImages();

  // recommendations: your last order -> last cuisine you browsed -> top rated
  let lastOrderCuisine = "";
  if (ME) {
    const mine = await fetchOrders(false);
    if (mine.length && mine[0].items.length) lastOrderCuisine = mine[0].items[0].cuisine;
  }
  const last = store.get("ff_last", "");
  const inCart = Object.keys(getCart());
  let pool, why;
  if (lastOrderCuisine)  { pool = foods.filter(d => d.cuisine === lastOrderCuisine); why = `Because you ordered ${lastOrderCuisine} food recently`; }
  else if (last)         { pool = foods.filter(d => d.cuisine === last); why = `Because you were browsing ${last} dishes`; }
  else                   { pool = foods; why = "Top-rated picks to get you started"; }
  const picks = pool.filter(d => !inCart.includes(d.id)).sort((a, b) => b.rating - a.rating).slice(0, 4);
  $("#recWhy").textContent = why;
  $("#recGrid").innerHTML = picks.map(dishCard).join("");
  hydrateImages($("#recGrid"));
}

/* =========================================================
   PAGE: menu.html  (browse + filter by cuisine and category)
========================================================= */
function initMenu() {
  const params = new URLSearchParams(location.search);
  const state = {
    cuisine: CUISINES[params.get("cuisine")] ? params.get("cuisine") : "All",
    category: CATEGORIES.includes(params.get("category")) ? params.get("category") : "All",
    q: params.get("q") || "",
    veg: false,
    sort: "popular"
  };
  if (state.cuisine !== "All") store.set("ff_last", state.cuisine);
  $("#q").value = state.q;

  function drawFilters() {
    $("#tabs").innerHTML = ["All", ...Object.keys(CUISINES)].map(n =>
      `<button class="tab ${state.cuisine === n ? "active" : ""}" data-cuisine="${n}">${n === "All" ? "🍽️" : CUISINES[n].emoji} ${n}</button>`).join("");
    $("#cats").innerHTML = ["All", ...CATEGORIES].map(n =>
      `<button class="chip ${state.category === n ? "active" : ""}" data-category="${n}">${n === "All" ? "All categories" : n}</button>`).join("");
  }

  function drawHero() {
    const c = CUISINES[state.cuisine];
    $("#menuTitle").textContent = c ? state.cuisine + " cuisine" : "Full menu";
    $("#menuBlurb").textContent = c ? c.blurb : "Every dish from all six cuisines, in one place.";
    $("#menuHeroImg").innerHTML = pic({ name: state.cuisine, cuisine: state.cuisine, wiki: c ? c.wiki : "Cuisine" });
    document.title = (c ? state.cuisine : "Menu") + " | FoodFusion";
    hydrateImages($("#menuHeroImg"));
  }

  function draw() {
    let list = DB.foods().filter(d =>
      (state.cuisine === "All" || d.cuisine === state.cuisine) &&
      (state.category === "All" || d.category === state.category) &&
      (!state.veg || d.veg) &&
      (d.name + " " + d.desc + " " + d.cuisine + " " + d.category).toLowerCase().includes(state.q.toLowerCase())
    );
    if (state.sort === "low")  list.sort((a, b) => a.price - b.price);
    else if (state.sort === "high") list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => b.rating - a.rating);

    $("#count").textContent = `${list.length} dish${list.length === 1 ? "" : "es"}`;
    $("#grid").innerHTML = list.map(dishCard).join("");
    $("#empty").hidden = list.length > 0;
    hydrateImages($("#grid"));
  }

  function url() {
    const p = new URLSearchParams();
    if (state.cuisine !== "All") p.set("cuisine", state.cuisine);
    if (state.category !== "All") p.set("category", state.category);
    history.replaceState(null, "", "menu.html" + (p.toString() ? "?" + p : ""));
  }

  $("#tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-cuisine]"); if (!t) return;
    state.cuisine = t.dataset.cuisine;
    if (state.cuisine !== "All") store.set("ff_last", state.cuisine);
    url(); drawFilters(); drawHero(); draw();
  });
  $("#cats").addEventListener("click", e => {
    const t = e.target.closest("[data-category]"); if (!t) return;
    state.category = t.dataset.category;
    url(); drawFilters(); draw();
  });
  $("#q").addEventListener("input", e => { state.q = e.target.value; draw(); });
  $("#vegOnly").addEventListener("change", e => { state.veg = e.target.checked; draw(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; draw(); });

  drawFilters(); drawHero(); draw();
}

/* =========================================================
   PAGE: orders.html  (customer's previous orders)
========================================================= */
async function initOrders() {
  const root = $("#ordersRoot");
  if (!ME) {
    root.innerHTML = `<div class="locked"><h2>Log in to see your orders</h2><p>Your order history is saved to your account.</p><button class="btn-solid" onclick="openLogin()">Log in</button></div>`;
    return;
  }
  root.innerHTML = `<p class="count">Loading your orders…</p>`;
  ORDERS_CACHE = await fetchOrders(false);
  if (!ORDERS_CACHE.length) {
    root.innerHTML = `<div class="locked"><h2>No orders yet</h2><p>When you place an order it will show up here.</p><a class="btn-solid" href="menu.html">Browse the menu</a></div>`;
    return;
  }
  root.innerHTML = `<div class="order-list">${ORDERS_CACHE.map(o => orderCard(o)).join("")}</div>`;
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  injectChrome();
  renderCart();
  loginUI();
  await loadSession();
  await DB.loadFoods();
  loginUI();
  renderCart();

  const page = document.body.dataset.page;
  if (page === "home")   { window.pageRefresh = initHome;   initHome(); }
  if (page === "menu")   { initMenu(); }
  if (page === "orders") { window.pageRefresh = initOrders; initOrders(); }
  if (page === "admin")  { window.pageRefresh = initAdmin;  initAdmin(); }
  hydrateImages();
});