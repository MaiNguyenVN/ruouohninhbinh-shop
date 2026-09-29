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
  const count = getCart().reduce((total, item) => total + Number(item.quantity || 0), 0);
  document.querySelectorAll('#cart-count').forEach((el) => {
    el.textContent = String(count);
  });
}

async function fetchProducts() {
  const response = await fetch('/api/products');
  if (!response.ok) {
    throw new Error('Không thể tải sản phẩm');
  }
  const data = await response.json();
  return data.products || [];
}

function addToCart(productId) {
  const cart = getCart();
  const existingItem = cart.find((item) => Number(item.productId) === Number(productId));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ productId: Number(productId), quantity: 1 });
  }

  saveCart(cart);
}

function renderProducts(products) {
  const container = document.querySelector('#products-grid');
  if (!container) return;

  container.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          <img src="${product.image_url}" alt="${product.name}" />
          <div class="product-info">
            <h3>${product.name}</h3>
            <p class="product-description">${product.description || 'Sản phẩm đặc trưng Ninh Bình'}</p>
            <div class="product-meta">
              <span class="price">${product.formatted_price}</span>
              <button class="secondary-btn" data-product-id="${product.id}">Thêm</button>
            </div>
          </div>
        </article>
      `
    )
    .join('');

  container.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => {
      addToCart(button.dataset.productId);
      updateCartCount();
    });
  });
}

function renderCartPage() {
  const cart = getCart();
  const container = document.querySelector('#cart-items');
  const totalEl = document.querySelector('#cart-total');

  if (!container || !totalEl) return;

  if (!cart.length) {
    container.innerHTML = '<div class="empty-cart">Giỏ hàng trống. Hãy quay lại cửa hàng để chọn sản phẩm.</div>';
    totalEl.textContent = '0 ₫';
    return;
  }

  fetchProducts()
    .then((products) => {
      const productMap = new Map(products.map((product) => [Number(product.id), product]));
      let total = 0;

      container.innerHTML = cart
        .map((item) => {
          const product = productMap.get(Number(item.productId));
          if (!product) return '';

          const itemTotal = Number(product.price) * Number(item.quantity || 1);
          total += itemTotal;

          return `
            <div class="cart-item">
              <img src="${product.image_url}" alt="${product.name}" />
              <div class="item-info">
                <h3>${product.name}</h3>
                <p class="item-price">${product.formatted_price}</p>
                <div class="quantity-controls">
                  <button class="qty-btn" data-action="decrease" data-product-id="${product.id}">−</button>
                  <span>${item.quantity}</span>
                  <button class="qty-btn" data-action="increase" data-product-id="${product.id}">+</button>
                </div>
              </div>
              <div class="item-actions">
                <strong>${formatMoney(itemTotal)}</strong>
                <button class="secondary-btn" data-action="remove" data-product-id="${product.id}">Xóa</button>
              </div>
            </div>
          `;
        })
        .join('');

      totalEl.textContent = formatMoney(total);

      container.querySelectorAll('[data-action]').forEach((button) => {
        const productId = Number(button.dataset.productId);
        const action = button.dataset.action;

        button.addEventListener('click', () => {
          const currentCart = getCart();
          const target = currentCart.find((item) => Number(item.productId) === productId);

          if (!target) return;

          if (action === 'increase') {
            target.quantity += 1;
          }

          if (action === 'decrease') {
            target.quantity -= 1;
            if (target.quantity <= 0) {
              const filtered = currentCart.filter((item) => Number(item.productId) !== productId);
              saveCart(filtered);
              renderCartPage();
              return;
            }
          }

          if (action === 'remove') {
            saveCart(currentCart.filter((item) => Number(item.productId) !== productId));
            renderCartPage();
            return;
          }

          saveCart(currentCart);
          renderCartPage();
        });
      });
    })
    .catch(() => {
      container.innerHTML = '<div class="empty-cart">Không thể tải giỏ hàng.</div>';
      totalEl.textContent = '0 ₫';
    });
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

async function checkout() {
  const form = document.querySelector('#checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const customer = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    };

    const cart = getCart();
    if (!cart.length) {
      window.alert('Giỏ hàng của bạn đang trống.');
      return;
    }

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, cart }),
    });

    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || 'Đã có lỗi xảy ra khi tạo đơn hàng.');
      return;
    }

    if (data.url) {
      localStorage.removeItem(CART_KEY);
      window.location.href = data.url;
    }
  });
}

function setupSuccessPage() {
  const orderElement = document.querySelector('#order-id');
  if (!orderElement) return;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order');
  orderElement.textContent = orderId || 'N/A';
  localStorage.removeItem(CART_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();

  if (document.querySelector('#products-grid')) {
    fetchProducts()
      .then((products) => renderProducts(products))
      .catch(() => {
        document.querySelector('#products-grid').innerHTML = '<p>Không thể tải sản phẩm.</p>';
      });
  }

  if (document.querySelector('#cart-items')) {
    renderCartPage();
    checkout();
  }

  if (document.querySelector('#order-id')) {
    setupSuccessPage();
  }
});
