export type OrderStatus = 'Draft' | 'Queued' | 'In-Prep' | 'Ready' | 'Dispatched';

export interface ModifierOption {
  id: string;
  nameFa: string;
  priceDelta: number;
}

export interface MenuItem {
  id: string;
  title: string;
  categoryId: string;
  categoryNameFa?: string;
  price: number;
  hotkeyIndex?: number; // 1..9 for rapid hotkey injection
  modifiers?: ModifierOption[];
  isAvailable: boolean;
  notes?: string[];
  imageUrl?: string;
}

export interface SmartTicketItem {
  id: string;
  menuItemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  modifiers?: ModifierOption[];
  modifiersDelta?: number;
  subtotal: number;
  notes?: string;
}

export interface SmartTicket {
  id: string;
  orderNumber: number;
  ticketCode: string; // e.g. #KW-801
  tableLabel?: string;
  customerName?: string;
  status: OrderStatus;
  items: SmartTicketItem[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: number; // Unix timestamp ms
  targetSlaSeconds: number; // e.g. 180s for bar, 300s for kitchen
  isSocketPushed?: boolean;
  isParked?: boolean;
  paymentMethod?: string;
  terminalName?: string;
  notes?: string;
}

export interface TelemetryStats {
  activeTicketsCount: number;
  pendingVolumeToman: number;
  breachedSlaCount: number;
  avgPreparationTimeSec: number;
}

export interface FeaturesConfig {
  ENABLE_ZERO_G_SMART_ORDERS: boolean;
}
