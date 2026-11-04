/**
 * CAFE OS — UI Design Token & Multi-Tenant Theme Integration Test Suite
 * Path: tests/uiThemeTokenIntegration.test.ts
 *
 * Verifies:
 * 1. theme-tokens.css contains complete token contracts for both tenants (100 HICH and Modendo).
 * 2. Primary Cashier & Modal components integrate data-tenant scoping attributes.
 * 3. CSS variable usage (var(--color-brand-primary), var(--color-surface-base), etc.) replaces static colors.
 * 4. Preserves accounting VAT formulas without regression.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- Running UI Design Token & Multi-Tenant Theme Integration Suite ---\n');

  const rootDir = path.resolve(__dirname, '..');

  // -------------------------------------------------------------------------
  // Suite 1: Theme Tokens Stylesheet Contract
  // -------------------------------------------------------------------------
  console.log('[Suite 1: Theme Tokens Stylesheet Contract]');
  const cssPath = path.join(rootDir, 'src', 'styles', 'theme-tokens.css');
  assert(fs.existsSync(cssPath), 'src/styles/theme-tokens.css exists on disk');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert(cssContent.includes('[data-tenant="tenant-100hich-01"]'), '100 HICH tenant attribute selector defined');
  assert(cssContent.includes('[data-tenant="tenant-modendo-01"]'), 'Modendo tenant attribute selector defined');
  assert(cssContent.includes('--color-brand-primary: #D71921'), '100 HICH primary crimson red defined');
  assert(cssContent.includes('--color-brand-primary: #059669'), 'Modendo primary emerald green defined');
  assert(cssContent.includes('--color-brand-secondary: #0F223D'), '100 HICH secondary navy blue defined');
  assert(cssContent.includes('--color-brand-accent: #3B82F6'), 'Modendo PS5 neon blue accent defined');

  // Verify index.css imports theme-tokens.css
  const indexCss = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf8');
  assert(indexCss.includes('theme-tokens.css'), 'src/index.css imports theme-tokens.css');

  // -------------------------------------------------------------------------
  // Suite 2: Cashier Panel & Layout Tenant Scoping
  // -------------------------------------------------------------------------
  console.log('\n[Suite 2: Cashier Panel & Layout Scoping]');
  const appContent = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
  assert(appContent.includes('data-tenant={tenant.id}'), 'App.tsx root wrapper includes data-tenant={tenant.id}');
  assert(appContent.includes('var(--color-surface-base'), 'App.tsx uses var(--color-surface-base)');
  assert(appContent.includes('var(--color-brand-primary'), 'App.tsx uses var(--color-brand-primary)');

  const cashierContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CashierCheckoutPage.tsx'), 'utf8');
  assert(cashierContent.includes('data-tenant={tenantId}'), 'CashierCheckoutPage includes data-tenant={tenantId}');
  assert(cashierContent.includes('var(--color-brand-primary'), 'CashierCheckoutPage payment methods use var(--color-brand-primary)');

  const headerContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Header.tsx'), 'utf8');
  assert(headerContent.includes('data-tenant={tenant.id}'), 'Header includes data-tenant={tenant.id}');
  assert(headerContent.includes('var(--color-header-bg'), 'Header uses var(--color-header-bg)');

  // -------------------------------------------------------------------------
  // Suite 3: Receipt Previews & Modals Token Integration
  // -------------------------------------------------------------------------
  console.log('\n[Suite 3: Receipt Previews & Modals Token Integration]');
  const liveReceiptContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LiveReceiptPreview.tsx'), 'utf8');
  assert(liveReceiptContent.includes('data-tenant='), 'LiveReceiptPreview includes dynamic data-tenant scoping');
  assert(liveReceiptContent.includes('var(--color-badge-text'), 'LiveReceiptPreview badges use semantic token variables');
  // CRITICAL INVARIANT: Ensure VAT formula was NOT modified
  assert(
    liveReceiptContent.includes('(subtotal * fiscalRules.vat_tax_percentage) / 100'),
    'CRITICAL INVARIANT: VAT formula in LiveReceiptPreview remains strictly frozen'
  );

  const receiptPreviewContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ReceiptPreview.tsx'), 'utf8');
  assert(receiptPreviewContent.includes('data-tenant='), 'ReceiptPreview dialog includes data-tenant scoping');
  assert(receiptPreviewContent.includes('var(--color-brand-primary'), 'ReceiptPreview primary print button uses var(--color-brand-primary)');

  const zReportContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'modals', 'ZReportModal.tsx'), 'utf8');
  assert(zReportContent.includes('data-tenant='), 'ZReportModal motion.div includes data-tenant scoping');
  assert(zReportContent.includes('var(--color-brand-primary'), 'ZReportModal active subtabs use var(--color-brand-primary)');

  console.log('\n========================================');
  console.log(`UI Theme Token Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled exception during UI theme token tests:', err);
  process.exit(1);
});
