import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatusBarBadge } from '../src/components/SyncStatusBarBadge';

describe('SyncStatusBarBadge UI Component', () => {
  it('renders synchronized state cleanly', () => {
    render(
      <SyncStatusBarBadge
        status={{
          isSyncing: false,
          pendingCount: 0,
          isLockedOut: false,
          lastSyncAt: Date.now(),
          lastError: null,
        }}
      />
    );
    expect(screen.getByText('همگام')).toBeDefined();
  });

  it('renders pending queue indicator and invokes manual flush on click', () => {
    const handleFlush = vi.fn();
    render(
      <SyncStatusBarBadge
        status={{
          isSyncing: false,
          pendingCount: 4,
          isLockedOut: false,
          lastSyncAt: null,
          lastError: null,
        }}
        onManualFlush={handleFlush}
      />
    );

    expect(screen.getByText('4 سفارش در صف ارسال')).toBeDefined();
    fireEvent.click(screen.getByText('4 سفارش در صف ارسال'));
    expect(handleFlush).toHaveBeenCalledTimes(1);
  });

  it('renders suspended cloud lock status accurately', () => {
    render(
      <SyncStatusBarBadge
        status={{
          isSyncing: false,
          pendingCount: 1,
          isLockedOut: true,
          lastSyncAt: null,
          lastError: 'Plan suspended',
        }}
      />
    );
    expect(screen.getByText('تعلیق ابری (نیاز به تمدید)')).toBeDefined();
  });
});
