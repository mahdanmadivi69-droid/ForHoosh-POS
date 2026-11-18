import sharp from 'sharp';
import potrace from 'potrace';
import fs from 'fs';
import path from 'path';

function traceAsync(buffer, options) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

async function main() {
  console.log('=== Starting Logo Vectorization ===');
  fs.mkdirSync('public/tenants/modendo', { recursive: true });
  fs.mkdirSync('public/brand', { recursive: true });

  // 1. modendo-mark.svg from brand-source/modendo-mark.jpg
  console.log('1. Tracing modendo-mark.svg...');
  const markCropped = await sharp('brand-source/modendo-mark.jpg')
    .extract({ left: 260, top: 220, width: 560, height: 640 })
    .toBuffer();

  const { data: markData, info: markInfo } = await sharp(markCropped)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const markBw = Buffer.alloc(markInfo.width * markInfo.height);
  for (let i = 0; i < markInfo.width * markInfo.height; i++) {
    const r = markData[i * 3];
    // mark is cream (r > 150) -> trace black pixels (0)
    markBw[i] = r > 150 ? 0 : 255;
  }

  const markPng = await sharp(markBw, {
    raw: { width: markInfo.width, height: markInfo.height, channels: 1 },
  })
    .png()
    .toBuffer();

  const modendoMarkSvg = await traceAsync(markPng, {
    color: '#10B981',
    optCurve: true,
    turdSize: 15,
    optTolerance: 0.3,
  });
  fs.writeFileSync('public/tenants/modendo/modendo-mark.svg', modendoMarkSvg);
  console.log('Saved public/tenants/modendo/modendo-mark.svg');

  // 2. modendo-logo-fa.svg from brand-source/modendo-fa.png
  console.log('2. Tracing modendo-logo-fa.svg...');
  const faTrim = await sharp('brand-source/modendo-fa.png')
    .trim()
    .resize(2000, 2000, { fit: 'inside' })
    .toBuffer();

  const modendoLogoFaSvg = await traceAsync(faTrim, {
    color: '#005B42',
    optCurve: true,
    threshold: 128,
    turdSize: 10,
    optTolerance: 0.25,
  });
  fs.writeFileSync('public/tenants/modendo/modendo-logo-fa.svg', modendoLogoFaSvg);
  console.log('Saved public/tenants/modendo/modendo-logo-fa.svg');

  // 3. modendo-cafe-en.svg from brand-source/modendo-en.png
  console.log('3. Tracing modendo-cafe-en.svg...');
  const enTrim = await sharp('brand-source/modendo-en.png')
    .trim()
    .resize(2000, 2000, { fit: 'inside' })
    .toBuffer();

  const modendoCafeEnSvg = await traceAsync(enTrim, {
    color: '#005B42',
    optCurve: true,
    threshold: 128,
    turdSize: 10,
    optTolerance: 0.25,
  });
  fs.writeFileSync('public/tenants/modendo/modendo-cafe-en.svg', modendoCafeEnSvg);
  console.log('Saved public/tenants/modendo/modendo-cafe-en.svg');

  // 4. karwand-monogram.svg - Clean architectural white outline geometry
  console.log('4. Generating clean karwand-monogram.svg...');
  const karwandMonogramSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 900" width="100%" height="100%" fill="none">
  <g stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 40 780 H 305 V 60" />
    <path d="M 385 60 V 300" />
    <path d="M 385 435 V 775" />
    <path d="M 40 855 H 410" />
    <path d="M 385 300 L 765 20" />
    <path d="M 630 170 L 770 30" />
    <path d="M 455 375 L 810 710 L 665 865 L 535 735 L 410 855" />
    <path d="M 440 470 L 725 735 L 665 795 L 535 665 L 385 775" />
  </g>
</svg>
`;
  fs.writeFileSync('public/brand/karwand-monogram.svg', karwandMonogramSvg);
  console.log('Saved public/brand/karwand-monogram.svg');

  // 5. karwand-logo.svg from public/karwand-logo.png (inverted foreground mask on 100% transparent background)
  console.log('5. Tracing karwand-logo.svg...');
  const { data: logoRaw, info: logoInfo } = await sharp('public/karwand-logo.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const logoBw = Buffer.alloc(logoInfo.width * logoInfo.height, 255); // 255 = background/transparent
  for (let y = 50; y < 455; y++) {
    for (let x = 100; x < 415; x++) {
      const idx = (y * logoInfo.width + x) * 4;
      const r = logoRaw[idx], g = logoRaw[idx + 1], b = logoRaw[idx + 2], a = logoRaw[idx + 3];
      if (a === 0) continue;
      const isForeground = (r > 80 && g > 65) || (r > 50 && r > g * 1.15 && r > b * 1.15);
      if (isForeground) {
        logoBw[y * logoInfo.width + x] = 0; // 0 = black for potrace foreground
      }
    }
  }

  const logoPngBuf = await sharp(logoBw, {
    raw: { width: logoInfo.width, height: logoInfo.height, channels: 1 },
  })
    .png()
    .toBuffer();

  const karwandLogoSvg = await traceAsync(logoPngBuf, {
    color: '#E11D48',
    optCurve: true,
    turdSize: 10,
    optTolerance: 0.25,
  });
  fs.writeFileSync('public/brand/karwand-logo.svg', karwandLogoSvg);
  console.log('Saved public/brand/karwand-logo.svg');

  // 6. Generate public/logo-preview.html for visual QA
  console.log('6. Generating public/logo-preview.html...');
  const previewHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Vector Assets Side-by-Side QA Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Vazirmatn', sans-serif; background-color: #06120F; color: #F8FAFC; }
    .glass-card { background: rgba(16, 24, 21, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(16px); }
  </style>
</head>
<body class="p-6 md:p-10 space-y-8">
  <header class="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-white/10">
    <div>
      <h1 class="text-2xl font-black text-white">پیش‌نمایش تطبیقی نمادها و وکتورهای برندینگ (SVG vs Raster)</h1>
      <p class="text-sm text-emerald-400 mt-1">تولید شده با potrace و sharp مستقیماً از فایل‌های اصلی brand-source</p>
    </div>
    <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-400/40">
      release/modendo-v0.16.1
    </span>
  </header>

  <main class="max-w-6xl mx-auto space-y-8">
    <!-- Row 1: Modendo Mark -->
    <section class="glass-card rounded-3xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 class="text-lg font-black text-white">۱. نماد هندسی مودندو (Modendo Mark)</h2>
        <span class="text-xs text-[#94A3B8] font-mono">public/tenants/modendo/modendo-mark.svg</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="rounded-2xl bg-black/40 p-4 border border-white/5 flex flex-col items-center">
          <span class="text-xs text-white/50 mb-3 font-bold">فایل اصلی بیت‌مپ (brand-source/modendo-mark.jpg)</span>
          <img src="/brand-source/modendo-mark.jpg" alt="Original Mark" class="max-h-56 object-contain rounded-xl" />
        </div>
        <div class="rounded-2xl bg-[#082019] p-4 border border-emerald-500/30 flex flex-col items-center shadow-[0_0_24px_rgba(16,185,129,0.25)]">
          <span class="text-xs text-emerald-300 mb-3 font-bold">وکتور SVG ردگیری‌شده (Traced Vector)</span>
          <img src="/tenants/modendo/modendo-mark.svg" alt="Traced Mark SVG" class="max-h-56 object-contain filter drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
        </div>
      </div>
    </section>

    <!-- Row 2: Modendo FA Wordmark -->
    <section class="glass-card rounded-3xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 class="text-lg font-black text-white">۲. تایپوگرافی فارسی کافه مودندو (Modendo FA Logo)</h2>
        <span class="text-xs text-[#94A3B8] font-mono">public/tenants/modendo/modendo-logo-fa.svg</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="rounded-2xl bg-black/40 p-4 border border-white/5 flex flex-col items-center">
          <span class="text-xs text-white/50 mb-3 font-bold">فایل اصلی بیت‌مپ (brand-source/modendo-fa.png)</span>
          <img src="/brand-source/modendo-fa.png" alt="Original FA Logo" class="max-h-48 object-contain rounded-xl bg-white/5" />
        </div>
        <div class="rounded-2xl bg-white/90 p-4 border border-white/20 flex flex-col items-center">
          <span class="text-xs text-slate-800 mb-3 font-bold">وکتور SVG در سربرگ فیش (روی پس‌زمینه سفید پرینتر حرارتی)</span>
          <img src="/tenants/modendo/modendo-logo-fa.svg" alt="Traced FA SVG" class="max-h-48 object-contain" />
        </div>
      </div>
    </section>

    <!-- Row 3: Modendo EN Logo -->
    <section class="glass-card rounded-3xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 class="text-lg font-black text-white">۳. لوگوتایپ انگلیسی مودندو (Modendo Cafe EN)</h2>
        <span class="text-xs text-[#94A3B8] font-mono">public/tenants/modendo/modendo-cafe-en.svg</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="rounded-2xl bg-black/40 p-4 border border-white/5 flex flex-col items-center">
          <span class="text-xs text-white/50 mb-3 font-bold">فایل اصلی بیت‌مپ (brand-source/modendo-en.png)</span>
          <img src="/brand-source/modendo-en.png" alt="Original EN Logo" class="max-h-48 object-contain rounded-xl bg-white/5" />
        </div>
        <div class="rounded-2xl bg-[#082019] p-4 border border-emerald-500/30 flex flex-col items-center">
          <span class="text-xs text-emerald-300 mb-3 font-bold">وکتور SVG ردگیری‌شده (Traced Vector)</span>
          <img src="/tenants/modendo/modendo-cafe-en.svg" alt="Traced EN SVG" class="max-h-48 object-contain filter drop-shadow-[0_0_10px_rgba(16,185,129,0.35)]" />
        </div>
      </div>
    </section>

    <!-- Row 4: KarWand Monogram & Logo -->
    <section class="glass-card rounded-3xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 class="text-lg font-black text-white">۴. مونوگرام و نشان کاروند (KarWand Monogram & Logo)</h2>
          <p class="text-xs text-rose-300 mt-0.5">وکتور خالص با پس‌زمینه ۱۰۰٪ شفاف (بدون کادر یا مستطیل قرمز پر) و گرادیان جواهراتی</p>
        </div>
        <span class="text-xs text-[#94A3B8] font-mono">public/brand/karwand-monogram.svg & karwand-logo.svg</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="rounded-2xl bg-black/40 p-4 border border-white/5 flex flex-col items-center">
          <span class="text-xs text-white/50 mb-3 font-bold">تایل اصلی کاروند (Master Tile)</span>
          <img src="/brand-source/karwand-tile.png" alt="Original KarWand Tile" class="max-h-44 object-contain rounded-xl" />
        </div>
        <div class="rounded-2xl p-4 border border-rose-500/30 flex flex-col items-center shadow-[0_0_20px_rgba(220,38,38,0.2)] bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#120508]">
          <span class="text-xs text-rose-300 mb-3 font-bold">مونوگرام روی شفافیت (Transparent)</span>
          <img src="/brand/karwand-monogram.svg" alt="Traced KarWand Monogram" class="max-h-40 object-contain filter drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]" />
        </div>
        <div class="rounded-2xl bg-[#18060A] p-4 border border-rose-500/30 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.2)] space-y-4">
          <span class="text-xs text-rose-300 font-bold">پیش‌نمایش داخل کپسول سربرگ (Header Pill)</span>
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#5B0E14] via-[#40080D] to-[#250407] border border-[#DC2626]/70 shadow-[0_0_16px_rgba(220,38,38,0.4)]">
            <img src="/brand/karwand-monogram.svg" alt="KarWand" class="w-5 h-5 object-contain filter drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span class="text-xs font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FDE68A] via-[#F59E0B] to-[#FBBF24]">Smart Orders</span>
          </div>
        </div>
        <div class="rounded-2xl bg-white/95 p-4 border border-slate-300 flex flex-col items-center shadow-md">
          <span class="text-xs text-slate-800 mb-3 font-bold">لوگوی کامل روی سفید (Receipt Header)</span>
          <img src="/brand/karwand-logo.svg" alt="Traced KarWand Logo" class="max-h-36 object-contain" />
        </div>
      </div>
    </section>
  </main>
</body>
</html>
`;
  fs.writeFileSync('public/logo-preview.html', previewHtml);
  console.log('Saved public/logo-preview.html');
  console.log('=== Logo Vectorization Complete ===');
}

main().catch((err) => {
  console.error('Vectorization error:', err);
  process.exit(1);
});
