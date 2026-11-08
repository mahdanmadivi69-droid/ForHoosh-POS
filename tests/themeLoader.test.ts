/**
 * tests/themeLoader.test.ts
 * 
 * Verification suite for Dynamic ThemeLoader (Phase 2 Stage A)
 * Enforces:
 *  - Strict tenant token segregation between 100 HICH and Modendo
 *  - Non-destructive dynamic override support (.agency/theme.json)
 *  - Visual-only CSS custom property injection
 */

import { ThemeLoader, TenantThemeOverrides } from '../src/services/ThemeLoader';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- Running ThemeLoader Test Suite (Phase 2 Stage A) ---\n');

  // Test 1: Tenant ID normalization
  console.log('[Suite 1: Tenant ID Normalization]');
  {
    assert(ThemeLoader.normalizeTenantId('100hich') === '100hich', 'Resolves 100hich');
    assert(ThemeLoader.normalizeTenantId('tenant-100hich-01') === '100hich', 'Resolves tenant-100hich-01');
    assert(ThemeLoader.normalizeTenantId('modendo') === 'modendo', 'Resolves modendo');
    assert(ThemeLoader.normalizeTenantId('tenant-modendo-01') === 'modendo', 'Resolves tenant-modendo-01');
    assert(ThemeLoader.normalizeTenantId(undefined) === '100hich', 'Defaults to 100hich');
  }

  // Test 2: Base Token Computation
  console.log('\n[Suite 2: Base Token Computation]');
  {
    const vars100 = ThemeLoader.computeCssVariables('100hich');
    assert(vars100['--app-bg'] === '#0A0D11', '100 HICH has obsidian background #0A0D11');
    assert(vars100['--app-surface'] === '#0F223D', '100 HICH has navy surface #0F223D');
    assert(vars100['--app-accent'] === '#D71921', '100 HICH has carmine red accent #D71921');
    assert(vars100['--brand-tenant-id'] === 'tenant-100hich-01', 'Tenant ID matches tenant-100hich-01');

    const varsModendo = ThemeLoader.computeCssVariables('modendo');
    assert(varsModendo['--app-bg'] === '#081813', 'Modendo has forest obsidian background #081813');
    assert(varsModendo['--app-surface'] === '#0F2922', 'Modendo has emerald surface #0F2922');
    assert(varsModendo['--app-accent'] === '#005A3E', 'Modendo has emerald accent #005A3E');
    assert(varsModendo['--brand-tenant-id'] === 'tenant-modendo-01', 'Tenant ID matches tenant-modendo-01');
  }

  // Test 3: JSON Override Parsing & Registration (.agency/theme.json format)
  console.log('\n[Suite 3: Dynamic Override Registration & JSON Parsing]');
  {
    const sampleAgencyJson = JSON.stringify({
      tenantId: '100hich',
      palette: {
        accentColor: '#FF2A35',
        surfaceBg: '#122B4D',
      },
      customCssVariables: {
        '--custom-agency-glow': 'rgba(255, 42, 53, 0.6)',
      },
    });

    const parsed = ThemeLoader.parseThemeJson(sampleAgencyJson);
    assert(parsed !== null, 'Successfully parses agency theme JSON');
    assert(parsed?.palette?.accentColor === '#FF2A35', 'Extracts overridden accent color');

    // Register override
    ThemeLoader.registerOverrides('100hich', parsed!);

    const overriddenVars = ThemeLoader.computeCssVariables('100hich');
    assert(overriddenVars['--app-accent'] === '#FF2A35', 'Accent color overridden to #FF2A35');
    assert(overriddenVars['--app-surface'] === '#122B4D', 'Surface overridden to #122B4D');
    assert(overriddenVars['--app-bg'] === '#0A0D11', 'Unchanged base background #0A0D11 preserved');
    assert(
      overriddenVars['--custom-agency-glow'] === 'rgba(255, 42, 53, 0.6)',
      'Custom CSS variable injected'
    );

    // Clean up
    ThemeLoader.clearOverrides('100hich');
    const restoredVars = ThemeLoader.computeCssVariables('100hich');
    assert(restoredVars['--app-accent'] === '#D71921', 'Restores base accent color after clear');
  }

  // Test 4: DOM Mock Application
  console.log('\n[Suite 4: DOM Mutation & Theme Application]');
  {
    const styleProps: Record<string, string> = {};
    const attributes: Record<string, string> = {};
    const bodyClasses = new Set<string>();

    (globalThis as any).document = {
      documentElement: {
        style: {
          setProperty: (k: string, v: string) => {
            styleProps[k] = v;
          },
        },
        setAttribute: (k: string, v: string) => {
          attributes[k] = v;
        },
      },
      body: {
        classList: {
          add: (c: string) => bodyClasses.add(c),
          remove: (c1: string, c2: string) => {
            bodyClasses.delete(c1);
            bodyClasses.delete(c2);
          },
        },
      },
    };

    const res = ThemeLoader.applyTheme('modendo');
    assert(res.tenantId === 'modendo', 'Result confirms modendo applied');
    assert(attributes['data-tenant'] === 'tenant-modendo-01', 'data-tenant set on documentElement');
    assert(bodyClasses.has('theme-modendo'), 'body class contains theme-modendo');
    assert(styleProps['--app-accent'] === '#005A3E', 'CSS custom property --app-accent applied to root');

    // Switch to 100hich
    ThemeLoader.applyTheme('100hich');
    assert(attributes['data-tenant'] === 'tenant-100hich-01', 'data-tenant updated to 100hich');
    assert(bodyClasses.has('theme-100hich'), 'body class updated to theme-100hich');
    assert(!bodyClasses.has('theme-modendo'), 'body class removed theme-modendo');
    assert(styleProps['--app-accent'] === '#D71921', 'CSS custom property --app-accent updated to 100hich red');
  }

  console.log(`\n========================================`);
  console.log(`ThemeLoader Suite Result: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
