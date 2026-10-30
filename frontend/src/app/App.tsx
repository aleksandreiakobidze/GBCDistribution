import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';
import { AuthGuard } from './AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui';
import { ShelfSync } from '@/features/shelf/ShelfSync';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const FieldSettingsPage = lazy(() => import('@/features/settings/pages/FieldSettingsPage'));
const PlanPage = lazy(() => import('@/features/plan/pages/PlanPage'));
const MonitoringPage = lazy(() => import('@/features/monitoring/pages/MonitoringPage'));
const MonitoringOrdersPage = lazy(() => import('@/features/monitoring/pages/MonitoringOrdersPage'));
const MonitoringOrderPage = lazy(() => import('@/features/monitoring/pages/MonitoringOrderPage'));
const MonitoringOrgPage = lazy(() => import('@/features/monitoring/pages/MonitoringOrgPage'));
const ProfilePage = lazy(() => import('@/features/auth/pages/ProfilePage'));
const ProductListPage = lazy(() => import('@/features/products/pages/ProductListPage'));
const ProductDetailPage = lazy(() => import('@/features/products/pages/ProductDetailPage'));
const CustomerListPage = lazy(() => import('@/features/customers/pages/CustomerListPage'));
const CustomerDetailPage = lazy(() => import('@/features/customers/pages/CustomerDetailPage'));
const CollectPaymentPage = lazy(() => import('@/features/customers/pages/CollectPaymentPage'));
const CreateErpReturnPage = lazy(() => import('@/features/customers/pages/CreateErpReturnPage'));
const CustomerPromotionsPage = lazy(() => import('@/features/customers/pages/CustomerPromotionsPage'));
const CustomerFormPage = lazy(() => import('@/features/customers/pages/CustomerFormPage'));
const RoutesPage = lazy(() => import('@/features/customers/pages/RoutesPage'));
const GalleryPage = lazy(() => import('@/features/gallery/pages/GalleryPage'));
const TasksPage = lazy(() => import('@/features/field/pages/TasksPage'));
const DayPage = lazy(() => import('@/features/field/pages/DayPage'));
const PromoCalendarPage = lazy(() => import('@/features/field/pages/PromoCalendarPage'));
const OrderListPage = lazy(() => import('@/features/orders/pages/OrderListPage'));
const CreateOrderPage = lazy(() => import('@/features/orders/pages/CreateOrderPage'));
const SavedOrderDetailPage = lazy(() => import('@/features/orders/pages/SavedOrderDetailPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'));
const ErpOrderStatusPage = lazy(() => import('@/features/orders/pages/ErpOrderStatusPage'));

const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage'));
const StockMovementPage = lazy(() => import('@/features/inventory/pages/StockMovementPage'));
const DeliveryListPage = lazy(() => import('@/features/deliveries/pages/DeliveryListPage'));
const DeliveryDetailPage = lazy(() => import('@/features/deliveries/pages/DeliveryDetailPage'));
const InvoiceListPage = lazy(() => import('@/features/invoices/pages/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/pages/InvoiceDetailPage'));
const ReturnListPage = lazy(() => import('@/features/returns/pages/ReturnListPage'));
const ErpReturnDetailPage = lazy(() => import('@/features/returns/pages/ErpReturnDetailPage'));
const CollectionListPage = lazy(() => import('@/features/collections/pages/CollectionListPage'));
const CollectionDetailPage = lazy(() => import('@/features/collections/pages/CollectionDetailPage'));
const MyReportsPage = lazy(() => import('@/features/reports/pages/MyReportsPage'));
const SalesReportPage = lazy(() => import('@/features/reports/pages/SalesReportPage'));
const InventoryReportPage = lazy(() => import('@/features/reports/pages/InventoryReportPage'));
const PerformanceReportPage = lazy(() => import('@/features/reports/pages/PerformanceReportPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}

function ThemeInit() {
  const { theme, setTheme } = useUiStore();
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInit />
      <ShelfSync />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route element={<AuthGuard />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="settings" element={<FieldSettingsPage />} />
                <Route path="plan" element={<PlanPage />} />
                <Route path="monitoring/orders/:orderId" element={<MonitoringOrderPage />} />
                <Route path="monitoring/orders" element={<MonitoringOrdersPage />} />
                <Route path="monitoring/:userId/:idOrg" element={<MonitoringOrgPage />} />
                <Route path="monitoring" element={<MonitoringPage />} />

                <Route path="products" element={<ProductListPage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />

                <Route path="customers" element={<CustomerListPage />} />
                <Route path="customers/new" element={<CustomerFormPage />} />
                <Route path="customers/:id/collect" element={<CollectPaymentPage />} />
                <Route path="customers/:id/return" element={<CreateErpReturnPage />} />
                <Route path="customers/:id/promotions" element={<CustomerPromotionsPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="routes" element={<RoutesPage />} />
                <Route path="gallery" element={<GalleryPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="day" element={<DayPage />} />
                <Route path="promos" element={<PromoCalendarPage />} />

                <Route path="orders" element={<OrderListPage />} />
                <Route path="orders/new" element={<CreateOrderPage />} />
                <Route path="orders/saved/:id/edit" element={<CreateOrderPage />} />
                <Route path="orders/saved/:id" element={<SavedOrderDetailPage />} />
                <Route path="orders/erp/:erpOrderId" element={<ErpOrderStatusPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />

                <Route path="inventory" element={<InventoryPage />} />
                <Route path="inventory/movements" element={<StockMovementPage />} />

                <Route path="deliveries" element={<DeliveryListPage />} />
                <Route path="deliveries/:id" element={<DeliveryDetailPage />} />

                <Route path="invoices" element={<InvoiceListPage />} />
                <Route path="invoices/:id" element={<InvoiceDetailPage />} />

                <Route path="returns" element={<ReturnListPage />} />
                <Route path="returns/new" element={<CreateErpReturnPage />} />
                <Route path="returns/:id/edit" element={<CreateErpReturnPage />} />
                <Route path="returns/:id" element={<ErpReturnDetailPage />} />

                <Route path="collections" element={<CollectionListPage />} />
                <Route path="collections/new" element={<CollectPaymentPage />} />
                <Route path="collections/:id/edit" element={<CollectPaymentPage />} />
                <Route path="collections/:id" element={<CollectionDetailPage />} />

                <Route path="my-reports" element={<MyReportsPage />} />
                <Route path="reports" element={<SalesReportPage />} />
                <Route path="reports/inventory" element={<InventoryReportPage />} />
                <Route path="reports/performance" element={<PerformanceReportPage />} />

                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
