import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PosCheckoutView, CartItem } from '../src/components/PosCheckoutView';

describe('PosCheckoutView Hardware Scanner Integration', () => {
  const mockTenantId = 'tenant-100hich-01';
  const mockCart: CartItem[] = [
    { id: '1', name: 'کورتادو', quantity: 2, unitPrice: 120000 },
    { id: '2', name: 'لاته', quantity: 1, unitPrice: 140000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-switch active table to T8 upon rapid hardware scanner burst', () => {
    const onTableChange = vi.fn();
    const onDispatchOrder = vi.fn();

    render(
      <PosCheckoutView
        currentTenantId={mockTenantId}
        cartItems={mockCart}
        onTableChange={onTableChange}
        onDispatchOrder={onDispatchOrder}
      />
    );

    // Initial table check
    expect(screen.getByTestId('active-table-badge').textContent).toBe('T1');

    // Simulate high-speed hardware scanner stream (<40ms interval)
    const rawBarcode = 'KW:tenant-100hich-01:T8:signature999';
    let mockTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 15;
      return mockTime;
    });

    act(() => {
      for (const char of rawBarcode) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // Verify state mutation and callback trigger
    expect(screen.getByTestId('active-table-badge').textContent).toBe('T8');
    expect(onTableChange).toHaveBeenCalledWith('T8');
    expect(screen.getByTestId('scanner-notification-banner')).toBeDefined();
    expect(
      screen.getByTestId('scanner-notification-banner').textContent
    ).toContain('میز T8 با اسکنر');
  });

  it('should reject table token belonging to a different tenant', () => {
    const onTableChange = vi.fn();
    const onDispatchOrder = vi.fn();

    render(
      <PosCheckoutView
        currentTenantId="tenant-100hich-01"
        cartItems={mockCart}
        onTableChange={onTableChange}
        onDispatchOrder={onDispatchOrder}
      />
    );

    const alienBarcode = 'KW:tenant-modendo-01:T14:other';
    let mockTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 12;
      return mockTime;
    });

    act(() => {
      for (const char of alienBarcode) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // Table must NOT change
    expect(screen.getByTestId('active-table-badge').textContent).toBe('T1');
    expect(onTableChange).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('scanner-notification-banner').textContent
    ).toContain('بارکد نامعتبر');
  });

  it('should calculate cart total in integer Toman precision and dispatch order', async () => {
    const onTableChange = vi.fn();
    const onDispatchOrder = vi.fn().mockResolvedValue(undefined);

    render(
      <PosCheckoutView
        currentTenantId={mockTenantId}
        cartItems={mockCart}
        onTableChange={onTableChange}
        onDispatchOrder={onDispatchOrder}
      />
    );

    // subtotal = (2 * 120,000) + (1 * 140,000) = 380,000
    const dispatchButton = screen.getByRole('button', { name: /ثبت و ارسال سفارش/ });
    expect(dispatchButton).toBeDefined();

    await act(async () => {
      dispatchButton.click();
    });

    expect(onDispatchOrder).toHaveBeenCalledWith({
      tableNumber: 'T1',
      items: mockCart,
      subtotal: 380000,
    });
  });

  it('should allow manual table switching via UI buttons', () => {
    const onTableChange = vi.fn();
    const onDispatchOrder = vi.fn();

    render(
      <PosCheckoutView
        currentTenantId={mockTenantId}
        cartItems={mockCart}
        onTableChange={onTableChange}
        onDispatchOrder={onDispatchOrder}
      />
    );

    const barButton = screen.getByRole('button', { name: 'BAR' });
    act(() => {
      barButton.click();
    });

    expect(screen.getByTestId('active-table-badge').textContent).toBe('BAR');
    expect(onTableChange).toHaveBeenCalledWith('BAR');
  });
});
