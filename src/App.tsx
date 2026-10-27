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
} from './types/domain';
import { Header } from './components/Header';
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

export default function App() {
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
  const [currentTab, setCurrentTab] = useState<'pos' | 'reports' | 'menu' | 'audit'>('pos');
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
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
    refreshState();
  }, []);

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

  // User Switching
  const handleUserChange = (userId: string) => {
    SmartOrdersStore.setActiveUserId(userId);
    const user = SmartOrdersStore.getActiveUser();
    setActiveUser(user);
    showToast(`کاربر فعال تغییر یافت: ${user.fullName}`);
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

  return (
    <div className="min-h-screen bg-[#121417] text-white flex flex-col font-sans selection:bg-[#D71921] selection:text-white">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-[#1B222C] border-r-4 border-[#D71921] border border-[#293444] text-white font-bold px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 animate-fadeIn">
          <span className="text-[#D71921] text-base">●</span>
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
        onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenBaristaKds={() => setIsBaristaKdsOpen(true)}
        baristaActiveCount={baristaActiveCount}
        onUserChange={handleUserChange}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-10">
        {currentTab === 'pos' && (
          <PosView
            tenant={tenant}
            categories={categories}
            menuItems={menuItems}
            activeShift={activeShift}
            activeUser={activeUser}
            onOrderCompleted={handleOrderCompleted}
            onOpenShiftRequired={() => setIsShiftModalOpen(true)}
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
      </main>

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
