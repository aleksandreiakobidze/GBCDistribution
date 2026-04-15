export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'sales_rep' | 'warehouse' | 'driver';
  avatar: string | null;
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  name_ka: string | null;
  slug: string;
  image: string | null;
  sort_order: number;
  products_count?: number;
}

export interface Product {
  id: number;
  name: string;
  name_ka: string | null;
  sku: string;
  barcode: string | null;
  unit: string;
  price: number;
  cost_price: number;
  image: string | null;
  is_active: boolean;
  category?: Category;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  is_default: boolean;
}

export interface InventoryItem {
  id: number;
  warehouse_id: number;
  product?: Product;
  quantity: number;
  reserved_quantity: number;
  min_stock_level: number;
  available: number;
}

export interface StockMovement {
  id: number;
  warehouse_id: number;
  product?: Product;
  type: 'in' | 'out' | 'transfer' | 'adjustment' | 'return';
  quantity: number;
  reference_type: string | null;
  reference_id: number | null;
  user?: User;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  category: 'A' | 'B' | 'C';
  credit_limit: number;
  outstanding_balance: number;
  assigned_sales_rep?: User;
  is_active: boolean;
  orders_count?: number;
}

export interface CustomerVisit {
  id: number;
  customer?: Customer;
  user?: User;
  visited_at: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  order_id: number | null;
  has_order: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  customer?: Customer;
  sales_rep?: User;
  warehouse_id: number;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  offline_id: string | null;
  ordered_at: string;
  items?: OrderItem[];
  delivery?: Delivery;
  invoice?: Invoice;
  created_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'picking' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
}

export interface Delivery {
  id: number;
  order_id: number;
  order?: Order;
  driver?: User;
  status: DeliveryStatus;
  scheduled_date: string;
  delivered_at: string | null;
  signature_image: string | null;
  delivery_photo: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type DeliveryStatus = 'pending' | 'assigned' | 'loading' | 'in_transit' | 'delivered' | 'partial' | 'failed';

export interface Invoice {
  id: number;
  invoice_number: string;
  order_id: number;
  customer?: Customer;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: PaymentStatus;
  payments?: Payment[];
  created_at: string;
}

export type PaymentStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'check';
  paid_at: string;
  reference: string | null;
  received_by?: User;
}

export interface ReturnOrder {
  id: number;
  return_number: string;
  order_id: number;
  customer?: Customer;
  reason: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  total: number;
  items?: ReturnItem[];
  created_at: string;
}

export interface ReturnItem {
  id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  condition: 'damaged' | 'expired' | 'wrong_item' | 'other';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
  active_customers: number;
}

export interface SalesReport {
  total_sales: number;
  total_orders: number;
  average_order_value: number;
  top_products: Array<{ product_id: number; product_name: string; total_quantity: number; total_revenue: number }>;
  sales_by_day: Array<{ date: string; total: number; count: number }>;
}

export interface OrderFormItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'order' | 'visit';
  data: Record<string, unknown>;
  created_at: string;
  synced: boolean;
}
