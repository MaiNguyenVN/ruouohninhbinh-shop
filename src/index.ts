import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import Stripe from 'stripe';

const app = new Hono<{
  Bindings: {
    DB: D1Database;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    CURRENCY?: string;
    STORE_NAME?: string;
  };
}>();

const formatMoney = (value: number, currency = 'vnd') => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency.toUpperCase() === 'VND' ? 'VND' : currency,
    maximumFractionDigits: 0,
  }).format(value);
};

// Serve static files from public directory
app.use('/*', serveStatic({ root: './' }));

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    store: c.env.STORE_NAME || 'Rượu Ó Ninh Bình',
    time: new Date().toISOString(),
  });
});

app.get('/api/products', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM products WHERE stock > 0 ORDER BY id ASC'
    ).all();

    return c.json({
      products: results.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        image_url: product.image_url,
        category: product.category,
        stock: Number(product.stock),
        formatted_price: formatMoney(Number(product.price), c.env.CURRENCY || 'vnd'),
      })),
    });
  } catch (error) {
    return c.json({ error: 'Không thể tải sản phẩm', details: String(error) }, 500);
  }
});

app.post('/api/checkout', async (c) => {
  const body = await c.req.json();
  const cart = Array.isArray(body?.cart) ? body.cart : [];
  const customer = body?.customer || {};

  if (!cart.length) {
    return c.json({ error: 'Giỏ hàng trống.' }, 400);
  }

  if (!customer.name || !customer.email || !customer.phone || !customer.address) {
    return c.json({ error: 'Vui lòng điền đầy đủ thông tin khách hàng.' }, 400);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe chưa được cấu hình.' }, 500);
  }

  const productIds = [...new Set(cart.map((item: any) => Number(item.productId)).filter(Boolean))];
  if (!productIds.length) {
    return c.json({ error: 'Không tìm thấy sản phẩm hợp lệ trong giỏ hàng.' }, 400);
  }

  const placeholders = productIds.map(() => '?').join(',');
  const productRows = await c.env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${placeholders})`
  )
    .bind(...productIds)
    .all();

  const productMap = new Map(productRows.results.map((product) => [Number(product.id), product]));

  let totalAmount = 0;
  const lineItemsForStripe: any[] = [];
  const orderItems: any[] = [];

  for (const item of cart) {
    const product = productMap.get(Number(item.productId));
    if (!product) {
      return c.json({ error: `Sản phẩm ${item.productId} không tồn tại.` }, 400);
    }

    const quantity = Number(item.quantity) || 1;
    if (quantity <= 0) {
      return c.json({ error: 'Số lượng sản phẩm không hợp lệ.' }, 400);
    }

    const itemTotal = Number(product.price) * quantity;
    totalAmount += itemTotal;

    lineItemsForStripe.push({
      price_data: {
        currency: (c.env.CURRENCY || 'vnd').toLowerCase(),
        product_data: {
          name: product.name,
          images: product.image_url ? [product.image_url] : [],
        },
        unit_amount: Number(product.price),
      },
      quantity,
    });

    orderItems.push({
      product_id: Number(product.id),
      product_name: product.name,
      price: Number(product.price),
      quantity,
    });
  }

  if (totalAmount <= 0) {
    return c.json({ error: 'Tổng đơn hàng phải lớn hơn 0.' }, 400);
  }

  const orderUuid = crypto.randomUUID();
  const cartId = `cart_${Date.now()}`;
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const origin = new URL(c.req.url).origin;

  const orderInsert = await c.env.DB.prepare(
    `INSERT INTO orders (order_uuid, cart_id, customer_name, customer_email, customer_phone, customer_address, total_amount, payment_status, stripe_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '')`
  ).bind(
    orderUuid,
    cartId,
    String(customer.name),
    String(customer.email),
    String(customer.phone),
    String(customer.address),
    totalAmount
  ).run();

  const orderId = Number(orderInsert.meta.last_row_id);

  for (const item of orderItems) {
    await c.env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(orderId, item.product_id, item.product_name, item.price, item.quantity).run();
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItemsForStripe,
    customer_email: String(customer.email),
    success_url: `${origin}/success.html?order=${orderUuid}`,
    cancel_url: `${origin}/cart.html`,
    metadata: {
      order_uuid: orderUuid,
      cart_id: cartId,
    },
  });

  await c.env.DB.prepare(
    `UPDATE orders SET stripe_session_id = ? WHERE order_uuid = ?`
  ).bind(session.id, orderUuid).run();

  return c.json({
    ok: true,
    url: session.url,
    order_id: orderUuid,
    total: totalAmount,
  });
});

app.post('/api/webhook', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Stripe webhook chưa được cấu hình.' }, 500);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Thiếu chữ ký webhook.' }, 400);
  }

  const rawBody = await c.req.text();
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY || '');

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderUuid = session.metadata?.order_uuid;
      const stripeSessionId = session.id;

      if (orderUuid) {
        await c.env.DB.prepare(
          `UPDATE orders SET payment_status = 'paid', stripe_session_id = ? WHERE order_uuid = ?`
        ).bind(stripeSessionId, orderUuid).run();
      }
    }

    return c.json({ received: true });
  } catch (error) {
    return c.json({ error: 'Webhook không hợp lệ.' }, 400);
  }
});

app.get('/api/orders/:orderUuid', async (c) => {
  const orderUuid = c.req.param('orderUuid');
  const order = await c.env.DB.prepare(
    `SELECT * FROM orders WHERE order_uuid = ?`
  ).bind(orderUuid).first();

  if (!order) {
    return c.json({ error: 'Không tìm thấy đơn hàng.' }, 404);
  }

  const items = await c.env.DB.prepare(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`
  ).bind(order.id).all();

  return c.json({
    order: {
      id: order.id,
      order_uuid: order.order_uuid,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      total_amount: Number(order.total_amount),
      payment_status: order.payment_status,
      created_at: order.created_at,
      stripe_session_id: order.stripe_session_id,
    },
    items: items.results,
  });
});

export default app;

export { app };
