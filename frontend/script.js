const API_URL = "http://127.0.0.1:5000";

const state = {
  users: [],
  products: [],
  orders: [],
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
 * API helper — unified loading, error parsing, and timeout
 * ============================================================ */
async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = { message: text }; }
    }

    if (!res.ok) {
      const msg =
        (body && (body.error || body.message)) ||
        `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
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
 * Button loading helper
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

/* ============================================================
 * List rendering helpers
 * ============================================================ */
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

function getDataArray(data, key) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  return [];
}

function getStatusClass(status) {
  if (status === "confirmed") return "status-confirmed";
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

/* ============================================================
 * Stats
 * ============================================================ */
function updateStats() {
  document.getElementById("statUsers").textContent = state.users.length;
  document.getElementById("statProducts").textContent = state.products.length;
  document.getElementById("statOrders").textContent = state.orders.length;
  document.getElementById("statConfirmed").textContent = state.orders.filter(
    (o) => o.status === "confirmed"
  ).length;

  document.getElementById("usersCount").textContent = state.users.length;
  document.getElementById("productsCount").textContent = state.products.length;
  document.getElementById("ordersCount").textContent = state.orders.length;
}

/* ============================================================
 * USERS
 * ============================================================ */
async function getUsers() {
  const list = document.getElementById("usersList");
  renderSkeleton(list, 2);
  try {
    const data = await api("/users");
    setApiStatus(true);
    const users = getDataArray(data, "users");
    state.users = users;
    updateStats();

    if (users.length === 0) {
      renderEmpty(list, "No users yet", "Create your first user above.");
      return;
    }

    list.innerHTML = users
      .map(
        (u) => `
        <div class="item">
          <div class="item-row">
            <div>
              <div class="item-id">User #${escapeHtml(u.id)}</div>
              <div class="item-title">${escapeHtml(u.name)}</div>
              <div class="item-meta">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    renderError(list, err.message, getUsers);
  }
}

async function createUser() {
  if (!validateFields(["userName", "userEmail"])) {
    toast("Fill in name and email.", "warning");
    return;
  }
  const name = document.getElementById("userName").value.trim();
  const email = document.getElementById("userEmail").value.trim();
  const btn = document.getElementById("createUserBtn");

  await withButtonLoading(btn, async () => {
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      document.getElementById("userName").value = "";
      document.getElementById("userEmail").value = "";
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
    const data = await api("/products");
    setApiStatus(true);
    const products = getDataArray(data, "products");
    state.products = products;
    updateStats();

    if (products.length === 0) {
      renderEmpty(list, "No products yet", "Add a product to get started.");
      return;
    }

    list.innerHTML = products
      .map(
        (p) => `
        <div class="item">
          <div class="item-row">
            <div>
              <div class="item-id">Product #${escapeHtml(p.id)}</div>
              <div class="item-title">${escapeHtml(p.name)}</div>
            </div>
          </div>
          <div class="kv-grid">
            <span class="k">Price</span><span class="v">$${escapeHtml(p.price)}</span>
            <span class="k">Stock</span><span class="v">${escapeHtml(p.stock)}</span>
          </div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    renderError(list, err.message, getProducts);
  }
}

async function createProduct() {
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
      await api("/products", {
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

/* ============================================================
 * ORDERS
 * ============================================================ */
async function getOrders() {
  const list = document.getElementById("ordersList");
  renderSkeleton(list, 2);
  try {
    const data = await api("/orders");
    setApiStatus(true);
    const orders = getDataArray(data, "orders");
    state.orders = orders;
    updateStats();

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
        <span class="k">Total</span><span class="v">$${escapeHtml(order.total_price)}</span>
      </div>
      <div class="actions">${buttons}</div>
    </div>
  `;
}

function orderActionsHtml(order) {
  if (order.status === "draft") {
    return `
      <button class="action-btn success" onclick="confirmOrder(${order.id}, this)">Confirm</button>
      <button class="action-btn warning" onclick="cancelOrder(${order.id}, this)">Cancel</button>
      <button class="action-btn muted"   onclick="getInvoice(${order.id}, this)">Invoice</button>
      <button class="action-btn danger"  onclick="deleteOrder(${order.id}, this)">Delete</button>
    `;
  }
  if (order.status === "confirmed") {
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
  if (!validateFields(["orderUserId", "orderProductId", "orderQuantity"])) {
    toast("Fill in user ID, product ID, and quantity.", "warning");
    return;
  }
  const userId = Number(document.getElementById("orderUserId").value);
  const productId = Number(document.getElementById("orderProductId").value);
  const quantity = Number(document.getElementById("orderQuantity").value);
  const btn = document.getElementById("createOrderBtn");

  await withButtonLoading(btn, async () => {
    try {
      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          product_id: productId,
          quantity,
        }),
      });
      document.getElementById("orderUserId").value = "";
      document.getElementById("orderProductId").value = "";
      document.getElementById("orderQuantity").value = "";
      toast("Order created successfully.", "success");
      getOrders();
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function confirmOrder(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      await api(`/orders/${orderId}/confirm`, { method: "PUT" });
      toast(`Order #${orderId} confirmed.`, "success");
      getOrders();
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function cancelOrder(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      await api(`/orders/${orderId}/cancel`, { method: "PUT" });
      toast(`Order #${orderId} cancelled.`, "warning");
      getOrders();
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function deleteOrder(orderId, btn) {
  if (!confirm(`Delete order #${orderId}? This cannot be undone.`)) return;
  await withButtonLoading(btn, async () => {
    try {
      await api(`/orders/${orderId}`, { method: "DELETE" });
      toast(`Order #${orderId} deleted.`, "success");
      getOrders();
      getProducts();
    } catch (err) {
      toast(err.message, "error");
    }
  })();
}

async function getInvoice(orderId, btn) {
  await withButtonLoading(btn, async () => {
    try {
      const invoice = await api(`/orders/${orderId}/invoice`);
      openInvoiceModal(orderId, invoice);
    } catch (err) {
      toast(err.message, "error");
    }
  })();
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
  const unitPrice = product.unit_price ?? "";
  const total = data.total ?? data.total_price ?? "";

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
          <div class="invoice-sub">${escapeHtml(data.quantity)} × $${escapeHtml(unitPrice)}</div>
        </div>
        <div class="invoice-item-amount">$${escapeHtml(
          unitPrice && data.quantity ? unitPrice * data.quantity : total
        )}</div>
      </div>
    </div>

    <div class="invoice-total">
      <span>Total</span>
      <span>$${escapeHtml(total)}</span>
    </div>
  `;

  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
 * ============================================================ */
async function refreshAll() {
  setApiStatus(null);
  await Promise.all([getUsers(), getProducts(), getOrders()]);
}

refreshAll();
