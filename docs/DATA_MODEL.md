# مدل داده و روابط پایگاه‌داده (DATA MODEL & SCHEMA) — SmartOrders

این سند، تعاریف جداول پایگاه داده رابطه‌ای (PostgreSQL) و الگوهای ذخیره‌سازی داده را مشخص می‌کند.

---

## ۱. جدول مستأجرها (Tenants / Businesses)
```sql
CREATE TABLE tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    currency VARCHAR(10) DEFAULT 'TOMAN' NOT NULL, -- 'TOMAN' | 'IRR' | 'USD'
    address TEXT,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## ۲. جدول کاربران و اعضا (Users & Memberships)
```sql
CREATE TYPE user_role AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'BARISTA');

CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    hashed_pin VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'CASHIER' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

## ۳. جدول دسته‌بندی و منو (Menu Categories & Items)
```sql
CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    sort_order INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE menu_items (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    category_id VARCHAR(36) REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
    name_fa VARCHAR(150) NOT NULL,
    name_en VARCHAR(150),
    price_toman BIGINT NOT NULL CHECK (price_toman >= 0),
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
```

## ۴. جدول شیفت‌ها (Shifts)
```sql
CREATE TYPE shift_status AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE shifts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    opened_by_user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
    closed_by_user_id VARCHAR(36) REFERENCES users(id),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_cash_toman BIGINT DEFAULT 0 NOT NULL,
    expected_closing_cash_toman BIGINT DEFAULT 0 NOT NULL,
    actual_counted_cash_toman BIGINT,
    cash_discrepancy_toman BIGINT, -- actual - expected
    discrepancy_reason TEXT,
    status shift_status DEFAULT 'OPEN' NOT NULL,
    notes TEXT
);
CREATE INDEX idx_shifts_tenant ON shifts(tenant_id);
```

## ۵. جدول سفارش‌ها و اقلام سفارش (Orders & Order Items)
```sql
CREATE TYPE order_status AS ENUM ('DRAFT', 'PREPARING', 'COMPLETED', 'CANCELLED');
CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

CREATE TABLE orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    shift_id VARCHAR(36) REFERENCES shifts(id) NOT NULL,
    created_by_user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
    order_number INT NOT NULL,
    order_type order_type DEFAULT 'DINE_IN' NOT NULL,
    table_label VARCHAR(50),
    customer_name VARCHAR(100),
    status order_status DEFAULT 'DRAFT' NOT NULL,
    gross_amount_toman BIGINT DEFAULT 0 NOT NULL,
    discount_amount_toman BIGINT DEFAULT 0 NOT NULL,
    net_total_toman BIGINT DEFAULT 0 NOT NULL,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id VARCHAR(36) REFERENCES menu_items(id) NOT NULL,
    item_name_snapshot VARCHAR(150) NOT NULL, -- ثبت نام لحظه سفارش
    unit_price_snapshot_toman BIGINT NOT NULL, -- ثبت قطعی قیمت واحد
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal_toman BIGINT NOT NULL, -- unit_price * quantity
    notes VARCHAR(255)
);
```

## ۶. جدول پرداخت‌ها (Payments)
```sql
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD_MANUAL', 'OTHER');
CREATE TYPE payment_status AS ENUM ('SUCCESSFUL', 'REFUNDED', 'VOIDED');

CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    order_id VARCHAR(36) REFERENCES orders(id) NOT NULL,
    shift_id VARCHAR(36) REFERENCES shifts(id) NOT NULL,
    received_by_user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
    amount_toman BIGINT NOT NULL CHECK (amount_toman > 0),
    payment_method payment_method NOT NULL,
    reference_code VARCHAR(100), -- شماره پیگیری فیش کارتخوان یا ارجاع
    terminal_name VARCHAR(50),
    status payment_status DEFAULT 'SUCCESSFUL' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## ۷. جدول هزینه‌های جاری صندوق (Expenses)
```sql
CREATE TABLE expenses (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    shift_id VARCHAR(36) REFERENCES shifts(id) NOT NULL,
    recorded_by_user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
    category VARCHAR(100) NOT NULL, -- خرید روزانه، پیک، انعام، متفرقه
    amount_toman BIGINT NOT NULL CHECK (amount_toman > 0),
    is_paid_from_cash_drawer BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## ۸. جدول ثبت ردپای حسابرسی (Audit Logs)
```sql
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) REFERENCES tenants(id) NOT NULL,
    user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g. SHIFT_CLOSED, ORDER_CANCELLED, DISCOUNT_APPLIED
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_or_device VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```
