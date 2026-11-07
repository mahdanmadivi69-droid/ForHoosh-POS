import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TENANT_PROFILES, getActiveTenant } from '../src/config/tenantConfig';
import { renderReceiptTemplateHtml, ReceiptOrderData } from '../src/components/ReceiptPrintTemplate';

describe('Modendo Multi-Tenant Customization Suite', () => {
  it('defines 100hich and modendo profiles accurately', () => {
    const hich = TENANT_PROFILES['100hich'];
    assert.equal(hich.id, '100hich');
    assert.equal(hich.palette.primaryBg, '#0A0D11');
    assert.equal(hich.palette.surfaceBg, '#0F223D');
    assert.equal(hich.palette.accentColor, '#D71921');
    assert.equal(hich.workflow.defaultOrderType, 'TAKEAWAY');
    assert.equal(hich.workflow.requireTableNumber, false);
    assert.equal(hich.receipt.printKitchenTicket, false);

    const modendo = TENANT_PROFILES['modendo'];
    assert.equal(modendo.id, 'modendo');
    assert.equal(modendo.brandNameFa, 'کافه مودندو');
    assert.equal(modendo.palette.primaryBg, '#081813');
    assert.equal(modendo.palette.surfaceBg, '#0F2922');
    assert.equal(modendo.palette.accentColor, '#005A3E');
    assert.equal(modendo.workflow.defaultOrderType, 'DINE_IN');
    assert.equal(modendo.workflow.requireTableNumber, true);
    assert.deepEqual(modendo.workflow.quickTables, ['M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'BAR', 'VIP']);
    assert.equal(modendo.receipt.printKitchenTicket, true);
  });

  it('renders dual receipt tickets when printKitchenTicket is true (Modendo)', () => {
    const sampleOrder: ReceiptOrderData = {
      invoiceNo: 105,
      dateTime: '1405/08/17 - 16:30',
      orderType: 'سالن (Dine-in)',
      tableLabel: 'M-02',
      cashier: 'علی باریستا',
      customerName: 'سهراب سپهری',
      items: [
        { name: 'اسپرسو دبل', qty: 2, price: 90000 },
        { name: 'چیزکیک نیویورکی', qty: 1, price: 110000, notes: 'بدون سس توت‌فرنگی' },
      ],
      subtotalAmount: 290000,
      totalAmount: 290000,
      paymentMethod: 'کارتخوان سامان',
    };

    const modendoHtml = renderReceiptTemplateHtml(sampleOrder, {
      printKitchenTicket: true,
      name: 'کافه مودندو',
    });

    // Ticket 1 checks:
    assert.ok(modendoHtml.includes('کافه مودندو'), 'Includes brand name in customer receipt');
    assert.ok(modendoHtml.includes('M-02'), 'Includes table label in customer receipt');
    assert.ok(modendoHtml.includes((290000).toLocaleString('fa-IR')), 'Includes formatted total in customer receipt');

    // Ticket 2 checks:
    assert.ok(modendoHtml.includes('page-break-before: always'), 'Separated by print break');
    assert.ok(modendoHtml.includes('*** فیش سفارش بار / آشپزخانه ***'), 'Contains Kitchen ticket header');
    assert.ok(modendoHtml.includes('شماره سفارش: #KW-105 | میز: M-02'), 'Contains order number and table label in bold kitchen slip header');
    assert.ok(modendoHtml.includes('اسپرسو دبل'), 'Kitchen slip lists items');
    assert.ok(modendoHtml.includes('بدون سس توت‌فرنگی'), 'Kitchen slip lists notes');
  });

  it('renders single receipt ticket when printKitchenTicket is false (100 Hich)', () => {
    const sampleOrder: ReceiptOrderData = {
      invoiceNo: 201,
      dateTime: '1405/08/17 - 16:35',
      orderType: 'بیرون‌بر (Takeaway)',
      cashier: 'مهدان مددی',
      items: [{ name: 'آمریکانو', qty: 1, price: 75000 }],
      totalAmount: 75000,
      paymentMethod: 'نقدی',
    };

    const hichHtml = renderReceiptTemplateHtml(sampleOrder, {
      printKitchenTicket: false,
      name: 'قهوه‌فروشی ۱۰۰هیچ',
    });

    assert.ok(!hichHtml.includes('*** فیش سفارش بار / آشپزخانه ***'), 'Does NOT include Kitchen slip for 100 Hich');
    assert.ok(!hichHtml.includes('page-break-before: always'), 'Does NOT include page break for 100 Hich');
  });
});
