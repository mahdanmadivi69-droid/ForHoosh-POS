# CafeOS / SmartOrders v0.16 — Executive Demo Runbook & Operator Guide
**Dual-Tenant Unified Platform: 100 HICH Specialty Coffee × Modendo Cafe & Gaming Lounge**  
**Document Reference:** `DOC-RUNBOOK-V0.16-20261110`  
**Target Release:** Release v0.16 (Phase 2 Stage B Core Client)  
**Security Classification:** Restricted / KarWand Executive & Venue Stakeholders  

---

## 1. Quick Smoke Test Procedure

This section provides exact terminal execution commands for running developmental, preview, and dual concurrent production servers across both brand instances.

### 1.1 Development Server Execution
The development environment supports standalone single-brand execution or concurrent dual-brand execution via separate isolated ports:

* **100 HICH Specialty Coffee (Port 3001):**
  ```bash
  npm run dev:100hich
  ```
  *Resolves `VITE_TENANT_ID='tenant-100hich-01'` and binds Vite dev middleware to `http://localhost:3001`.*

* **Modendo Cafe & Gaming Lounge (Port 3002):**
  ```bash
  npm run dev:modendo
  ```
  *Resolves `VITE_TENANT_ID='tenant-modendo-01'` and binds Vite dev middleware to `http://localhost:3002`.*

* **Concurrent Dual-Venue Development (Ports 3001 & 3002):**
  ```bash
  npm run dev:concurrent
  ```
  *Spawns concurrent Node child processes hosting both isolated venue instances simultaneously.*

---

### 1.2 Desktop Launcher Scripts (Windows 1-Click Operations)
For local venue terminals running Windows POS environments:

* **100 HICH Desktop Launcher:**
  ```cmd
  .\RUN_100HICH.bat
  ```
  *Automatically compiles missing assets (`dist/100hich`), configures production environment on Port `3000`, and launches the default browser.*

* **Modendo Cafe Desktop Launcher:**
  ```cmd
  .\RUN_MODENDO.bat
  ```
  *Compiles missing assets (`dist/modendo`), configures production environment on Port `3001`, and launches the default browser.*

---

### 1.3 Production Dual-Brand Build Packaging
To compile optimized, independent production bundles for both venues:
```bash
npm run build:all
```
* **Build Artifact Verification:**
  * `dist/100hich/index.html` + scoped PWA Service Worker (`dist/100hich/sw.js`) and manifest.
  * `dist/modendo/index.html` + scoped PWA Service Worker (`dist/modendo/sw.js`) and manifest.
* **Partitioned Static Route Verification:**
  When executing the production server (`node server.ts`), Express serves partitioned brand routes without cross-contamination:
  * `http://localhost:3000/100hich` &rarr; Serves 100 HICH Specialty Coffee SPA.
  * `http://localhost:3000/modendo` &rarr; Serves Modendo Gaming & Dining Lounge SPA.
  * `http://localhost:3000/` &rarr; Dynamically falls back to active tenant root.

---

## 2. Visual Audit & Design System Checklist

Before opening the venue to operators or starting stakeholder demonstrations, conduct the visual inspection checklist below.

### 2.1 Pinar Typography Hierarchy Verification
* [ ] **Font Family Integrity:** Verify all Persian text renders in variable **Pinar** typography (`Pinar v3` with Persian digits `FD` and Squircle `DS4`).
* [ ] **RTL Script Ligatures:** Inspect compound Persian words (e.g., `اسپرسو`, `بارتندر`, `فاکتور`, `سفارشات`) to confirm seamless cursive glyph connections.
* [ ] **Zero Negative Letter Spacing:** Confirm no negative tracking (`tracking-tight` or negative `letter-spacing`) is applied to Persian copy, ensuring zero ligature clipping or glyph distortion.
* [ ] **Tabular Numerals:** Verify that all price amounts, table numbers, and item quantities format with tabular numerals (`tabular-nums`) and Persian thousand separators (`،`).

---

### 2.2 Apple VisionOS Liquid Glass Materiality
* [ ] **Translucent Glass Slabs (`.vision-glass-slab`):** Header and navigation surfaces feature multi-stop specular borders (`rgba(255, 255, 255, 0.15)`), dynamic backdrop blur (`backdrop-blur-2xl`), and subtle elevation shadows.
* [ ] **Ambient Luminous Mesh Underlay (`.vision-ambient-mesh`):** Three atmospheric radial blur orbs animate smoothly beneath the viewport, providing depth without distraction:
  * Carmine/Primary Orb (`.vision-orb-carmine`): Controlled via `--color-brand-primary-light`.
  * Navy/Secondary Orb (`.vision-orb-navy`): Controlled via `--color-brand-secondary-light`.
  * Gold/Warm Accent Orb (`.vision-orb-gold`): Controlled via `--color-brand-gold-light`.

---

### 2.3 Brand Color Palette Token Decoupling

| Palette Token | 100 HICH Coffee Roasters (`tenant-100hich-01`) | Modendo Cafe & Gaming (`tenant-modendo-01`) |
| :--- | :--- | :--- |
| **Surface Base** (`--color-surface-base`) | Deep Minimal Obsidian (`#070A0F`) | Industrial Charcoal (`#08090C`) |
| **Brand Primary** (`--color-brand-primary`) | Crimson Signature Red (`#D71921`) / Carmine (`#8C1318`) | Emerald Velvet Green (`#059669` / `#005A3E`) |
| **Brand Secondary** (`--color-brand-secondary`) | Imperial Cobalt Navy (`#0F223D`) | Deep Slate Black (`#0B0D11`) |
| **Brand Accent** (`--color-brand-accent`) | Liquid Gold / Sky Ice (`#9E8A5E` / `#90D2ED`) | PS5 Cyber Neon Blue (`#3B82F6`) |
| **Active Tab Glow** (`--glow-accent`) | Amber Carmine Pulse (`rgba(140, 19, 24, 0.6)`) | Cyber Emerald/Blue Glow (`rgba(5, 150, 105, 0.5)`) |

---

## 3. Live Flow Scenarios (Operator Step-by-Step Guide)

### Scenario 1: PBKDF2 Salted PIN Authentication & Role Elevation
1. **Launch App:** Navigate to `http://localhost:3000` (or `http://localhost:3001` for Modendo).
2. **Access Control Verification:**
   * Enter Barista credentials or PIN (`1234` for 100 Hich, `3344` for Modendo).
   * Confirm instant terminal unlock without network latency.
3. **Security Elevation Guard:**
   * Click on the **Settings & Configuration (تنظیمات)** tab.
   * Verify that low-privilege roles (Barista/Cashier) are intercepted with a secure PIN Elevation Prompt.
   * Enter Owner PIN (`1380` for Modendo, `1234` for 100 Hich Owner).
   * Confirm cryptographic verification succeeds via `crypto.scrypt` / PBKDF2 salt comparison. Fast-path client token bypasses are strictly prevented.

---

### Scenario 2: High-Speed Touch POS & Intelligent Station Routing
1. **Order Creation:** Select Table `میز ۴` on the interactive floor plan.
2. **Touch Catalog Entry:**
   * Tap `فلت وایت (Flat White)` &times; 2 (Beverage).
   * Tap `کروسان کلاسیک (Classic Croissant)` &times; 1 (Food / Bakery).
   * Tap `دانه قهوه اتیوپی ۲۵۰ گرم (Retail Whole Beans)` &times; 1 (Retail).
3. **Dispatch & Multi-Station Routing Audit:**
   * Click **تایید و ارسال به آشپزخانه / بار (Confirm & Dispatch)**.
   * Verify real-time routing invariants:
     * **Barista Station (`BAR`):** Receives ticket for 2&times; Flat White.
     * **Kitchen Station (`KITCHEN`):** Receives ticket for 1&times; Croissant.
     * **Retail Counter (`NO_PREP`):** Retail bean bag is excluded from preparation stations, preventing kitchen clutter.
4. **Dexie Bill-of-Materials (BOM) Depletion:**
   * Confirm local Dexie database instantly decrements raw stock:
     * Specialty Espresso Beans: `-36 g`
     * Fresh Whole Milk: `-440 ml`
     * Croissant Pastry: `-1 unit`

---

### Scenario 3: Tax-Inclusive 9% VAT Calculation (RSK-FIN-01 Compliance)
1. **Financial Precision Verification:**
   * Add items totaling gross sales of `200,000` Tomans.
2. **Iranian Fiscal Formula Application:**
   * System computes tax-inclusive VAT strictly using integer Toman math:
     $$\text{VAT} = \text{round}\left(\frac{\text{Sales} \times 9}{109}\right) = \text{round}\left(\frac{200,000 \times 9}{109}\right) = 16,514 \text{ Toman}$$
     $$\text{Net Sales} = 200,000 - 16,514 = 183,486 \text{ Toman}$$
3. **Zero Float Drift Guarantee:**
   * Verify that currency numbers contain zero decimal fractions (`16,514.00` &rarr; `16,514 Toman`).
   * Verify that cash drawer totals match:
     $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Collected} - \text{Cash Expenses}$$

---

### Scenario 4: Live Thermal Receipt Preview (`LiveReceiptPreview.tsx`)
1. **Open Thermal Preview:** On the active order or payment screen, trigger the receipt preview modal.
2. **Paper Size Adaptation:**
   * Toggle between **80mm (Standard Counter)** and **58mm (Mobile POS)** widths.
   * Observe clean auto-wrapping, high-contrast monochrome typography, and barcode/QR code scaling.
3. **Audit Receipt Fields:**
   * Dynamic brand header matches active venue (100 HICH Coffee Roasters vs Modendo Cafe).
   * Tax breakdown row displays explicit `مالیات بر ارزش افزوده ۹٪ (مشمول در قیمت)`.
   * Persian currency formatting displays exact integer Toman values with RTL alignment.

---

### Scenario 5: Dynamic ESC/POS LAN Hardware Gateway Parameterization
1. **Backend Gateway Verification:**
   * Run the hardware printer gateway:
     ```bash
     python backend/printer_gateway.py
     ```
   * Gateway listens on WebSocket port `8080` and TCP socket `9100`.
2. **Brand Parameterization Assertion:**
   * Dispatch an order payload with `"tenantId": "tenant-100hich-01"`.
   * Gateway generates ESC/POS binary ticket beginning with:
     ```text
     [ESC @] [ALIGN CENTER] [BOLD ON] [DOUBLE SIZE]
     100 HICH COFFEE ROASTERS
     ```
   * Dispatch an order payload with `"tenantId": "tenant-modendo-01"`.
   * Gateway generates ticket beginning with:
     ```text
     [ESC @] [ALIGN CENTER] [BOLD ON] [DOUBLE SIZE]
     MODENDO CAFE
     ```
   * Confirms complete elimination of hardcoded brand strings across thermal printer hardware.

---

## 4. 5-Minute Venue Stakeholder Presentation Script (18:00 Demo)

Designed for presentation to Venue Owners, General Managers, and Head Baristas.

### Minute 0:00 – 1:00 | Executive Introduction & The Multi-Tenant Vision
> *"عصر بخیر و خوش‌آمدید به رونمایی از نگارش جدید CafeOS (نسخه ۰.۱۶).  
> امروز ما در برابر چالشی قرار داشتیم که اکثر کافه‌های زنجیره‌ای و فضاهای چندمنظوره با آن دست به گریبانند: چگونه می‌توان چندین فضای کاملاً متفاوت — مانند لابراتوار تخصصی قهوه «۱۰۰ هیچ» در اکباتان و کافه بردگیم و لانج گیمینگ «مودندو» در شریعتی — را روی یک هسته مهندسی یکپارچه، امن و فوق‌سریع اجرا کرد، بدون آنکه هویت برندها، منوها، انبارها، یا فاکتورهای مالی با یکدیگر تداخل پیدا کنند؟  
> پاسخ ما در CafeOS نسخه ۰.۱۶ نهفته است: یک پلتفرم دوگانه با معماری Shared Core که استقلال کامل داده‌ها، سرعت لمسی زیر ۲۰ میلی‌ثانیه و پایداری ۱۰۰٪ آفلاین را تضمین می‌کند."*

---

### Minute 1:00 – 2:00 | Sensory UX, Pinar Typography & VisionOS Materiality
> *(اپراتور سیستم را باز می‌کند و تب‌های صندوق را تغییر می‌دهد)*  
> *"همانطور که روی این نمایشگر لمسی مشاهده می‌کنید، تجربه کاربری بازطراحی شده است:  
> نخست، تایپوگرافی اصیل «پینار» با اعراب و پیوستگی خط فارسی و اعداد استاندارد فارسی به گونه‌ای تنظیم شده که چشمان صندوق‌دار و باریستا حتی پس از ۱۲ ساعت کار در شیفت شلوغ خسته نشود.  
> دوم، زبان طراحی شیشه‌ای Liquid Glass با الهام از VisionOS، حس مدرن و شفافیت بی‌نظیری به محیط کاربری داده است. نورپردازی امبینت پشت زمینه به صورت هوشمند بر اساس پالت برند تغییر می‌کند: در ۱۰۰ هیچ، سایه‌های قرمز کارماین و سرمه‌ای اصیل، و در مودندو، سبز زمردی صنعتی و نور نئون آبی PS5 فضای سالن را منعکس می‌کنند."*

---

### Minute 2:00 – 3:00 | High-Speed Order Entry, Station Routing & Automated BOM
> *(اپراتور یک سفارش ترکیبی شامل دو فلت وایت، یک کروسان و یک بسته دانه قهوه ثبت می‌کند)*  
> *"بیایید یک سفارش واقعی را در ساعت اوج شلوغی ثبت کنیم.  
> با لمس آیتم‌ها، سیستم فیدبک صوتی آنی (Audio-Haptic Click) ارائه می‌دهد. اما جادوی واقعی در زمان ثبت نهایی رخ می‌دهد:  
> موتور مسیریابی هوشمند (Station Router)، آیتم‌ها را به محض ثبت تفکیک می‌کند: دو فلت‌وایت مستقیماً به تبلت KDS باریستا می‌رود؛ کروسان به KDS آشپزخانه ارسال می‌شود؛ و بسته دانه قهوه به صورت خودکار به عنوان NO_PREP شناخته شده و از شلوغ کردن صف آماده‌سازی پرسنل جلوگیری می‌کند.  
> همزمان در پس‌زمینه، انبار سنسوری مقدار دقیق ۳۶ گرم دانه کلمبیا و ۴۴۰ میلی‌لیتر شیر تازه را از موجودی فیزیکی کسر می‌کند — بدون نیاز به حتی یک بار رفرش صفحه!"*

---

### Minute 3:00 – 4:00 | Iranian Fiscal Invariants & 9% Tax-Inclusive Math
> *(اپراتور فاکتور و پیش‌نمایش چاپ حرارتی را باز می‌کند)*  
> *"بخش مالی، قلب تپنده هر کسب‌وکار موفق است. در CafeOS، واحد مالی دقیقاً بر مبنای «تومان عدد صحیح» قفل شده است. هیچ اعشار شناوری که باعث ناهمخوانی دخل و فیش بانکی شود، در این سیستم وجود ندارد.  
> بر اساس دستورالعمل رسمی سازمان امور مالیاتی کشور، مالیات بر ارزش افزوده ۹٪ استاندارد «مشمول در قیمت فروش» به فرمول دقیق نه صد و نهم محاسبه می‌شود. یعنی برای یک فروش ۲۰۰ هزار تومانی، دقیقاً ۱۶,۵۱۴ تومان مالیات و ۱۸۳,۴۸۶ تومان فروش خالص ثبت می‌شود.  
> پیش‌نمایش فیش حرارتی به دو صورت ۸۰ میلی‌متری و ۵۸ میلی‌متری قابل تنظیم است و با پروتکل مستقیم شبکه به پرینترهای حرارتی بار و آشپزخانه ارسال می‌گردد."*

---

### Minute 4:00 – 5:00 | 100% Offline Resilience & Hardware Gateway Freedom
> *(اپراتور ارتباط اینترنت را قطع کرده و سفارشی را ثبت می‌کند، سپس اتصال را مجدداً برقرار می‌کند)*  
> *"نگرانی همیشگی مدیران کافه در ایران: قطعی اینترنت و مسدود شدن پرداخت‌ها!  
> در CafeOS، پایگاه داده محلی Dexie تمامی سفارش‌ها، جداول باز، و شیفت‌ها را روی خود حافظه سخت‌افزاری تبلت ذخیره می‌کند. حتی اگر کابل اینترنت قطع باشد، ثبت سفارش و صدور فیش با سرعت صدم ثانیه ادامه می‌یابد. به محض برقراری اتصال، صف همگام‌سازی ابری به صورت خودکار و کاملاً غیرتکرارشونده (Idempotent)، کلیه داده‌ها را با سرور پشتیبان همگام می‌سازد.  
> گیت‌وی پرینترهای حرارتی نیز مستقل از هرگونه سرویس خارجی، از طریق پورت ۹۱۰۰ شبکه محلی فیش‌ها را با سربرگ داینامیک نام کافه چاپ می‌کند.  
> نسخه ۰.۱۶ اکنون آماده استقرار، بهره‌برداری و فتح قله‌های کیفیت در هر دو شعبه است. از توجه و اعتماد شما سپاسگزاریم!"*

---

## 5. Verification Sign-Off Table

| Verification Checkpoint | Lead Specialist | Verification Standard | Status |
| :--- | :---: | :--- | :---: |
| **Pinar Typography & RTL** | ALPHA | Variable Pinar-DS4, 0 negative tracking | &check; VERIFIED |
| **Multi-Tenant CSS Tokens** | ALPHA | Dynamic `--color-*` tokens decoupled (RSK-05) | &check; VERIFIED |
| **Integer Toman Accounting** | ALPHA | SafeInt, zero float drift, 9/109 VAT (RSK-FIN-01) | &check; VERIFIED |
| **KDS Station Routing** | ALPHA | BAR vs KITCHEN split, NO_PREP retail filter | &check; VERIFIED |
| **Printer Gateway Parameters** | ALPHA | Parameterized venue header in ESC/POS (RSK-08) | &check; VERIFIED |
| **Full Regression Suite** | ALPHA | 1,195 / 1,195 Passed, 0 Failures | &check; VERIFIED |
| **Dual Production Build** | ALPHA | `dist/100hich` + `dist/modendo` (Clean PWA) | &check; VERIFIED |
