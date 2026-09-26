import {
  Product,
  Warehouse,
  Supplier,
  Receipt,
  DeliveryOrder,
  InternalTransfer,
  InventoryAdjustment,
  StockLedgerEntry,
  Recommendation,
  AnomalyRecord,
  NotificationItem,
  AuditLogEntry,
  User,
  SavedAccount,
} from '../types/inventory';
import {
  INITIAL_PRODUCTS,
  INITIAL_WAREHOUSES,
  INITIAL_SUPPLIERS,
  INITIAL_RECEIPTS,
  INITIAL_DELIVERIES,
  INITIAL_TRANSFERS,
  INITIAL_ADJUSTMENTS,
  INITIAL_LEDGER,
  INITIAL_RECOMMENDATIONS,
  INITIAL_ANOMALIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS,
  INITIAL_SAVED_ACCOUNTS,
} from '../data/mockData';

export interface StockSenseStoreData {
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  receipts: Receipt[];
  deliveries: DeliveryOrder[];
  transfers: InternalTransfer[];
  adjustments: InventoryAdjustment[];
  ledger: StockLedgerEntry[];
  recommendations: Recommendation[];
  anomalies: AnomalyRecord[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
  users: User[];
  savedAccounts: SavedAccount[];
  rememberedEmail?: string;
  currentUserId: string;
  theme: 'dark' | 'light';
  lastSavedAt: string;
  offlineSyncQueue: any[];
}

const STORAGE_KEY = 'STOCKSENSE_STORAGE_DATA_V1';

export const OfflineStorageService = {
  loadData(): StockSenseStoreData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
          // Ensure users and savedAccounts exist in case of migrating older storage
          if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
            parsed.users = INITIAL_USERS;
          }
          if (!Array.isArray(parsed.savedAccounts)) {
            parsed.savedAccounts = INITIAL_SAVED_ACCOUNTS;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read from local storage, falling back to seed data:', e);
    }

    const defaultData: StockSenseStoreData = {
      products: INITIAL_PRODUCTS,
      warehouses: INITIAL_WAREHOUSES,
      suppliers: INITIAL_SUPPLIERS,
      receipts: INITIAL_RECEIPTS,
      deliveries: INITIAL_DELIVERIES,
      transfers: INITIAL_TRANSFERS,
      adjustments: INITIAL_ADJUSTMENTS,
      ledger: INITIAL_LEDGER,
      recommendations: INITIAL_RECOMMENDATIONS,
      anomalies: INITIAL_ANOMALIES,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
      users: INITIAL_USERS,
      savedAccounts: INITIAL_SAVED_ACCOUNTS,
      rememberedEmail: 'sarah.manager@stocksense.io',
      currentUserId: 'usr-1', // Default to Sarah Connor (Manager)
      theme: 'dark',
      lastSavedAt: new Date().toISOString(),
      offlineSyncQueue: [],
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    } catch (err) {
      console.warn('Failed to initialize localStorage:', err);
    }

    return defaultData;
  },

  saveData(data: StockSenseStoreData): boolean {
    try {
      const payload = {
        ...data,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error('Error saving StockSense offline storage data:', e);
      return false;
    }
  },

  resetToDefaultData(): StockSenseStoreData {
    const defaultData: StockSenseStoreData = {
      products: INITIAL_PRODUCTS,
      warehouses: INITIAL_WAREHOUSES,
      suppliers: INITIAL_SUPPLIERS,
      receipts: INITIAL_RECEIPTS,
      deliveries: INITIAL_DELIVERIES,
      transfers: INITIAL_TRANSFERS,
      adjustments: INITIAL_ADJUSTMENTS,
      ledger: INITIAL_LEDGER,
      recommendations: INITIAL_RECOMMENDATIONS,
      anomalies: INITIAL_ANOMALIES,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
      users: INITIAL_USERS,
      savedAccounts: INITIAL_SAVED_ACCOUNTS,
      rememberedEmail: 'sarah.manager@stocksense.io',
      currentUserId: 'usr-1',
      theme: 'dark',
      lastSavedAt: new Date().toISOString(),
      offlineSyncQueue: [],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    } catch (e) {
      console.error(e);
    }
    return defaultData;
  },

  getStorageStats(): { bytesUsed: number; formattedSize: string; recordCount: number; lastSaved: string } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      const bytes = new Blob([raw]).size;
      const formatted = bytes > 1024 * 1024 
        ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;
      
      const parsed = raw ? JSON.parse(raw) : null;
      const count = parsed 
        ? (parsed.products?.length || 0) + (parsed.ledger?.length || 0) + (parsed.receipts?.length || 0)
        : 0;

      return {
        bytesUsed: bytes,
        formattedSize: formatted,
        recordCount: count,
        lastSaved: parsed?.lastSavedAt ? new Date(parsed.lastSavedAt).toLocaleTimeString() : 'Just now',
      };
    } catch {
      return { bytesUsed: 0, formattedSize: '0 KB', recordCount: 0, lastSaved: 'Unknown' };
    }
  },

  exportJSON(data: StockSenseStoreData) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `stocksense-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },
};
