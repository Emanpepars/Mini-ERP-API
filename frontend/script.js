/* ============================================================
 *  Mini ERP — Frontend (vanilla JS, hash-based router)
 * ============================================================ */

const API_BASE_URL = "http://127.0.0.1:5000";

const STORAGE_TOKEN = "miniErp.token";
const STORAGE_USER = "miniErp.user";

const state = {
  token: null,
  user: null,
  currentRoute: null,
};


/* ============================================================
 * Route table
 *   path          → { title, subtitle, render(), adminOnly }
 * Customer "home" = products. Admin "home" = dashboard.
 * ============================================================ */
const ROUTES = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your store",
    adminOnly: true,
    render: () => getDashboard(),
  },
  products: {
    title: "Products",
    subtitle: "Catalog and inventory",
    render: () => getProducts(),
  },
  orders: {
    title: "Orders",
    subtitle: "Track and manage orders",
    render: () => getOrders(),
  },
  users: {
    title: "Users",
    subtitle: "User management",
    adminOnly: true,
    render: () => getUsers(),
  },
  reports: {
    title: "Reports",
    subtitle: "Sales analytics",
    adminOnly: true,
    render: () => getReports(),
  },
};

const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
  products: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  orders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><polyline points="9 7 12 4 15 7"/><line x1="12" y1="4" x2="12" y2="14"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
};


/* ============================================================
 * Toast notifications
 * ============================================================ */
function toast(message, type, title) {
  const container = document.getElementById("toastContainer");
  const t = type || "info";
  const icons = { success: "✓", error: "!", warning: "!", info: "i" };
  const titles = {
    success: title || "Success",
    error: title || "Error",
    warning: title || "Heads up",
    info: title || "Info",
  };
  const el = document.createElement("div");
  el.className = `toast ${t}`;
  el.innerHTML = `
    <div class="icon">${icons[t]}</div>
    <div class="body">
      <strong>${titles[t]}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="close" aria-label="Dismiss">×</button>
  `;
  const dismiss = () => {
    el.classList.add("exiting");
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector(".close").addEventListener("click", dismiss);
  container.appendChild(el);
  setTimeout(dismiss, 4200);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


/* ============================================================
 * Auth helper — single fetch wrapper
 *   - Always sends Content-Type: application/json
 *   - Always sends Authorization: Bearer <token> when logged in
 *   - Auto-logs out on 401 (expired/invalid token)
 * ============================================================ */
async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = { message: text }; }
    }

    if (!res.ok) {
      const msg = (body && (body.error || body.message)) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;

      if (res.status === 401 && state.token) {
        toast("Session expired. Please log in again.", "warning");
        doLogout();
      }
      throw err;
    }
    setApiStatus(true);
    return body;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Check that the API is running.");
    }
    if (err instanceof TypeError) {
      setApiStatus(false);
      throw new Error("Cannot reach API. Is the server running on port 5000?");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function setApiStatus(online) {
  const dot = document.querySelector(".status-dot");
  const text = document.getElementById("apiStatusText");
  if (!dot || !text) return;
  dot.classList.remove("online", "offline");
  if (online === true) {
    dot.classList.add("online");
    text.textContent = "API online";
  } else if (online === false) {
    dot.classList.add("offline");
    text.textContent = "API offline";
  } else {
    text.textContent = "Connecting…";
  }
}


/* ============================================================
 * Login / Logout / Session
 * ============================================================ */
function prefillLogin(which) {
  const email = which === "admin" ? "admin@example.com" : "customer@example.com";
  const password = which === "admin" ? "admin123" : "customer123";
  document.getElementById("loginEmail").value = email;
  document.getElementById("loginPassword").value = password;
  hideLoginError();
}

function showLoginError(message) {
  const el = document.getElementById("loginError");
  el.textContent = message;
  el.hidden = false;
}
function hideLoginError() {
  const el = document.getElementById("loginError");
  el.hidden = true;
  el.textContent = "";
}

async function doLogin() {
  hideLoginError();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showLoginError("Please enter both email and password.");
    return;
  }

  const btn = document.getElementById("loginBtn");
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(data.token, data.user);
    toast(`Welcome, ${data.user.name}.`, "success", "Signed in");
    enterApp();
  } catch (err) {
    showLoginError(err.message || "Login failed.");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(STORAGE_TOKEN, token);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

function loadSession() {
  const token = localStorage.getItem(STORAGE_TOKEN);
  const userJson = localStorage.getItem(STORAGE_USER);
  if (!token || !userJson) return false;
  try {
    state.token = token;
    state.user = JSON.parse(userJson);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.currentRoute = null;
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_USER);
}

function doLogout() {
  clearSession();
  // Clear hash so the next sign-in lands on home
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  showLoginScreen();
  toast("Signed out.", "info");
}

function isAdmin() {
  return state.user && state.user.role === "admin";
}

function homeRoute() {
  // Admins land on dashboard; customers land on products
  return isAdmin() ? "products" : "products";
  // (kept "products" for both — change to "dashboard" if you prefer)
}

// Use dashboard as admin home, products as customer home
function defaultHomeRoute() {
  return isAdmin() ? "dashboard" : "products";
}


/* ============================================================
 * Screen / Router
 * ============================================================ */
function showLoginScreen() {
  document.getElementById("loginScreen").hidden = false;
  document.getElementById("appShell").hidden = true;
  document.getElementById("loginForm").reset();
  hideLoginError();
}

function enterApp() {
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("appShell").hidden = false;

  // Header user info
  document.getElementById("currentUserName").textContent = state.user.name;
  const rolePill = document.getElementById("currentUserRole");
  rolePill.textContent = state.user.role;
  rolePill.classList.remove("admin", "customer");
  rolePill.classList.add(state.user.role);

  // Avatar initial
  document.getElementById("userAvatar").textContent =
    (state.user.name || "?").trim().charAt(0).toUpperCase();

  renderSidebar();
  applyRoleVisibility();

  // Honor hash if it points to an allowed route, otherwise go home
  const hashRoute = parseRouteFromHash();
  const target = (hashRoute && isRouteAllowed(hashRoute)) ? hashRoute : defaultHomeRoute();
  navigateTo(target, { replace: true });
}

function parseRouteFromHash() {
  const m = (location.hash || "").match(/^#\/?([a-zA-Z-]+)/);
  return m ? m[1] : null;
}

function isRouteAllowed(route) {
  const def = ROUTES[route];
  if (!def) return false;
  if (def.adminOnly && !isAdmin()) return false;
  return true;
}

function navigateTo(route, opts = {}) {
  const target = `#/${route}`;
  if (opts.replace) {
    history.replaceState(null, "", target);
  } else if (location.hash !== target) {
    location.hash = target;
    return; // hashchange event will trigger renderRoute()
  }
  renderRoute();
}

function renderRoute() {
  // No session → force login
  if (!state.token) {
    showLoginScreen();
    return;
  }

  let route = parseRouteFromHash() || defaultHomeRoute();
  let def = ROUTES[route];

  // Unknown route → home
  if (!def) {
    navigateTo(defaultHomeRoute(), { replace: true });
    return;
  }

  // Admin-only guarded
  if (def.adminOnly && !isAdmin()) {
    showView("forbidden", "Access denied", "This area is admin-only");
    setActiveNav(null);
    return;
  }

  state.currentRoute = route;
  showView(route, def.title, def.subtitle);
  setActiveNav(route);
  Promise.resolve(def.render()).catch((err) => toast(err.message, "error"));
}

function showView(name, title, subtitle) {
  document.querySelectorAll(".view").forEach((el) => { el.hidden = true; });
  const target = document.getElementById(`view-${name}`);
  if (target) target.hidden = false;

  if (title) document.getElementById("viewTitle").textContent = title;
  if (subtitle !== undefined) document.getElementById("viewSubtitle").textContent = subtitle;
}

function reloadCurrentView() {
  if (state.currentRoute && ROUTES[state.currentRoute]) {
    setApiStatus(null);
    Promise.resolve(ROUTES[state.currentRoute].render()).catch((err) => toast(err.message, "error"));
  }
}

function renderSidebar() {
  const nav = document.getElementById("sidebarNav");
  const links = Object.keys(ROUTES)
    .filter((key) => !ROUTES[key].adminOnly || isAdmin())
    .map((key) => {
      const def = ROUTES[key];
      return `
        <a href="#/${key}" class="nav-link" data-route="${key}">
          <span class="nav-icon">${NAV_ICONS[key] || ""}</span>
          <span>${escapeHtml(def.title)}</span>
        </a>
      `;
    })
    .join("");
  nav.innerHTML = links;
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === route);
  });
}

function applyRoleVisibility() {
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.hidden = !isAdmin();
  });
  document.getElementById("ordersHeading").textContent = isAdmin() ? "All Orders" : "My Orders";
}


/* ============================================================
 * Generic helpers
 * ============================================================ */
function withButtonLoading(btn, fn) {
  return async (...args) => {
    if (!btn) return fn(...args);
    btn.classList.add("loading");
    btn.disabled = true;
    try {
      return await fn(...args);
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  };
}

function renderSkeleton(container, count = 3) {
  container.innerHTML = Array.from({ length: count })
    .map(() => `<div class="skeleton"></div>`)
    .join("");
}

function renderEmpty(container, title, hint) {
  container.innerHTML = `
    <div class="empty">
      <strong>${escapeHtml(title)}</strong>
      ${hint ? escapeHtml(hint) : ""}
    </div>
  `;
}

function renderError(container, message, retryFn) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "error-state";
  wrap.innerHTML = `
    <div>
      <strong>Could not load</strong>
      <span>${escapeHtml(message)}</span><br/>
      <button class="retry" type="button">Retry</button>
    </div>
  `;
  wrap.querySelector(".retry").addEventListener("click", retryFn);
  container.appendChild(wrap);
}

function getDataArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function getStatusClass(status) {
  if (status === "paid") return "status-confirmed";
  if (status === "cancelled") return "status-cancelled";
  return "status-pending";
}

function validateFields(fieldIds) {
  let firstInvalid = null;
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const empty = !el.value || (el.type === "number" && Number(el.value) <= 0);
    if (empty) {
      el.classList.add("invalid");
      if (!firstInvalid) firstInvalid = el;
      el.addEventListener("input", () => el.classList.remove("invalid"), { once: true });
    } else {
      el.classList.remove("invalid");
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}


/* ============================================================
 * USERS  (admin only)
 * ============================================================ */
async function getUsers() {
  if (!isAdmin()) return;
  const list = document.getElementById("usersList");
  renderSkeleton(list, 2);
  try {
    const data = await apiRequest("/users?page=1&limit=50");
    const users = getDataArray(data);
    document.getElementById("usersCount").textContent = users.length;

    if (users.length === 0) {
      renderEmpty(list, "No users yet", "Create your first user above.");
      return;
    }

    list.innerHTML = users.map((u) => `
      <div class="item">
        <div class="item-row">
          <div>
            <div class="item-id">User #${escapeHtml(u.id)}</div>
            <div class="item-title">${escapeHtml(u.name)}</div>
            <div class="item-meta">${escapeHtml(u.email)}</div>
          </div>
          <span class="role-pill ${escapeHtml(u.role)}">${escapeHtml(u.role)}</span>
        </div>
      </div>
    `).join("");
  } catch (err) {
    renderError(list, err.message, getUsers);
  }
}

async function createUser() {
  if (!validateFields(["userName", "userEmail", "userPassword"])) {
    toast("Fill in name, email and password.", "warning");
    return;
  }
  const name = document.getElementById("userName").value.trim();
  const email = document.getElementById("userEmail").value.trim();
  const password = document.getElementById("userPassword").value;
  const role = document.getElementById("userRole").value;
  const btn = document.getElementById("createUserBtn");

  await withButtonLoading(btn, async () => {
    try {
      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      document.getElementById("userName").value = "";
      document.getElementById("userEmail").value = "";
      document.getElementById("userPassword").value = "";
      toast(`${name} added.`, "success", "User created");
      getUsers();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}


/* ============================================================
 * PRODUCTS
 * ============================================================ */
async function getProducts() {
  const list = document.getElementById("productsList");
  renderSkeleton(list, 2);
  try {
    const data = await apiRequest("/products?page=1&limit=50");
    const products = getDataArray(data);
    document.getElementById("productsCount").textContent = products.length;

    if (products.length === 0) {
      renderEmpty(list, "No products yet",
        isAdmin() ? "Add a product to get started." : "Check back soon.");
      return;
    }

    list.innerHTML = products.map((p) => `
      <div class="item">
        <div class="item-row">
          <div>
            <div class="item-id">Product #${escapeHtml(p.id)}</div>
            <div class="item-title">${escapeHtml(p.name)}</div>
          </div>
        </div>
        <div class="kv-grid">
          <span class="k">Price</span><span class="v">$${formatMoney(p.price)}</span>
          <span class="k">Stock</span><span class="v">${escapeHtml(p.stock)}</span>
        </div>
        ${isAdmin() ? `
          <div class="actions">
            <button class="action-btn danger" onclick="deleteProduct(${p.id}, this)">Delete</button>
          </div>
        ` : ""}
      </div>
    `).join("");
  } catch (err) {
    renderError(list, err.message, getProducts);
  }
}

async function createProduct() {
  if (!isAdmin()) {
    toast("Only admins can create products.", "warning");
    return;
  }
  if (!validateFields(["productName", "productPrice", "productStock"])) {
    toast("Fill in product name, price, and stock.", "warning");
    return;
  }
  const name = document.getElementById("productName").value.trim();
  const price = Number(document.getElementById("productPrice").value);
  const stock = Number(document.getElementById("productStock").value);
  const btn = document.getElementById("createProductBtn");

  await withButtonLoading(btn, async () => {
    try {
      await apiRequest("/products", {
        method: "POST",
        body: JSON.stringify({ name, price, stock }),
      });
      document.getElementById("productName").value = "";
      document.getElementById("productPrice").value = "";
      document.getElementById("productStock").value = "";
      toast(`${name} added to inventory.`, "success", "Product created");
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function deleteProduct(productId, btn) {
  if (!confirm(`Delete product #${productId}?`)) return;
  await withButtonLoading(btn, async () => {
    try {
      await apiRequest(`/products/${productId}`, { method: "DELETE" });
      toast(`Product #${productId} deleted.`, "success");
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}


/* ============================================================
 * ORDERS
 * ============================================================ */
async function getOrders() {
  const list = document.getElementById("ordersList");
  renderSkeleton(list, 2);
  try {
    const data = await apiRequest("/orders?page=1&limit=50");
    const orders = getDataArray(data);
    document.getElementById("ordersCount").textContent = orders.length;

    if (orders.length === 0) {
      renderEmpty(list, "No orders yet", "Create an order to see it here.");
      return;
    }

    list.innerHTML = orders.map(renderOrderCard).join("");
  } catch (err) {
    renderError(list, err.message, getOrders);
  }
}

function renderOrderCard(order) {
  const buttons = orderActionsHtml(order);
  return `
    <div class="item">
      <div class="item-row">
        <div>
          <div class="item-id">Order #${escapeHtml(order.id)}</div>
          <div class="item-title">${escapeHtml(order.product)}</div>
          <div class="item-meta">For <strong>${escapeHtml(order.user)}</strong></div>
        </div>
        <span class="status ${getStatusClass(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <div class="kv-grid">
        <span class="k">Quantity</span><span class="v">${escapeHtml(order.quantity)}</span>
        <span class="k">Total</span><span class="v">$${formatMoney(order.total_price)}</span>
      </div>
      <div class="actions">${buttons}</div>
    </div>
  `;
}

function orderActionsHtml(order) {
  if (order.status === "pending") {
    return `
      <button class="action-btn success" onclick="confirmOrder(${order.id}, this)">Mark Paid</button>
      <button class="action-btn warning" onclick="cancelOrder(${order.id}, this)">Cancel</button>
      <button class="action-btn muted"   onclick="getInvoice(${order.id}, this)">Invoice</button>
      <button class="action-btn danger"  onclick="deleteOrder(${order.id}, this)">Delete</button>
    `;
  }
  if (order.status === "paid") {
    return `
      <button class="action-btn warning" onclick="cancelOrder(${order.id}, this)">Cancel</button>
      <button class="action-btn muted"   onclick="getInvoice(${order.id}, this)">Invoice</button>
      <button class="action-btn danger"  onclick="deleteOrder(${order.id}, this)">Delete</button>
    `;
  }
  return `
    <button class="action-btn danger" onclick="deleteOrder(${order.id}, this)">Delete</button>
  `;
}

async function createOrder() {
  if (!validateFields(["orderProductId", "orderQuantity"])) {
    toast("Fill in product ID and quantity.", "warning");
    return;
  }
  const productId = Number(document.getElementById("orderProductId").value);
  const quantity = Number(document.getElementById("orderQuantity").value);

  const body = { product_id: productId, quantity };
  if (isAdmin()) {
    const userIdField = document.getElementById("orderUserId");
    if (userIdField && userIdField.value) {
      body.user_id = Number(userIdField.value);
    }
  }

  const btn = document.getElementById("createOrderBtn");
  await withButtonLoading(btn, async () => {
    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      document.getElementById("orderProductId").value = "";
      document.getElementById("orderQuantity").value = "";
      const userIdField = document.getElementById("orderUserId");
      if (userIdField) userIdField.value = "";
      toast("Order created successfully.", "success");
      getOrders();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function confirmOrder(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      await apiRequest(`/orders/${orderId}/confirm`, { method: "PUT" });
      toast(`Order #${orderId} marked as paid.`, "success");
      getOrders();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function cancelOrder(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      await apiRequest(`/orders/${orderId}/cancel`, { method: "PUT" });
      toast(`Order #${orderId} cancelled.`, "warning");
      getOrders();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function deleteOrder(orderId, btn) {
  if (!confirm(`Delete order #${orderId}? This cannot be undone.`)) return;
  await withButtonLoading(btn, async () => {
    try {
      await apiRequest(`/orders/${orderId}`, { method: "DELETE" });
      toast(`Order #${orderId} deleted.`, "success");
      getOrders();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function getInvoice(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      const invoice = await apiRequest(`/orders/${orderId}/invoice`);
      openInvoiceModal(orderId, invoice);
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}


/* ============================================================
 * DASHBOARD  (admin only)
 * ============================================================ */
async function getDashboard() {
  if (!isAdmin()) return;
  const root = document.getElementById("dashboardContent");
  renderSkeleton(root, 2);
  try {
    const data = await apiRequest("/dashboard");

    document.getElementById("statUsers").textContent = data.total_users;
    document.getElementById("statProducts").textContent = data.total_products;
    document.getElementById("statOrders").textContent = data.total_orders;
    document.getElementById("statRevenue").textContent = `$${formatMoney(data.total_revenue)}`;

    const lowStock = data.low_stock_products || [];
    const recent = data.recent_orders || [];

    root.innerHTML = `
      <div class="dash-grid">
        <div>
          <div class="dash-section-title">Low stock (≤ ${escapeHtml(data.low_stock_threshold)})</div>
          ${lowStock.length === 0
            ? `<div class="empty"><strong>All stocked</strong>No low-stock products.</div>`
            : lowStock.map((p) => `
              <div class="item">
                <div class="item-row">
                  <div>
                    <div class="item-title">${escapeHtml(p.name)}</div>
                    <div class="item-meta">Product #${escapeHtml(p.id)}</div>
                  </div>
                  <span class="status ${p.stock === 0 ? "status-cancelled" : "status-pending"}">
                    ${p.stock === 0 ? "out of stock" : `${escapeHtml(p.stock)} left`}
                  </span>
                </div>
              </div>
            `).join("")}
        </div>
        <div>
          <div class="dash-section-title">Recent orders</div>
          ${recent.length === 0
            ? `<div class="empty"><strong>No orders yet</strong></div>`
            : recent.map((o) => `
              <div class="item">
                <div class="item-row">
                  <div>
                    <div class="item-title">${escapeHtml(o.product)} × ${escapeHtml(o.quantity)}</div>
                    <div class="item-meta">${escapeHtml(o.user)} · ${escapeHtml(formatDate(o.created_at))}</div>
                  </div>
                  <span class="status ${getStatusClass(o.status)}">${escapeHtml(o.status)}</span>
                </div>
                <div class="kv-grid">
                  <span class="k">Total</span><span class="v">$${formatMoney(o.total_price)}</span>
                </div>
              </div>
            `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    renderError(root, err.message, getDashboard);
  }
}


/* ============================================================
 * REPORTS  (admin only)
 * ============================================================ */
async function getReports() {
  if (!isAdmin()) return;
  const root = document.getElementById("reportsContent");
  renderSkeleton(root, 2);
  try {
    const [totals, byProduct, byCustomer, monthly] = await Promise.all([
      apiRequest("/reports/sales"),
      apiRequest("/reports/sales/by-product"),
      apiRequest("/reports/sales/by-customer"),
      apiRequest("/reports/sales/monthly"),
    ]);

    root.innerHTML = `
      <div class="dash-section-title">Total sales (paid orders)</div>
      <div class="kv-grid">
        <span class="k">Total revenue</span><span class="v">$${formatMoney(totals.total_sales)}</span>
        <span class="k">Units sold</span><span class="v">${escapeHtml(totals.total_units_sold)}</span>
        <span class="k">Orders</span><span class="v">${escapeHtml(totals.total_orders)}</span>
      </div>

      <div class="dash-section-title">By product</div>
      ${renderReportTable(byProduct, [
        { key: "product", label: "Product" },
        { key: "units_sold", label: "Units" },
        { key: "revenue", label: "Revenue", money: true },
      ])}

      <div class="dash-section-title">By customer</div>
      ${renderReportTable(byCustomer, [
        { key: "name", label: "Customer" },
        { key: "email", label: "Email" },
        { key: "orders_count", label: "Orders" },
        { key: "total_spent", label: "Spent", money: true },
      ])}

      <div class="dash-section-title">Monthly</div>
      ${renderReportTable(monthly, [
        { key: "month", label: "Month" },
        { key: "orders_count", label: "Orders" },
        { key: "revenue", label: "Revenue", money: true },
      ])}
    `;
  } catch (err) {
    renderError(root, err.message, getReports);
  }
}

function renderReportTable(rows, columns) {
  if (!rows || rows.length === 0) {
    return `<div class="empty"><strong>No data</strong></div>`;
  }
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map((r) =>
    `<tr>${columns.map((c) => {
      const v = r[c.key];
      const cell = c.money ? `$${formatMoney(v)}` : escapeHtml(v);
      return `<td>${cell}</td>`;
    }).join("")}</tr>`
  ).join("");
  return `<table class="report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}


/* ============================================================
 * Invoice modal
 * ============================================================ */
function openInvoiceModal(orderId, invoice) {
  const root = document.getElementById("modalRoot");
  const body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = `Invoice — Order #${orderId}`;

  const data = invoice || {};
  const created = data.created_at ? formatDate(data.created_at) : "";
  const customer = data.customer || {};
  const product = data.product || {};
  const unitPrice = product.unit_price ?? 0;
  const total = data.total_price ?? 0;

  body.innerHTML = `
    <div class="invoice-header">
      <div>
        <div class="invoice-num">${escapeHtml(data.invoice_number || `INV-${orderId}`)}</div>
        <div class="invoice-date">${escapeHtml(created)}</div>
      </div>
      <span class="status ${getStatusClass(data.order_status)}">${escapeHtml(data.order_status || "")}</span>
    </div>

    <div class="invoice-section">
      <div class="invoice-section-title">Billed to</div>
      <div class="invoice-name">${escapeHtml(customer.name || "—")}</div>
      <div class="invoice-sub">${escapeHtml(customer.email || "")}</div>
    </div>

    <div class="invoice-section">
      <div class="invoice-section-title">Item</div>
      <div class="invoice-item-row">
        <div>
          <div class="invoice-name">${escapeHtml(product.name || "—")}</div>
          <div class="invoice-sub">${escapeHtml(data.quantity)} × $${formatMoney(unitPrice)}</div>
        </div>
        <div class="invoice-item-amount">$${formatMoney(total)}</div>
      </div>
    </div>

    <div class="invoice-total">
      <span>Total</span>
      <span>$${formatMoney(total)}</span>
    </div>
  `;

  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const root = document.getElementById("modalRoot");
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});


/* ============================================================
 * Bootstrap
 *   - If a saved session exists → enter the app and route to home
 *   - Otherwise → show the login screen
 *   - Browser back/forward (hashchange) is honored
 * ============================================================ */
window.addEventListener("hashchange", () => {
  if (state.token) renderRoute();
});

(function init() {
  if (loadSession()) {
    enterApp();
  } else {
    showLoginScreen();
  }
})();
