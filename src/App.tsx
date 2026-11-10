import { PinLockScreen } from './components/auth/PinLockScreen';
import { AppLauncherHub } from './components/hub/AppLauncherHub';
import { HichSettingsControlDeck } from './views/settings/HichSettingsControlDeck';
import { AuthUserRecord } from './types/rbac-settings';
/**
 * SmartOrders - Point of Sale (POS) and Operational Management System
 * Core Application Entrypoint
 */

import React, { useState, useEffect } from 'react';
import { SmartOrdersStore } from './services/storage';
import {
  Tenant,
  User,
  Category,
  MenuItem,
  Shift,
  Order,
  Payment,
  Expense,
  AuditLog,
  PaymentMethod,
  isManagerOrOwner,
} from './types/domain';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { PosView } from './components/PosView';
import { ShiftModal } from './components/ShiftModal';
import { ExpenseModal } from './components/ExpenseModal';
import { ReportsView } from './components/ReportsView';
import { MenuManagement } from './components/MenuManagement';
import { AuditLogView } from './components/AuditLogView';
import { BackupModal } from './components/BackupModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BaristaKdsModal } from './components/BaristaKdsModal';
import { baristaDispatcher } from './services/baristaDispatcher';
import { InventoryAlertBanner } from './components/InventoryAlertBanner';
import { useInventoryAlerts } from './hooks/useInventoryAlerts';
import { SmartOrdersContainer, FEATURES } from './modules/smart-orders';
import { InventoryManagerView } from './components/InventoryManagerView';
import { SettingsView } from './views/settings/SettingsView';
import { ZReportModal } from './components/modals/ZReportModal';
import { RBACService } from './services/RBACService';
import { SettingsService } from './services/settingsService';
import { FloorPlanView } from './components/floorplan/FloorPlanView';
import { dailyBackupScheduler } from './services/dailyBackupScheduler';
import { ExecutivePLBoard } from './components/ExecutivePLBoard';
import { TenantConfigBuilder } from './components/TenantConfigBuilder';
import { getActiveTenant } from './config/tenantConfig';

export default function App() {
  const activeTenant = getActiveTenant();
  const [tenant, setTenant] = useState<Tenant>(SmartOrdersStore.getTenant());
  const [allUsers, setAllUsers] = useState<User[]>(SmartOrdersStore.getUsers());
  const [activeUser, setActiveUser] = useState<User>(SmartOrdersStore.getActiveUser());
  const [categories, setCategories] = useState<Category[]>(SmartOrdersStore.getCategories());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(SmartOrdersStore.getMenuItems());
  const [shifts, setShifts] = useState<Shift[]>(SmartOrdersStore.getShifts());
  const [activeShift, setActiveShift] = useState<Shift | null>(SmartOrdersStore.getActiveShift());
  const [orders, setOrders] = useState<Order[]>(SmartOrdersStore.getOrders());
  const [payments, setPayments] = useState<Payment[]>(SmartOrdersStore.getPayments());
  const [expenses, setExpenses] = useState<Expense[]>(SmartOrdersStore.getExpenses());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SmartOrdersStore.getAuditLogs());

  // UI state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(SmartOrdersStore.isAuthenticated());
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [pendingSwitchUserId, setPendingSwitchUserId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'hub' | 'pos' | 'zero-g' | 'floor-plan' | 'reports' | 'menu' | 'audit' | 'inventory' | 'settings' | 'executive-pl'>('pos');
  const [isTenantConfigOpen, setIsTenantConfigOpen] = useState(false);
  const [preselectedTableLabel, setPreselectedTableLabel] = useState<string | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBaristaKdsOpen, setIsBaristaKdsOpen] = useState(false);
  const [baristaActiveCount, setBaristaActiveCount] = useState<number>(0);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setFeedbackToast(message);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Inventory Stock Alerts Hook
  const { alerts: inventoryAlerts, dismissAlert, markAsSoldOut } = useInventoryAlerts(
    menuItems,
    5,
    (updated) => {
      refreshState();
      showToast(`آیتم ${updated.nameFa} ناموجود شد.`);
    }
  );

  // Subscribe to live Barista tickets
  useEffect(() => {
    const unsub = baristaDispatcher.subscribe((tickets) => {
      const active = tickets.filter((t) => t.prepStatus !== 'READY').length;
      setBaristaActiveCount(active);
    });
    return () => unsub();
  }, []);

  // Initialize seed data on startup
  useEffect(() => {
    SmartOrdersStore.initSeedData();
    SmartOrdersStore.migrateLegacyUserPasswords().catch(() => {});
    RBACService.initDefaultUsers();
    SettingsService.initDefaults();
    dailyBackupScheduler.init();
    refreshState();
  }, []);

  // Sync active tenant from tenantConfig runtime
  useEffect(() => {
    const targetTenantId = activeTenant.id === 'modendo' ? 'tenant-modendo-01' : 'tenant-100hich-01';
    if (SmartOrdersStore.getActiveTenantId() !== targetTenantId) {
      SmartOrdersStore.switchTenant(targetTenantId);
      refreshState();
    }
  }, [activeTenant.id]);

  const refreshState = () => {
    setTenant(SmartOrdersStore.getTenant());
    setAllUsers(SmartOrdersStore.getUsers());
    setActiveUser(SmartOrdersStore.getActiveUser());
    setCategories(SmartOrdersStore.getCategories());
    setMenuItems(SmartOrdersStore.getMenuItems());
    const allShifts = SmartOrdersStore.getShifts();
    setShifts(allShifts);
    setActiveShift(SmartOrdersStore.getActiveShift());
    setOrders(SmartOrdersStore.getOrders());
    setPayments(SmartOrdersStore.getPayments());
    setExpenses(SmartOrdersStore.getExpenses());
    setAuditLogs(SmartOrdersStore.getAuditLogs());
  };

  // RBAC Tab Protection Guard
  useEffect(() => {
    if (
      !isManagerOrOwner(activeUser.role) &&
      (currentTab === 'menu' || currentTab === 'audit' || currentTab === 'inventory' || currentTab === 'reports')
    ) {
      setCurrentTab('pos');
      showToast('دسترسی به بخش مدیریت منو، انبارداری، حسابرسی و گزارش مالی فقط برای مدیر و مالک مجاز است.');
    }
  }, [activeUser.role, currentTab]);
  // 100 HICH Route Guard: strictly forbid floor-plan or executive-pl
  useEffect(() => {
    if (currentTab === 'floor-plan' || currentTab === 'executive-pl' || currentTab === 'zero-g') {
      setCurrentTab('pos');
    }
  }, [currentTab]);


  // User Authentication Handlers
  const handleLockTerminal = () => {
    setIsLocked(true);
    showToast('ترمینال قفل شد.');
  };

  const handleLogout = () => {
    SmartOrdersStore.logout();
    setIsAuthenticated(false);
    showToast('شما با موفقیت از سیستم خارج شدید.');
  };

  // User Switching (Strict Security Guard: always routes via PIN switch request)
  const handleUserChange = (userId: string) => {
    handleUserSwitchRequest(userId);
  };

  // User Switching with Strict Security Lock & PIN Verification
  const handleUserSwitchRequest = (targetUserId: string) => {
    setPendingSwitchUserId(targetUserId);
    setIsLocked(true);
    showToast('برای تغییر کاربر، لطفاً PIN امنیتی حساب را وارد نمایید.');
  };

  // Shift Management Handlers
  const handleOpenShift = (openingCashToman: number, notes?: string) => {
    try {
      const newShift = SmartOrdersStore.openShift(openingCashToman, notes);
      refreshState();
      showToast(`شیفت کاری با موجودی ${openingCashToman.toLocaleString('fa-IR')} تومان باز شد.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseShift = (
    shiftId: string,
    actualCountedCashToman: number,
    expectedCashToman: number,
    discrepancyReason?: string,
    notes?: string
  ) => {
    try {
      SmartOrdersStore.closeShift(
        shiftId,
        actualCountedCashToman,
        expectedCashToman,
        discrepancyReason,
        notes
      );
      refreshState();
      showToast('شیفت کاری بسته و گزارش نهایی ثبت شد.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // POS Order & Payment Handlers
  const handleOrderCompleted = (
    orderData: Order,
    paymentMethod: PaymentMethod,
    referenceCode?: string,
    terminalName?: string
  ): { order: Order; payment: Payment } | null => {
    try {
      if (!activeShift) {
        setIsShiftModalOpen(true);
        return null;
      }

      // 1. Create order
      const createdOrder = SmartOrdersStore.createOrder({
        tenantId: activeShift.tenantId,
        shiftId: activeShift.id,
        createdByUserId: activeUser.id,
        createdByUserName: activeUser.fullName,
        orderType: orderData.orderType,
        tableLabel: orderData.tableLabel,
        customerName: orderData.customerName,
        status: 'COMPLETED',
        items: orderData.items,
        grossAmountToman: orderData.grossAmountToman,
        discountAmountToman: orderData.discountAmountToman,
        netTotalToman: orderData.netTotalToman,
      });

      // 2. Record payment
      const newPayment = SmartOrdersStore.recordPayment({
        tenantId: activeShift.tenantId,
        orderId: createdOrder.id,
        shiftId: activeShift.id,
        receivedByUserId: activeUser.id,
        amountToman: createdOrder.netTotalToman,
        paymentMethod,
        referenceCode,
        terminalName,
        status: 'SUCCESSFUL',
      });

      refreshState();
      showToast(`سفارش #${createdOrder.orderNumber} با موفقیت تسویه شد.`);
      return { order: createdOrder, payment: newPayment };
    } catch (err: any) {
      showToast(`ثبت فاکتور انجام نشد — وجهی دریافت نکنید: ${err.message}`);
      alert(err.message);
      return null;
    }
  };

  // Expense Recording
  const handleSaveExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    try {
      SmartOrdersStore.recordExpense(expenseData);
      refreshState();
      showToast('هزینه تنخواه با موفقیت ثبت شد.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Menu Management
  const handleSaveMenuItem = (item: MenuItem) => {
    try {
      SmartOrdersStore.updateMenuItem(item);
      refreshState();
      showToast(`آیتم ${item.nameFa} با موفقیت ذخیره شد.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Order Cancellation Handler (Manager / Owner)
  const handleCancelOrder = (orderId: string, reason: string) => {
    try {
      SmartOrdersStore.cancelOrder(orderId, reason);
      refreshState();
      showToast('سفارش با موفقیت ابطال و مبالغ آن برگشت داده شد.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 1. Initial Authentication & PIN Gate: Default entry point when app starts or when locked
  if (isLocked || !isAuthenticated) {
    return (
      <PinLockScreen
        initialUserId={pendingSwitchUserId}
        onUnlockSuccess={(unlockedUser: AuthUserRecord) => {
          const currentStoreUsers = SmartOrdersStore.getUsers();
          let matched: User | undefined = currentStoreUsers.find(
            (u) => u.id === unlockedUser.id || u.username === unlockedUser.username || u.fullName === unlockedUser.fullName
          );
          if (!matched) {
            matched = {
              id: unlockedUser.id,
              tenantId: SmartOrdersStore.getActiveTenantId(),
              fullName: unlockedUser.fullName,
              username: unlockedUser.username,
              phoneNumber: unlockedUser.phoneNumber || '09120000000',
              role: unlockedUser.role as any,
              isActive: true,
            };
            SmartOrdersStore.addUser(matched);
          }
          SmartOrdersStore.setActiveUserId(matched.id);
          setActiveUser(matched);
          setIsAuthenticated(true);
          setIsLocked(false);
          setPendingSwitchUserId(null);
          setCurrentTab('pos');
          refreshState();
          showToast(`ترمینال بازگشایی شد: خوش آمدید ${unlockedUser.fullName}`);
        }}
        venueTitle="قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)"
        deviceId="TERM-01-MAIN"
      />
    );
  }

  // 2. 4-Way App Launcher Hub
  if (currentTab === 'hub') {
    return (
      <AppLauncherHub
        activeUser={activeUser}
        onSelectApp={(tab: any) => setCurrentTab(tab)}
        onLock={handleLockTerminal}
        activeShift={activeShift}
        venueTitle="قهوه‌فروشی ۱۰۰ هیچ (شعبه یوسف‌آباد)"
        deviceId="TERM-01-MAIN"
      />
    );
  }

  return (
    <div
      data-tenant={tenant.id}
      style={{
        ['--app-bg' as any]: activeTenant.palette.primaryBg,
        ['--app-surface' as any]: activeTenant.palette.surfaceBg,
        ['--app-accent' as any]: activeTenant.palette.accentColor,
        ['--app-text' as any]: activeTenant.palette.textPrimary,
        ['--app-border' as any]: activeTenant.palette.borderHairline,
        ['--color-surface-base' as any]: activeTenant.palette.primaryBg,
        ['--color-brand-primary' as any]: activeTenant.palette.accentColor,
        ['--color-header-bg' as any]: activeTenant.palette.surfaceBg,
        backgroundColor: activeTenant.palette.primaryBg,
        color: activeTenant.palette.textPrimary,
      } as React.CSSProperties}
      className="min-h-screen bg-[var(--color-surface-base,var(--app-bg,#070A0F))] text-white flex flex-col font-sans relative overflow-x-hidden selection:bg-[var(--color-brand-primary)] selection:text-white"
    >
      {/* Apple VisionOS Ambient Luminous Mesh Underlay */}
      <div className="vision-ambient-mesh" aria-hidden="true">
        <div className="vision-ambient-orb vision-orb-carmine" />
        <div className="vision-ambient-orb vision-orb-navy" />
        <div className="vision-ambient-orb vision-orb-gold" />
      </div>

      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-[var(--color-surface-card,#1B222C)] border-r-4 border-[var(--color-brand-primary,#D71921)] border border-[var(--color-surface-border,#293444)] text-white font-bold px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 animate-fadeIn">
          <span className="text-[var(--color-brand-primary,#D71921)] text-base">●</span>
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Global Inventory Stock Alert Floating Banner */}
      <InventoryAlertBanner
        alerts={inventoryAlerts}
        onDismiss={dismissAlert}
        onMarkAsSoldOut={markAsSoldOut}
      />

      {/* Main Header */}
      <Header
        tenant={tenant}
        activeShift={activeShift}
        activeUser={activeUser}
        allUsers={allUsers}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
        onOpenZReportModal={() => setIsZReportModalOpen(true)}
        onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenBaristaKds={() => setIsBaristaKdsOpen(true)}
        baristaActiveCount={baristaActiveCount}
        onUserChange={handleUserChange}
        onUserSwitchRequest={handleUserSwitchRequest}
        onLockTerminal={handleLockTerminal}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-10">
        {currentTab === 'zero-g' && (
          FEATURES.ENABLE_ZERO_G_SMART_ORDERS ? (
            <SmartOrdersContainer
              onBackToStandardPos={() => setCurrentTab('pos')}
            />
          ) : (
            <PosView
              tenant={tenant}
              categories={categories}
              menuItems={menuItems}
              activeShift={activeShift}
              activeUser={activeUser}
              onOrderCompleted={handleOrderCompleted}
              onOpenShiftRequired={() => setIsShiftModalOpen(true)}
              onOpenZReport={() => setIsZReportModalOpen(true)}
              preselectedTableLabel={preselectedTableLabel}
            />
          )
        )}

        {currentTab === 'pos' && (
          <PosView
            tenant={tenant}
            categories={categories}
            menuItems={menuItems}
            activeShift={activeShift}
            activeUser={activeUser}
            onOrderCompleted={handleOrderCompleted}
            onOpenShiftRequired={() => setIsShiftModalOpen(true)}
            onOpenZReport={() => setIsZReportModalOpen(true)}
            preselectedTableLabel={preselectedTableLabel}
          />
        )}



        {currentTab === 'reports' && (
          <ReportsView
            tenant={tenant}
            shifts={shifts}
            orders={orders}
            payments={payments}
            expenses={expenses}
            activeUser={activeUser}
            onCancelOrder={handleCancelOrder}
          />
        )}

        {currentTab === 'menu' && (
          <MenuManagement
            categories={categories}
            menuItems={menuItems}
            activeUser={activeUser}
            onSaveItem={handleSaveMenuItem}
          />
        )}

        {currentTab === 'audit' && (
          <AuditLogView logs={auditLogs} onRefreshLogs={refreshState} />
        )}

        {currentTab === 'inventory' && (
          <InventoryManagerView
            menuItems={menuItems}
            onBackToPos={() => setCurrentTab('pos')}
          />
        )}



        {currentTab === 'settings' && (
          <SettingsView
            currentUserRole={activeUser.role as any}
            currentUserName={activeUser.fullName}
            onBackToPos={() => setCurrentTab('pos')}
            onRoleSwitch={(newRole) => {
              const matched = allUsers.find((u) => u.role === newRole);
              if (matched) {
                handleUserSwitchRequest(matched.id);
              } else {
                showToast(`کاربری با نقش ${newRole} برای ورود امن یافت نشد.`);
              }
            }}
          />
        )}
      </main>

      {/* SaaS Dynamic Tenant Intake Modal */}
      {isTenantConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-5xl my-8">
            <TenantConfigBuilder
              onClose={() => setIsTenantConfigOpen(false)}
              onProvisionComplete={(res) => {
                showToast(`شعبه جدید ${res.tenantId} با موفقیت ایجاد و فعال شد.`);
                refreshState();
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        tenant={tenant}
        activeShift={activeShift}
        activeUser={activeUser}
        orders={orders}
        payments={payments}
        expenses={expenses}
        onOpenShift={handleOpenShift}
        onCloseShift={handleCloseShift}
      />

      {/* Official Z-Report Closeout Modal */}
      <ZReportModal
        isOpen={isZReportModalOpen}
        onClose={() => setIsZReportModalOpen(false)}
        activeShift={activeShift}
        activeUser={activeUser}
        onConfirmCloseShift={(shiftId, countedCash, expectedCash, reason, notes) => {
          handleCloseShift(shiftId, countedCash, expectedCash, reason, notes);
          setIsZReportModalOpen(false);
        }}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        activeShift={activeShift}
        activeUser={activeUser}
        onSaveExpense={handleSaveExpense}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        activeUser={activeUser}
        onDataRestored={refreshState}
      />

      {/* Barista Bar (KDS) Screen Modal */}
      <BaristaKdsModal
        isOpen={isBaristaKdsOpen}
        onClose={() => setIsBaristaKdsOpen(false)}
        tenantName={tenant.name}
      />

      {/* Offline Status Connectivity Badge */}
      <OfflineIndicator />
    </div>
  );
}
