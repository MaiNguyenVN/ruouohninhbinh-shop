# Rượu Ó Ninh Bình — E-commerce Shop

Fullstack e-commerce app trên Cloudflare Workers + D1 + Stripe.

## Cấu trúc

```
ruouohninhbinh-shop/
├── src/
│   └── index.ts          # Worker API (Hono) — products, cart, checkout, webhook
├── public/
│   ├── index.html        # Trang sản phẩm
│   ├── cart.html         # Trang giỏ hàng + thanh toán
│   ├── success.html      # Trang đặt hàng thành công
│   ├── style.css         # Giao diện
│   └── app.js            # Frontend logic (giỏ hàng, checkout)
├── schema.sql            # Database schema + sample products
├── wrangler.jsonc        # Cloudflare config
└── package.json
```

## Cài đặt

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo D1 database

```bash
npm run db:create
```

→ Copy `database_id` từ output, thay vào `wrangler.jsonc`:
```json
"database_id": "YOUR_ACTUAL_DATABASE_ID"
```

### 3. Khởi tạo database (local)

```bash
npm run db:init
```

### 4. Tạo Stripe account

1. Đăng ký tại [https://stripe.com](https://stripe.com)
2. Lấy API keys từ Stripe Dashboard → Developers → API Keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`
3. Tạo webhook endpoint:
   - URL: `https://your-worker-url/api/webhook`
   - Events: `checkout.session.completed`
   - Copy **Webhook signing secret**: `whsec_...`

### 5. Cấu hình secrets

```bash
# Stripe secret key
npx wrangler secret put STRIPE_SECRET_KEY
# → dán sk_test_...

# Stripe webhook secret
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# → dán whsec_...
```

### 6. Chạy local

```bash
npm run dev
```

→ Mở http://localhost:8787

### 7. Deploy

```bash
# Khởi tạo database trên production
npm run db:init:remote

# Deploy Worker
npm run deploy
```

## Tính năng

- ✅ Hiển thị sản phẩm
- ✅ Giỏ hàng (thêm, sửa số lượng, xóa)
- ✅ Thanh toán Stripe (thẻ tín dụng)
- ✅ Trang xác nhận đơn hàng
- ✅ Webhook Stripe (cập nhật trạng thái thanh toán)
- ✅ Lưu đơn hàng vào D1 database
- ✅ Responsive (mobile-friendly)

## Tùy chỉnh

- **Sản phẩm**: Chỉnh sửa trong `schema.sql` hoặc thêm qua API
- **Giao diện**: Chỉnh sửa `public/style.css`
- **Tiền tệ**: Đổi `CURRENCY` trong `wrangler.jsonc` (mặc định: VND)
