export type OrderStatus = 'open' | 'sent_to_bar' | 'settled' | 'voided';
export type PaymentMethod = 'cash' | 'pos_terminal' | 'card_to_card' | 'split';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: 'g' | 'ml' | 'piece' | 'kg' | 'liter';
  costPerUnit: number;
  minThreshold: number;
  updatedAt: number;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  amount: number;
}

export interface MenuItem {
  id: string;
  title: string;
  categoryId: string;
  price: number;
  taxRate?: number;
  recipe: RecipeIngredient[];
  isAvailable: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  status: 'pending' | 'preparing' | 'served' | 'cancelled';
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  synced: 0 | 1;
}

export interface AuditLog {
  id: string;
  orderId: string;
  userId: string;
  action: 'create' | 'edit_items' | 'apply_discount' | 'void' | 'settle';
  reason?: string;
  details: string;
  timestamp: number;
}
