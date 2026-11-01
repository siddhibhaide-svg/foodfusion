/* =========================================================
   FOODFUSION  –  admin page (Supabase version)
   Admin can: add food · edit food · delete food · view orders
   Only accounts with role = 'admin' in the profiles table can
   change data. The database itself enforces this (RLS).
========================================================= */

let adminTab = "foods";
let foodSearch = "";
let orderFilter = "All";
let uploadedBlob = null;     // photo chosen in the add/edit form
let ADMIN_ORDERS = [];

async function initAdmin() {
  const root = $("#adminRoot");
  if (!ME) {
    root.innerHTML = `
      <div class="locked">
        <h2>Admin area</h2>
        <p>Log in with the admin account to manage food items and see all orders.</p>
        <button class="btn-solid" onclick="openLogin()">Log in</button>
      </div>`;
    return;
  }
  if (!Auth.isAdmin()) {
    root.innerHTML = `
      <div class="locked">
        <h2>Admins only</h2>
        <p>You are logged in as <b>${esc(ME.email)}</b>, which is not an admin account.</p>
        <a class="btn-solid" href="index.html">Back to home</a>
      </div>`;
    return;
  }

  root.innerHTML = `<p class="count">Loading dashboard…</p>`;
  await DB.loadFoods();
  ADMIN_ORDERS = await fetchOrders(true);

  const foods = DB.foods();
  const revenue = ADMIN_ORDERS.filter(o => o.status !== "Cancelled").reduce((s, o) => s + o.total, 0);
  const open = ADMIN_ORDERS.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length;

  root.innerHTML = `
    <div class="stats">
      <div><strong>${foods.length}</strong><span>Food items</span></div>
      <div><strong>${ADMIN_ORDERS.length}</strong><span>Orders</span></div>
      <div><strong>${open}</strong><span>Open orders</span></div>
      <div><strong>${rupee(revenue)}</strong><span>Revenue</span></div>
    </div>
    <div class="tabs admin-tabs">
      <button class="tab ${adminTab === "foods" ? "active" : ""}" onclick="setAdminTab('foods')">Manage food</button>
      <button class="tab ${adminTab === "orders" ? "active" : ""}" onclick="setAdminTab('orders')">View orders (${ADMIN_ORDERS.length})</button>
    </div>
    <div id="adminBody"></div>`;
  adminTab === "foods" ? drawFoods() : drawOrders();
}

function setAdminTab(t) { adminTab = t; initAdmin(); }

/* ---------- foods table ---------- */
function drawFoods() {
  $("#adminBody").innerHTML = `
    <div class="toolbar">
      <input class="text-input" id="foodSearch" placeholder="Search food" value="${esc(foodSearch)}" oninput="foodSearch=this.value;drawFoodRows()">
      <button class="btn-solid" onclick="foodForm()">+ Add food</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Photo</th><th>Name</th><th>Cuisine</th><th>Category</th><th>Price</th><th>Type</th><th></th></tr></thead>
        <tbody id="foodRows"></tbody>
      </table>
    </div>`;
  drawFoodRows();
}

function drawFoodRows() {
  const q = foodSearch.toLowerCase();
  const list = DB.foods().filter(f => (f.name + f.cuisine + f.category).toLowerCase().includes(q));
  $("#foodRows").innerHTML = list.length ? list.map(f => `
    <tr>
      <td><div class="t-thumb imgbox">${pic(f)}</div></td>
      <td><b>${esc(f.name)}</b></td>
      <td>${esc(f.cuisine)}</td>
      <td>${esc(f.category)}</td>
      <td>${rupee(f.price)}</td>
      <td><span class="veg-inline ${f.veg ? "is-veg" : "is-non"}"></span> ${f.veg ? "Veg" : "Non-veg"}</td>
      <td class="row-actions">
        <button class="btn-ghost" onclick="foodForm('${f.id}')">Edit</button>
        <button class="btn-ghost danger" onclick="deleteFood('${f.id}')">Delete</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="7" class="muted-cell">No food items match.</td></tr>`;
  hydrateImages($("#foodRows"));
}

/* ---------- add / edit form ---------- */
function foodForm(id) {
  const f = id ? DB.foods().find(x => x.id === id) : null;
  const v = f || { name: "", cuisine: "Indian", category: "Main course", price: "", rating: 4.0, veg: true, desc: "", badge: "", img: "" };
  uploadedBlob = null;
  const opt = (arr, sel) => arr.map(x => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("");

  openModal(`
    <form class="form" id="foodFormEl" onsubmit="saveFood(event, '${id || ""}')">
      <h2>${f ? "Edit food" : "Add food"}</h2>
      <label>Name<input class="text-input" name="name" required value="${esc(v.name)}"></label>
      <div class="row2">
        <label>Cuisine<select class="text-input" name="cuisine">${opt(Object.keys(CUISINES), v.cuisine)}</select></label>
        <label>Category<select class="text-input" name="category">${opt(CATEGORIES, v.category)}</select></label>
      </div>
      <div class="row2">
        <label>Price (₹)<input class="text-input" type="number" name="price" min="1" required value="${esc(v.price)}"></label>
        <label>Rating (1–5)<input class="text-input" type="number" name="rating" min="1" max="5" step="0.1" value="${esc(v.rating)}"></label>
      </div>
      <label>Description<textarea class="text-input" name="desc" rows="2" required>${esc(v.desc)}</textarea></label>
      <label class="check"><input type="checkbox" name="veg" ${v.veg ? "checked" : ""}> Vegetarian</label>

      <label>Photo (upload)<input type="file" id="foodFile" accept="image/*" onchange="pickPhoto(this)"></label>
      <label>…or photo link<input class="text-input" name="img" placeholder="https://…" value="${esc(v.img)}"></label>
      <div class="preview imgbox" id="foodPreview">${pic(f || { name: v.name || "Preview", cuisine: v.cuisine })}</div>
      <p class="hint">Leave the photo empty and FoodFusion will look up a photo using the dish name. Uploads are stored in Supabase Storage.</p>

      <div class="modal-actions">
        <button type="button" class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-solid">${f ? "Save changes" : "Add food"}</button>
      </div>
    </form>`, true);
  hydrateImages($("#foodPreview"));
}

function resizeToBlob(file, max = 700) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85);
    };
    im.onerror = reject;
    im.src = url;
  });
}

async function pickPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    uploadedBlob = await resizeToBlob(file);
    $("#foodPreview").innerHTML = `<img class="ok" src="${URL.createObjectURL(uploadedBlob)}" alt="Preview">`;
  } catch { toast("Could not read that image"); }
}

async function saveFood(e, id) {
  e.preventDefault();
  const btn = e.target.querySelector("button.btn-solid");
  const fd = new FormData($("#foodFormEl"));
  const old = id ? DB.foods().find(x => x.id === id) : null;
  btn.disabled = true;

  let img = (fd.get("img") || "").trim();
  if (uploadedBlob) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const up = await sb.storage.from("food-images").upload(path, uploadedBlob, { contentType: "image/jpeg" });
    if (up.error) { btn.disabled = false; toast("Photo upload failed: " + up.error.message); return; }
    img = sb.storage.from("food-images").getPublicUrl(path).data.publicUrl;
  }

  const name = fd.get("name").trim();
  const row = {
    name,
    cuisine: fd.get("cuisine"),
    category: fd.get("category"),
    price: Math.round(Number(fd.get("price"))),
    rating: Math.min(5, Math.max(1, Number(fd.get("rating")) || 4)),
    veg: fd.get("veg") === "on",
    description: fd.get("desc").trim(),
    wiki: old && old.name === name ? old.wiki : name,
    img: img || null
  };
  const res = old
    ? await sb.from("foods").update(row).eq("id", old.id)
    : await sb.from("foods").insert(row);
  if (res.error) { btn.disabled = false; toast("Could not save: " + res.error.message); return; }

  closeModal();
  toast(old ? "Food updated" : "Food added");
  initAdmin();
}

async function deleteFood(id) {
  const f = DB.foods().find(x => x.id === id);
  if (!f || !confirm(`Delete "${f.name}" from the menu?`)) return;
  const { error } = await sb.from("foods").delete().eq("id", id);
  if (error) { toast("Could not delete: " + error.message); return; }
  toast("Food deleted");
  initAdmin();
}

/* ---------- orders ---------- */
function drawOrders() {
  const list = orderFilter === "All" ? ADMIN_ORDERS : ADMIN_ORDERS.filter(o => o.status === orderFilter);
  $("#adminBody").innerHTML = `
    <div class="toolbar">
      <label class="status-edit">Show
        <select class="text-input" onchange="orderFilter=this.value;drawOrders()">
          ${["All", ...STATUSES].map(s => `<option ${s === orderFilter ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </label>
    </div>
    ${list.length
      ? `<div class="order-list">${list.map(o => orderCard(o, true)).join("")}</div>`
      : `<div class="locked"><h2>No orders here</h2><p>Orders placed by customers will appear in this section.</p></div>`}`;
}