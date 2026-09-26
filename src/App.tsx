import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductsView } from './components/products/ProductsView';
import { ReceiptsView } from './components/operations/ReceiptsView';
import { DeliveryOrdersView } from './components/operations/DeliveryOrdersView';
import { InternalTransfersView } from './components/operations/InternalTransfersView';
import { InventoryAdjustmentsView } from './components/operations/InventoryAdjustmentsView';
import { StockLedgerView } from './components/operations/StockLedgerView';
import { MoveHistoryView } from './components/operations/MoveHistoryView';
import { WarehousesView } from './components/warehouses/WarehousesView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { ForecastsView } from './components/forecasts/ForecastsView';
import { InventoryHealthView } from './components/health/InventoryHealthView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { AIAssistantView } from './components/assistant/AIAssistantView';
import { InventoryAutopilotView } from './components/autopilot/InventoryAutopilotView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { ProfileView } from './components/profile/ProfileView';
import { BarcodeScannerModal } from './components/scanner/BarcodeScannerModal';
import { DemoScenarioModal } from './components/demo/DemoScenarioModal';
import { AuthModal } from './components/auth/AuthModal';
import { PageTransition } from './components/common/PageTransition';
import { Product } from './types/inventory';
import { Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [targetProductForAction, setTargetProductForAction] = useState<Product | null>(null);

  const handleSelectScannerAction = (
    action: 'receive' | 'transfer' | 'deliver' | 'adjust' | 'history',
    product: Product
  ) => {
    setTargetProductForAction(product);
    if (action === 'receive') setCurrentTab('receipts');
    else if (action === 'transfer') setCurrentTab('transfers');
    else if (action === 'deliver') setCurrentTab('deliveries');
    else if (action === 'adjust') setCurrentTab('adjustments');
    else if (action === 'history') setCurrentTab('history');
  };

  const handleGlobalSearch = (query: string) => {
    const q = query.toLowerCase();
    if (q.includes('receipt') || q.includes('received')) {
      setCurrentTab('receipts');
    } else if (q.includes('delivery') || q.includes('order')) {
      setCurrentTab('deliveries');
    } else if (q.includes('transfer')) {
      setCurrentTab('transfers');
    } else if (q.includes('low stock') || q.includes('run out') || q.includes('stockout')) {
      setCurrentTab('forecasts');
    } else if (q.includes('warehouse')) {
      setCurrentTab('warehouses');
    } else if (q.includes('dead') || q.includes('health')) {
      setCurrentTab('health');
    } else if (q.includes('autopilot') || q.includes('recommend')) {
      setCurrentTab('autopilot');
    } else {
      setCurrentTab('products');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Collapsible Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab)}
        onLogout={() => {
          setAuthMode('login');
          setIsAuthOpen(true);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <div className="relative">
          <Header
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenDemo={() => setIsDemoOpen(true)}
            onNavigate={(tab) => setCurrentTab(tab)}
            onSearchQuery={handleGlobalSearch}
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setIsAuthOpen(true);
            }}
          />

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 z-40"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable View Area with Smooth Page Transition */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <PageTransition pageKey={currentTab}>
            {currentTab === 'dashboard' && (
              <DashboardView
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenDemo={() => setIsDemoOpen(true)}
              />
            )}

            {currentTab === 'products' && (
              <ProductsView
                onOpenScannerForProduct={(p) => {
                  setTargetProductForAction(p);
                  setIsScannerOpen(true);
                }}
                onOpenQuickAction={(action, p) => handleSelectScannerAction(action, p)}
              />
            )}

            {currentTab === 'receipts' && <ReceiptsView />}
            {currentTab === 'deliveries' && <DeliveryOrdersView />}
            {currentTab === 'transfers' && <InternalTransfersView />}
            {currentTab === 'adjustments' && <InventoryAdjustmentsView />}
            {currentTab === 'ledger' && <StockLedgerView />}
            {currentTab === 'history' && <MoveHistoryView />}
            {currentTab === 'warehouses' && <WarehousesView />}
            {currentTab === 'analytics' && <AnalyticsView />}
            {currentTab === 'forecasts' && <ForecastsView />}
            {currentTab === 'health' && <InventoryHealthView />}
            {currentTab === 'suppliers' && <SuppliersView />}
            {currentTab === 'assistant' && <AIAssistantView />}
            {currentTab === 'autopilot' && <InventoryAutopilotView />}
            {currentTab === 'reports' && <ReportsView />}
            {currentTab === 'settings' && <SettingsView />}
            {currentTab === 'profile' && (
              <ProfileView
                onOpenAuth={(mode) => {
                  setAuthMode(mode);
                  setIsAuthOpen(true);
                }}
              />
            )}
          </PageTransition>
        </main>
      </div>

      {/* Global Interactive Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectAction={handleSelectScannerAction}
      />

      <DemoScenarioModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onNavigateToTab={(tab) => setCurrentTab(tab)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => setCurrentTab('dashboard')}
      />
    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}
