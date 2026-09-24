export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'sales_rep' | 'supervisor' | 'warehouse' | 'driver';
  avatar: string | null;
  is_active: boolean;
  id_gvari?: number | null;
  presellerMapped?: boolean;
  provider?: string;
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
  product_id?: number;
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
  itemId?: string;
  compRaod?: string | null;
  canRealHalfComp?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ErpVisitSchedule {
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  monNum: number;
  tueNum: number;
  wedNum: number;
  thuNum: number;
  friNum: number;
  satNum: number;
  sunNum: number;
}

export interface ErpVisitPhoto {
  id: number;
  customerId: string;
  customerName: string | null;
  visitId: number | null;
  phase: 'before' | 'end' | 'survey' | 'shelf';
  comment: string | null;
  tags: string[];
  takenAt: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface ErpGalleryPhoto extends ErpVisitPhoto {
  salesUserId: number;
  salesName: string | null;
  signature: string | null;
  reviewComment: string | null;
  rating: number | null;
  rotation: number;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface ErpVisit {
  id: number;
  salesUserId: number;
  customerId: string;
  customerName: string | null;
  status: 'open' | 'arrived' | 'missed';
  startedAt: string | null;
  endedAt: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface ErpTask {
  id: number;
  salesUserId: number;
  salesName: string | null;
  customerId: string | null;
  customerName: string | null;
  photoId: number | null;
  title: string;
  note: string | null;
  dueOn: string | null;
  status: 'open' | 'done';
  completedAt: string | null;
  checkedAt: string | null;
  checkedByName: string | null;
}

export interface ErpVisitSurvey {
  id: number;
  visitId: number;
  salesUserId: number;
  salesName: string | null;
  customerId: string;
  customerName: string | null;
  shelfStocked: boolean;
  priceVisible: boolean;
  promoPresent: boolean;
  competitorSeen: boolean;
}

export interface ErpVisitCoaching {
  id: number;
  visitId: number;
  customerId: string | null;
  customerName: string | null;
  salesUserId: number;
  salesName: string | null;
  supervisorName: string | null;
  rating: number;
  note: string | null;
}

export interface ErpShelfAudit {
  id: number;
  salesUserId: number;
  salesName: string | null;
  customerId: string;
  customerName: string | null;
  visitId: number | null;
  photoId: number | null;
  createdAt: string | null;
  lines: Array<{
    itemId: string;
    itemName: string | null;
    status: 'present' | 'missing' | 'low';
    shelfNo: number | null;
    facings: number;
    readPrice: number | null;
    competitor: boolean;
    box: { x: number; y: number; w: number; h: number } | null;
  }>;
}

export interface ErpPlanogramLine {
  id: number;
  customerId: string | null;
  orgCategoryId: number | null;
  shelfNo: number;
  position: number;
  itemId: string;
  itemName: string | null;
  facings: number;
  targetPrice: number | null;
}

export interface ErpPromoPlan {
  id: number;
  salesUserId: number;
  salesName: string | null;
  customerId: string | null;
  customerName: string | null;
  title: string;
  startsOn: string;
  endsOn: string;
  status: 'planned' | 'active' | 'done';
  photoId: number | null;
  note: string | null;
}

export interface ErpDayReport {
  coverageVisited: number;
  coveragePlanned: number;
  tasksDone: number;
  tasksTotal: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  visits: Array<ErpVisit & { salesName: string | null }>;
}

export interface ErpDashboardRep {
  salesUserId: number;
  salesName: string | null;
  planned: number;
  visited: number;
  coverage: number;
  openTasks: number;
  doneTasks: number;
  checkedTasks: number;
  unreviewedPhotos: number;
  photosToday: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
}

export interface ErpDashboardTotals {
  reps: number;
  planned: number;
  visited: number;
  openVisits: number;
  missedVisits: number;
  openTasks: number;
  doneTasks: number;
  checkedTasks: number;
  overdueTasks: number;
  unreviewedPhotos: number;
  photosToday: number;
  surveyCount: number;
  shelfStocked: number;
  priceVisible: number;
  promoPresent: number;
  competitorSeen: number;
  promoPlanned: number;
  promoActive: number;
  promoDone: number;
}

export interface ErpDashboardNextStop {
  customerId: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface ErpDashboardMe {
  planned: number;
  visited: number;
  openTasks: ErpTask[];
  openTaskCount: number;
  photosToday: Array<{ id: number; phase: string; customerName: string | null; takenAt: string | null }>;
  savedOrders: number;
  openVisit: ErpVisit | null;
  coaching: { rating: number; note: string | null; supervisorName: string | null } | null;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  nextStop: ErpDashboardNextStop | null;
}

export interface ErpFieldDashboard {
  role: string;
  date: string;
  team: ErpDashboardRep[];
  totals: ErpDashboardTotals;
  trend: Array<{ date: string; visits: number; customers: number }>;
  me: ErpDashboardMe | null;
}

export interface PresellerReport {
  days: number;
  from: string;
  to: string;
  visits: {
    finished: number;
    averageMinutes: number | null;
    firstAt: string | null;
    lastAt: string | null;
    byDay: Array<{ date: string; visits: number }>;
  };
  survey: {
    count: number;
    shelfStocked: number;
    priceVisible: number;
    promoPresent: number;
    competitorSeen: number;
  };
  tasks: { open: number; done: number; checked: number; overdue: number };
  photos: { before: number; survey: number; shelf: number; end: number };
  shelf: { audits: number; lines: number };
  promos: { planned: number; active: number; done: number };
  money: {
    collected: number;
    collectionsByDay: Array<{ date: string; amount: number }>;
    returns: number;
    savedOrders: number;
    savedOrdersTotal: number;
  };
  customers: Array<{ customerId: string; customerName: string | null; visits: number }>;
  coaching: {
    count: number;
    averageRating: number | null;
    note: string | null;
    supervisorName: string | null;
  };
}

export interface ErpCustomer {
  customerId: string;
  name: string;
  orgCode: string | null;
  address: string | null;
  phone: string | null;
  city: string | null;
  priceGroup: number;
  sagad: string | null;
  idQseli: number;
  qseli: string | null;
  idOrgT: number;
  orgT: string | null;
  idOrgCategory: number;
  orgCategory: string | null;
  latitude: string | null;
  longitude: string | null;
  useProdList: boolean;
  active: boolean;
  schedule?: ErpVisitSchedule | null;
  kegs?: Array<{ itemId: string; name: string; quantity: string }>;
  balance?: string | null;
  canRealHalfComp?: boolean;
}

export interface ErpItem {
  itemId: string;
  name: string;
  unit: string;
  unitName: string | null;
  prodCode: string | null;
  category: string | null;
  prodS: string | null;
  type: string | null;
  group: string | null;
  unitPrice: string | null;
  priceState: string | null;
  priceError: string | null;
  active: boolean;
  compRaod: string | null;
  canRealHalfComp: boolean | null;
}

export interface ErpProductTaxonomyType {
  name: string;
  count: number;
}

export interface ErpProductTaxonomyGroup {
  name: string;
  count: number;
  types: ErpProductTaxonomyType[];
}

export interface ErpCursorPage<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
  todayTotal?: number;
  allTotal?: number;
}

export interface ErpQuoteLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: string;
  packQuantity?: string;
  pieces?: string;
  compRaod?: string;
  unitPrice: string;
  lineTotal: string;
  /** Informational only: the order is charged at unitPrice. */
  promoUnitPrice: string | null;
  promoDiscount: string | null;
}

export interface ErpPromotionProduct {
  itemId: string;
  name: string;
  kind: 'fixed' | 'percent' | 'add' | 'unknown';
  promoPrice: string | null;
  basis: string | null;
  percent: string | null;
}

export interface ErpPromotion {
  id: string;
  name: string;
  typeId: number;
  typeName: string;
  dateFrom: string | null;
  dateEnd: string | null;
  minQty: number;
  maxQty: number | null;
  fromStandardFasi: boolean;
  percent: string | null;
  appliesToAllProducts: boolean;
  products: ErpPromotionProduct[];
  state: string;
  reason?: string;
}

export interface ErpQuote {
  quoteId: string;
  customerId: string;
  lines: ErpQuoteLine[];
  subtotal: string;
  total: string;
  priceState: 'computed' | 'indicative';
  unresolvedRules: string[];
  /** Sum of the line promoDiscount values; never subtracted from total. */
  promoDiscountTotal: string;
  promotions: Array<{ id: string; name: string; state: string; reason?: string }>;
  /** SagadValiBlockView MinReal/MaxReal; null on a side means the customer has no limit there. */
  orderLimits?: { minTotal: string | null; maxTotal: string | null };
  expiresAt: string;
}

export interface ErpOrderReceipt {
  externalId: string;
  erpOrderId: string;
  status: string;
  message: string;
}

export interface ErpSubmittedOrder {
  erpOrderId: string;
  customerId: string;
  status: string;
  createdAt: string | null;
}

export interface ErpCollection {
  id: number;
  customerId: string;
  customerName?: string | null;
  amount: string;
  method: string;
  note: string | null;
  createdAt: string | null;
}

export interface ErpProductReturnLine {
  itemId: string;
  name: string | null;
  quantity: string;
  reason: string;
}

export interface ErpProductReturn {
  id: number;
  customerId: string;
  customerName?: string | null;
  note: string | null;
  createdAt: string | null;
  lines: ErpProductReturnLine[];
}

export interface ErpSavedOrderLine {
  itemId: string;
  name: string | null;
  packQuantity: string;
  pieces: string;
  unitPrice: string;
  lineTotal: string;
}

export interface ErpSavedOrder {
  id: number;
  customerId: string;
  customerName: string | null;
  total: string;
  note: string | null;
  createdAt: string | null;
  lines: ErpSavedOrderLine[];
}

export interface ErpCartItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string | null;
  compRaod?: string | null;
  canRealHalfComp?: boolean | null;
}

export interface ApiErrorBody {
  success: false;
  code?: string;
  message: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export interface SyncQueueItem {
  id?: number;
  type: 'order' | 'visit';
  data: Record<string, unknown>;
  created_at: string;
  synced: boolean;
}
