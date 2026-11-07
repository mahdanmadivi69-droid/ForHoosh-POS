// tests/i18n.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useI18n } from '../src/i18n/I18nContext';
import { LanguageSelector } from '../src/components/LanguageSelector';

const TestConsumerComponent: React.FC = () => {
  const { t, locale, dir, interpolate } = useI18n();
  return (
    <div>
      <LanguageSelector />
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="current-dir">{dir}</span>
      <span data-testid="pos-subtotal">{t.pos.subtotal}</span>
      <span data-testid="interpolated">
        {interpolate(t.pos.tableAttached, { table: 'T5' })}
      </span>
    </div>
  );
};

describe('KarWand i18n System (EN / FA Dual Architecture)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders English by default with LTR layout', () => {
    render(
      <I18nProvider defaultLocale="en">
        <TestConsumerComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('current-locale').textContent).toBe('en');
    expect(screen.getByTestId('current-dir').textContent).toBe('ltr');
    expect(screen.getByTestId('pos-subtotal').textContent).toBe('Total Amount');
    expect(screen.getByTestId('interpolated').textContent).toBe(
      'Table T5 attached via hardware scanner'
    );
  });

  it('switches to Persian (FA) and updates direction to RTL', () => {
    render(
      <I18nProvider defaultLocale="en">
        <TestConsumerComponent />
      </I18nProvider>
    );

    const faButton = screen.getByTitle('Persian');
    act(() => {
      faButton.click();
    });

    expect(screen.getByTestId('current-locale').textContent).toBe('fa');
    expect(screen.getByTestId('current-dir').textContent).toBe('rtl');
    expect(screen.getByTestId('pos-subtotal').textContent).toBe('جمع کل سفارش');
    expect(screen.getByTestId('interpolated').textContent).toBe(
      'میز T5 با اسکنر سختافزاری انتخاب شد'
    );
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('switches back from Persian (FA) to English (EN) and restores LTR direction', () => {
    render(
      <I18nProvider defaultLocale="fa">
        <TestConsumerComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId('current-locale').textContent).toBe('fa');
    expect(screen.getByTestId('current-dir').textContent).toBe('rtl');

    const enButton = screen.getByTitle('English');
    act(() => {
      enButton.click();
    });

    expect(screen.getByTestId('current-locale').textContent).toBe('en');
    expect(screen.getByTestId('current-dir').textContent).toBe('ltr');
    expect(screen.getByTestId('pos-subtotal').textContent).toBe('Total Amount');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
