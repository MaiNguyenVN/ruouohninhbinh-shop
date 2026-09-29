const CART_KEY = 'ruouohninhbinh-cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = getCart().reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  document.querySelectorAll('#cart-count, #cart-count-mobile').forEach((el) => {
    el.textContent = String(count);
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

async function fetchProducts() {
  const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Không thể tải sản phẩm');
  const data = await response.json();
  return Array.isArray(data.products) ? data.products : [];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function addToCart(productId) {
  const cart = getCart();
  const item = cart.find((entry) => Number(entry.productId) === Number(productId));
  if (item) item.quantity = (Number(item.quantity) || 0) + 1;
  else cart.push({ productId: Number(productId), quantity: 1 });
  saveCart(cart);
}

function renderProducts(products) {
  const container = document.querySelector('#products-grid');
  if (!container) return;

  if (!products.length) {
    container.innerHTML = '<p>Hiện chưa có sản phẩm.</p>';
    return;
  }

  container.innerHTML = products.map((product) => `
    <article class="product-card">
      <img src="${escapeHtml(product.image_url || '')}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='/1000029231.jpg'" />
      <div class="product-info">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-description">${escapeHtml(product.description || 'Sản phẩm đặc trưng Ninh Bình')}</p>
        <div class="product-meta">
          <span class="price">${escapeHtml(product.formatted_price || formatMoney(product.price))}</span>
          <button type="button" class="secondary-btn" data-product-id="${Number(product.id)}">Thêm vào giỏ</button>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => {
      addToCart(button.dataset.productId);
      button.textContent = 'Đã thêm ✓';
      setTimeout(() => { button.textContent = 'Thêm vào giỏ'; }, 1200);
    });
  });
}

async function renderCartPage() {
  const container = document.querySelector('#cart-items');
  const totalEl = document.querySelector('#cart-total');
  if (!container || !totalEl) return;

  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = '<div class="empty-cart">Giỏ hàng đang trống. Hãy chọn một sản phẩm thật ngon nhé.</div>';
    totalEl.textContent = formatMoney(0);
    return;
  }

  try {
    const products = await fetchProducts();
    const productMap = new Map(products.map((product) => [Number(product.id), product]));
    let total = 0;

    container.innerHTML = cart.map((item) => {
      const product = productMap.get(Number(item.productId));
      if (!product) return '';
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const itemTotal = Number(product.price) * quantity;
      total += itemTotal;

      return `
        <div class="cart-item">
          <img src="${escapeHtml(product.image_url || '')}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='/1000029231.jpg'" />
          <div class="item-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p class="item-price">${escapeHtml(product.formatted_price || formatMoney(product.price))}</p>
            <div class="quantity-controls">
              <button class="qty-btn" data-action="decrease" data-product-id="${product.id}" aria-label="Giảm số lượng">−</button>
              <span>${quantity}</span>
              <button class="qty-btn" data-action="increase" data-product-id="${product.id}" aria-label="Tăng số lượng">+</button>
            </div>
          </div>
          <div class="item-actions">
            <strong>${formatMoney(itemTotal)}</strong>
            <button class="secondary-btn" data-action="remove" data-product-id="${product.id}">Xóa</button>
          </div>
        </div>
      `;
    }).join('');

    totalEl.textContent = formatMoney(total);

    container.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.productId);
        const updated = getCart();
        const item = updated.find((entry) => Number(entry.productId) === id);
        if (!item) return;

        if (button.dataset.action === 'remove') item.quantity = 0;
        else item.quantity += button.dataset.action === 'increase' ? 1 : -1;

        saveCart(updated.filter((entry) => Number(entry.quantity) > 0));
        renderCartPage();
      });
    });
  } catch {
    container.innerHTML = '<div class="empty-cart">Không thể tải giỏ hàng. Vui lòng thử lại.</div>';
    totalEl.textContent = formatMoney(0);
  }
}

async function submitDirectOrder() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const cart = getCart();

  if (!cart.length) {
    window.alert('Giỏ hàng đang trống. Vui lòng thêm sản phẩm.');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Đang gửi đơn hàng...';
  }

  try {
    const customer = Object.fromEntries(new FormData(form).entries());
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, cart }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Đã có lỗi xảy ra khi gửi đơn hàng.');

    localStorage.removeItem(CART_KEY);
    window.location.href = `/order-detail.html?order=${encodeURIComponent(result.order_id)}`;
  } catch (error) {
    window.alert(error.message);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Hoàn tất đơn hàng';
    }
  }
}

function setupCheckout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitDirectOrder();
  });
}

async function renderOrderDetailPage() {
  const orderId = new URLSearchParams(window.location.search).get('order');
  if (!orderId) {
    const target = document.querySelector('#order-detail-root');
    if (target) target.innerHTML = '<p class="error-msg">Không tìm thấy mã đơn hàng.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/orders/${orderId}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể tải đơn hàng');

    const { order, items } = result;
    const nameEl = document.querySelector('#customer-name');
    const emailEl = document.querySelector('#customer-email');
    const phoneEl = document.querySelector('#customer-phone');
    const addressEl = document.querySelector('#customer-address');
    const totalEl = document.querySelector('#order-total');
    const orderIdEl = document.querySelector('#order-id');
    const itemsList = document.querySelector('#order-items');
    const totalSummaryEl = document.querySelector('#order-total-summary');

    if (nameEl) nameEl.textContent = order.customer_name;
    if (emailEl) emailEl.textContent = order.customer_email;
    if (phoneEl) phoneEl.textContent = order.customer_phone;
    if (addressEl) addressEl.textContent = order.customer_address;
    if (totalEl) totalEl.textContent = formatMoney(order.total_amount);
    if (orderIdEl) orderIdEl.textContent = order.order_uuid;
    if (totalSummaryEl) totalSummaryEl.textContent = formatMoney(order.total_amount);

    if (itemsList) {
      itemsList.innerHTML = items.map((item) => `
        <div class="order-item-row">
          <div>
            <h4>${escapeHtml(item.product_name)}</h4>
            <p>Số lượng: ${item.quantity}</p>
          </div>
          <strong>${formatMoney(Number(item.price) * Number(item.quantity))}</strong>
        </div>
      `).join('');
    }

    const completeButton = document.querySelector('#complete-order-btn');
    if (completeButton) {
      completeButton.addEventListener('click', async () => {
        completeButton.disabled = true;
        completeButton.textContent = 'Đang gửi thông báo...';

        try {
          const notifyResponse = await fetch(`/api/orders/${orderId}/complete`, { method: 'POST' });
          const notifyResult = await notifyResponse.json();
          if (!notifyResponse.ok) throw new Error(notifyResult.error || 'Không thể gửi thông báo');

          if (notifyResult.notification?.email) {
            window.open(notifyResult.notification.email, '_blank', 'noopener');
          }
          if (notifyResult.notification?.zalo) {
            window.open(notifyResult.notification.zalo, '_blank', 'noopener');
          }

          window.alert('✓ Đơn hàng đã được ghi nhận!\n\nEmail/Zalo xác nhận đã được mở. Vui lòng kiểm tra và gửi đi.\n\nChúng tôi sẽ liên hệ bạn sớm.');
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 1500);
        } catch (error) {
          window.alert('❌ ' + error.message);
          completeButton.disabled = false;
          completeButton.textContent = 'Gửi email / Zalo';
        }
      });
    }
  } catch (error) {
    const target = document.querySelector('#order-detail-root');
    if (target) target.innerHTML = `<p class="error-msg">❌ ${escapeHtml(error.message)}</p>`;
  }
}

function setupSuccessPage() {
  const orderElement = document.querySelector('#order-id');
  if (!orderElement) return;
  orderElement.textContent = new URLSearchParams(window.location.search).get('order') || 'N/A';
  localStorage.removeItem(CART_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();

  if (document.querySelector('#products-grid')) {
    fetchProducts()
      .then(renderProducts)
      .catch(() => {
        const container = document.querySelector('#products-grid');
        if (container) container.innerHTML = '<p>Không thể tải sản phẩm. Vui lòng thử lại.</p>';
      });
  }

  if (document.querySelector('#cart-items')) {
    renderCartPage();
    setupCheckout();
  }

  if (document.querySelector('#order-detail-root')) {
    renderOrderDetailPage();
  }

  setupSuccessPage();
});
