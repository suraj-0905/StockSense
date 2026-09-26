import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  UserRole,
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
  AdjustmentReason,
  SavedAccount,
} from '../types/inventory';
import { OfflineStorageService, StockSenseStoreData } from '../services/storage';
import { InventoryEngine } from '../services/inventoryEngine';

interface InventoryContextType {
  // State
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
  currentUser: User;
  users: User[];
  savedAccounts: SavedAccount[];
  rememberedEmail?: string;
  theme: 'dark' | 'light';
  isOnline: boolean;
  storageStats: { bytesUsed: number; formattedSize: string; recordCount: number; lastSaved: string };

  // Core Actions
  toggleDarkMode: () => void;
  switchUserRole: (role: UserRole) => void;
  registerUser: (accountData: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    warehouseId?: string;
    department?: string;
    rememberMe?: boolean;
  }) => { success: boolean; message: string; user?: User };
  loginUser: (credentials: {
    email: string;
    password?: string;
    rememberMe?: boolean;
  }) => { success: boolean; message: string; user?: User };
  quickLoginUser: (userId: string) => { success: boolean; message: string; user?: User };
  removeSavedAccount: (emailOrUserId: string) => void;
  updateUserProfile: (data: Partial<User>) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Single-Source-Of-Truth Inventory Mutations
  createReceipt: (receiptData: {
    supplierId: string;
    warehouseId: string;
    items: Array<{ productId: string; quantity: number; targetLocation: string }>;
    notes?: string;
  }) => { success: boolean; message: string; receiptId?: string };

  createDelivery: (deliveryData: {
    customerName: string;
    warehouseId: string;
    items: Array<{ productId: string; quantity: number; sourceLocation: string }>;
    shippingAddress: string;
    notes?: string;
  }) => { success: boolean; message: string; orderId?: string };

  createTransfer: (transferData: {
    sourceWarehouseId: string;
    sourceLocation: string;
    destinationWarehouseId: string;
    destinationLocation: string;
    items: Array<{ productId: string; quantity: number }>;
    reason: string;
  }) => { success: boolean; message: string; transferId?: string };

  createAdjustment: (adjustmentData: {
    productId: string;
    warehouseId: string;
    location: string;
    physicalCount: number;
    reason: AdjustmentReason;
    notes?: string;
  }) => { success: boolean; message: string; adjustmentId?: string };

  // Autopilot
  approveRecommendation: (id: string) => { success: boolean; message: string };
  rejectRecommendation: (id: string, reason?: string) => void;

  // Demo Scenario Interactive Runner (Prompt Section 45)
  executeDemoScenarioStep: (stepNumber: 1 | 2 | 3 | 4 | 5) => { success: boolean; title: string; message: string };
  demoStepCompleted: number;

  // Storage and System
  resetAllData: () => void;
  exportDataJSON: () => void;
  addProduct: (product: Omit<Product, 'id' | 'healthStatus' | 'healthScore' | 'daysRemaining' | 'createdDate' | 'lastUpdatedDate'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<StockSenseStoreData>(() => OfflineStorageService.loadData());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [demoStepCompleted, setDemoStepCompleted] = useState<number>(0);

  // Monitor network status for offline capability
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync to local offline storage whenever data changes
  useEffect(() => {
    OfflineStorageService.saveData(data);
  }, [data]);

  // Apply dark mode class to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (data.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [data.theme]);

  const toggleDarkMode = useCallback(() => {
    setData((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const switchUserRole = useCallback((role: UserRole) => {
    setData((prev) => {
      const targetUser = prev.users.find((u) => u.role === role) || prev.users[0];
      return {
        ...prev,
        currentUserId: targetUser.id,
      };
    });
  }, []);

  const currentUser = useMemo(() => {
    const user = data.users.find((u) => u.id === data.currentUserId) || data.users[0];

    if (!user) {
      throw new Error('StockSense requires at least one user in the store data.');
    }

    return user.uniqueCode
      ? user
      : { ...user, uniqueCode: '8492019482' };
  }, [data.users, data.currentUserId]);

  // Register a new user account and save details directly to system data
  const registerUser = useCallback(
    (accountData: {
      name: string;
      email: string;
      password?: string;
      role: UserRole;
      warehouseId?: string;
      department?: string;
      rememberMe?: boolean;
    }) => {
      const cleanEmail = accountData.email.trim().toLowerCase();
      if (!cleanEmail || !accountData.name.trim()) {
        return { success: false, message: 'Please provide a valid full name and email address.' };
      }

      // Check for duplicate email
      const existing = data.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return { success: false, message: `An account with ${cleanEmail} already exists in the system.` };
      }

      const newUserId = `usr-${Date.now()}`;
      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const avatarMap: Record<UserRole, string> = {
        manager: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        staff: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
        admin: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        auditor: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&auto=format&fit=crop&q=80',
      };

      const generatedUniqueCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();

      const newUser: User = {
        id: newUserId,
        name: accountData.name.trim(),
        email: cleanEmail,
        password: accountData.password || 'password123',
        role: accountData.role,
        warehouseId: accountData.warehouseId || 'wh-01',
        department: accountData.department || 'Operations Team',
        avatarUrl: avatarMap[accountData.role],
        lastLogin: `Today, ${nowStr}`,
        createdAt: new Date().toISOString(),
        savedOnDevice: true,
        uniqueCode: generatedUniqueCode,
      };

      const remember = accountData.rememberMe !== false;
      const newSavedAccount: SavedAccount = {
        userId: newUserId,
        name: newUser.name,
        email: cleanEmail,
        role: newUser.role,
        avatarUrl: newUser.avatarUrl,
        warehouseId: newUser.warehouseId,
        savedPassword: remember ? newUser.password : undefined,
        lastLogin: `Today, ${nowStr}`,
        rememberPassword: remember,
        uniqueCode: generatedUniqueCode,
      };

      const updatedSavedAccounts = [
        newSavedAccount,
        ...(data.savedAccounts || []).filter((s) => s.email.toLowerCase() !== cleanEmail),
      ];

      const auditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        userId: newUserId,
        userName: newUser.name,
        userRole: newUser.role,
        action: 'USER_REGISTERED',
        details: `Created new ${accountData.role.toUpperCase()} account for ${cleanEmail} saved to local offline system storage`,
        ipAddress: '127.0.0.1 (Local Browser DB)',
      };

      setData((prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
        savedAccounts: updatedSavedAccounts,
        rememberedEmail: cleanEmail,
        currentUserId: newUserId,
        auditLogs: [auditLog, ...prev.auditLogs],
      }));

      return {
        success: true,
        message: `Account for ${newUser.name} created successfully and saved in system data!`,
        user: newUser,
      };
    },
    [data.users, data.savedAccounts]
  );

  // Authenticate existing user and update saved credentials
  const loginUser = useCallback(
    (credentials: { email: string; password?: string; rememberMe?: boolean }) => {
      const cleanEmail = credentials.email.trim().toLowerCase();
      const user = data.users.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        return {
          success: false,
          message: `No account found with email "${credentials.email}". Please verify credentials or create an account.`,
        };
      }

      if (user.password && credentials.password && user.password !== credentials.password) {
        return {
          success: false,
          message: 'Incorrect password entered. Please try again or use OTP reset.',
        };
      }

      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const remember = credentials.rememberMe !== false;
      const updatedSavedAccount: SavedAccount = {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        warehouseId: user.warehouseId,
        savedPassword: remember ? (credentials.password || user.password) : undefined,
        lastLogin: `Today, ${nowStr}`,
        rememberPassword: remember,
      };

      const updatedSavedAccounts = [
        updatedSavedAccount,
        ...(data.savedAccounts || []).filter((s) => s.email.toLowerCase() !== cleanEmail),
      ];

      const updatedUsers = data.users.map((u) =>
        u.id === user.id ? { ...u, lastLogin: `Today, ${nowStr}` } : u
      );

      const auditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'USER_LOGIN',
        details: `Authenticated as ${user.role.toUpperCase()} (${user.email}). Credentials synced to offline storage.`,
        ipAddress: '127.0.0.1 (Local Browser DB)',
      };

      setData((prev) => ({
        ...prev,
        users: updatedUsers,
        savedAccounts: updatedSavedAccounts,
        rememberedEmail: cleanEmail,
        currentUserId: user.id,
        auditLogs: [auditLog, ...prev.auditLogs],
      }));

      return {
        success: true,
        message: `Welcome back, ${user.name}!`,
        user,
      };
    },
    [data.users, data.savedAccounts]
  );

  // Fast 1-click login for remembered/saved accounts
  const quickLoginUser = useCallback(
    (userId: string) => {
      const user = data.users.find((u) => u.id === userId);
      if (!user) {
        return { success: false, message: 'User not found in system data.' };
      }

      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const auditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'USER_QUICK_LOGIN',
        details: `Quick 1-click sign in as ${user.name} (${user.role.toUpperCase()}) from saved system data`,
        ipAddress: '127.0.0.1 (Local Browser DB)',
      };

      setData((prev) => ({
        ...prev,
        currentUserId: user.id,
        rememberedEmail: user.email,
        users: prev.users.map((u) => (u.id === user.id ? { ...u, lastLogin: `Today, ${nowStr}` } : u)),
        savedAccounts: (prev.savedAccounts || []).map((s) =>
          s.userId === user.id ? { ...s, lastLogin: `Today, ${nowStr}` } : s
        ),
        auditLogs: [auditLog, ...prev.auditLogs],
      }));

      return { success: true, message: `Signed in as ${user.name}`, user };
    },
    [data.users]
  );

  // Remove saved credentials from device
  const removeSavedAccount = useCallback((emailOrUserId: string) => {
    setData((prev) => {
      const filtered = (prev.savedAccounts || []).filter(
        (s) => s.userId !== emailOrUserId && s.email.toLowerCase() !== emailOrUserId.toLowerCase()
      );
      const newRemembered =
        prev.rememberedEmail?.toLowerCase() === emailOrUserId.toLowerCase()
          ? filtered[0]?.email || ''
          : prev.rememberedEmail;
      return {
        ...prev,
        savedAccounts: filtered,
        rememberedEmail: newRemembered,
      };
    });
  }, []);

  // Update current user details
  const updateUserProfile = useCallback((updates: Partial<User>) => {
    setData((prev) => {
      const updatedUsers = prev.users.map((u) => (u.id === prev.currentUserId ? { ...u, ...updates } : u));
      const updatedSaved = (prev.savedAccounts || []).map((s) =>
        s.userId === prev.currentUserId
          ? {
              ...s,
              name: updates.name || s.name,
              email: updates.email || s.email,
              role: updates.role || s.role,
              avatarUrl: updates.avatarUrl || s.avatarUrl,
            }
          : s
      );
      return {
        ...prev,
        users: updatedUsers,
        savedAccounts: updatedSaved,
      };
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, []);

  // Helper to recalculate all product health metrics
  const refreshProductsHealth = (productsList: Product[]): Product[] => {
    return productsList.map((p) => {
      const { status, score } = InventoryEngine.evaluateHealthStatus(p);
      const daysRemaining = InventoryEngine.calculateDaysRemaining(p.currentStock, p.avgDailyUsage);
      return {
        ...p,
        healthStatus: status,
        healthScore: score,
        daysRemaining,
        lastUpdatedDate: new Date().toISOString().slice(0, 10),
      };
    });
  };

  // 1. RECEIPT: Increases stock, appends to Ledger, updates health
  const createReceipt = useCallback(
    (receiptData: {
      supplierId: string;
      warehouseId: string;
      items: Array<{ productId: string; quantity: number; targetLocation: string }>;
      notes?: string;
    }) => {
      const supplier = data.suppliers.find((s) => s.id === receiptData.supplierId);
      const warehouse = data.warehouses.find((w) => w.id === receiptData.warehouseId);
      if (!supplier || !warehouse) {
        return { success: false, message: 'Invalid supplier or warehouse selection.' };
      }

      const receiptNum = `REC-2026-${String(Math.floor(Math.random() * 800) + 100).padStart(3, '0')}`;
      const nowStr = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newLedgerEntries: StockLedgerEntry[] = [];
      const updatedProducts = [...data.products];

      const receiptItems = receiptData.items.map((item) => {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.productId);
        const prod = updatedProducts[prodIndex];
        if (prod) {
          const prevStock = prod.currentStock;
          const newStock = prevStock + item.quantity;

          // Update product locations
          const locs = [...(prod.locations || [])];
          const targetLocIdx = locs.findIndex(
            (l) => l.warehouseId === warehouse.id && l.locationName === item.targetLocation
          );
          if (targetLocIdx >= 0) {
            locs[targetLocIdx] = {
              ...locs[targetLocIdx],
              quantity: locs[targetLocIdx].quantity + item.quantity,
            };
          } else {
            locs.push({
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              locationId: `loc-${Date.now()}`,
              locationName: item.targetLocation,
              quantity: item.quantity,
            });
          }

          updatedProducts[prodIndex] = {
            ...prod,
            currentStock: newStock,
            locations: locs,
            daysWithoutMovement: 0,
          };

          newLedgerEntries.push({
            id: `ledg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowStr,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            transactionType: 'Receipt',
            quantityChange: item.quantity,
            previousStock: prevStock,
            newStock: newStock,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            locationName: item.targetLocation,
            userId: currentUser.id,
            userName: currentUser.name,
            reason: `Supplier receipt from ${supplier.name} (${receiptData.notes || 'Inbound Goods'})`,
            referenceDoc: receiptNum,
          });

          return {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            orderedQty: item.quantity,
            receivedQty: item.quantity,
            unit: prod.unit,
            targetLocation: item.targetLocation,
          };
        }
        return null;
      }).filter(Boolean) as any[];

      const newReceipt: Receipt = {
        id: `rec-${Date.now()}`,
        receiptNumber: receiptNum,
        supplierId: supplier.id,
        supplierName: supplier.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        date: new Date().toISOString().slice(0, 10),
        status: 'done',
        items: receiptItems,
        notes: receiptData.notes,
        validatedBy: currentUser.name,
        validatedAt: nowStr,
      };

      const refreshed = refreshProductsHealth(updatedProducts);
      const newRecommendations = InventoryEngine.generateDynamicRecommendations(refreshed, data.warehouses);

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: nowStr,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'RECEIPT_PROCESSED',
        details: `Receipt ${receiptNum}: ${receiptItems.length} line items received from ${supplier.name}`,
      };

      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        timestamp: 'Just now',
        title: `Goods Received: ${receiptNum}`,
        message: `Successfully received and shelved inbound inventory into ${warehouse.name}.`,
        type: 'success',
        read: false,
        linkModule: 'operations',
      };

      setData((prev) => ({
        ...prev,
        products: refreshed,
        receipts: [newReceipt, ...prev.receipts],
        ledger: [...newLedgerEntries, ...prev.ledger],
        recommendations: newRecommendations,
        auditLogs: [auditEntry, ...prev.auditLogs],
        notifications: [newNotif, ...prev.notifications],
      }));

      return { success: true, message: `Receipt ${receiptNum} recorded successfully!`, receiptId: newReceipt.id };
    },
    [data, currentUser]
  );

  // 2. DELIVERY: Validates sufficient stock, decreases stock, appends to Ledger
  const createDelivery = useCallback(
    (deliveryData: {
      customerName: string;
      warehouseId: string;
      items: Array<{ productId: string; quantity: number; sourceLocation: string }>;
      shippingAddress: string;
      notes?: string;
    }) => {
      const warehouse = data.warehouses.find((w) => w.id === deliveryData.warehouseId);
      if (!warehouse) {
        return { success: false, message: 'Invalid warehouse selected.' };
      }

      // Check stock availability
      for (const item of deliveryData.items) {
        const prod = data.products.find((p) => p.id === item.productId);
        if (!prod) {
          return { success: false, message: 'Selected product does not exist.' };
        }
        if (prod.currentStock < item.quantity) {
          return {
            success: false,
            message: `Insufficient stock for ${prod.name}. Available: ${prod.currentStock} ${prod.unit}, Requested: ${item.quantity} ${prod.unit}. Delivery aborted.`,
          };
        }
      }

      const orderNum = `DEL-2026-${String(Math.floor(Math.random() * 800) + 100).padStart(3, '0')}`;
      const nowStr = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const updatedProducts = [...data.products];
      const newLedgerEntries: StockLedgerEntry[] = [];

      const deliveryItems = deliveryData.items.map((item) => {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.productId);
        const prod = updatedProducts[prodIndex];
        const prevStock = prod.currentStock;
        const newStock = Math.max(0, prevStock - item.quantity);

        // Update location stock
        const locs = [...(prod.locations || [])];
        const locIdx = locs.findIndex(
          (l) => l.warehouseId === warehouse.id && l.locationName === item.sourceLocation
        );
        if (locIdx >= 0) {
          locs[locIdx] = {
            ...locs[locIdx],
            quantity: Math.max(0, locs[locIdx].quantity - item.quantity),
          };
        }

        updatedProducts[prodIndex] = {
          ...prod,
          currentStock: newStock,
          locations: locs,
          daysWithoutMovement: 0,
        };

        newLedgerEntries.push({
          id: `ledg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStr,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          transactionType: 'Delivery',
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          locationName: item.sourceLocation,
          userId: currentUser.id,
          userName: currentUser.name,
          reason: `Customer fulfillment for ${deliveryData.customerName}`,
          referenceDoc: orderNum,
        });

        return {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          requestedQty: item.quantity,
          pickedQty: item.quantity,
          packedQty: item.quantity,
          unit: prod.unit,
          sourceLocation: item.sourceLocation,
        };
      });

      const newDelivery: DeliveryOrder = {
        id: `del-${Date.now()}`,
        orderNumber: orderNum,
        customerName: deliveryData.customerName,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        date: new Date().toISOString().slice(0, 10),
        status: 'done',
        items: deliveryItems,
        shippingAddress: deliveryData.shippingAddress,
        notes: deliveryData.notes,
        validatedBy: currentUser.name,
        validatedAt: nowStr,
      };

      const refreshed = refreshProductsHealth(updatedProducts);
      const newRecommendations = InventoryEngine.generateDynamicRecommendations(refreshed, data.warehouses);

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: nowStr,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'DELIVERY_DISPATCHED',
        details: `Delivery ${orderNum}: Dispatched to ${deliveryData.customerName}`,
      };

      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        timestamp: 'Just now',
        title: `Delivery Completed: ${orderNum}`,
        message: `Dispatched order for ${deliveryData.customerName} from ${warehouse.name}.`,
        type: 'info',
        read: false,
        linkModule: 'operations',
      };

      setData((prev) => ({
        ...prev,
        products: refreshed,
        deliveries: [newDelivery, ...prev.deliveries],
        ledger: [...newLedgerEntries, ...prev.ledger],
        recommendations: newRecommendations,
        auditLogs: [auditEntry, ...prev.auditLogs],
        notifications: [newNotif, ...prev.notifications],
      }));

      return { success: true, message: `Delivery order ${orderNum} validated and dispatched!`, orderId: newDelivery.id };
    },
    [data, currentUser]
  );

  // 3. TRANSFER: Source -> Destination, total inventory UNCHANGED, locations updated
  const createTransfer = useCallback(
    (transferData: {
      sourceWarehouseId: string;
      sourceLocation: string;
      destinationWarehouseId: string;
      destinationLocation: string;
      items: Array<{ productId: string; quantity: number }>;
      reason: string;
    }) => {
      const sourceWh = data.warehouses.find((w) => w.id === transferData.sourceWarehouseId);
      const destWh = data.warehouses.find((w) => w.id === transferData.destinationWarehouseId);
      if (!sourceWh || !destWh) {
        return { success: false, message: 'Invalid source or destination warehouse.' };
      }

      const trfNum = `TRF-2026-${String(Math.floor(Math.random() * 800) + 100).padStart(3, '0')}`;
      const nowStr = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const updatedProducts = [...data.products];
      const newLedgerEntries: StockLedgerEntry[] = [];

      for (const item of transferData.items) {
        const prodIndex = updatedProducts.findIndex((p) => p.id === item.productId);
        const prod = updatedProducts[prodIndex];
        if (!prod) continue;

        const locs = [...(prod.locations || [])];

        // Deduct from source
        const srcIdx = locs.findIndex(
          (l) => l.warehouseId === sourceWh.id && l.locationName === transferData.sourceLocation
        );
        if (srcIdx >= 0) {
          locs[srcIdx] = {
            ...locs[srcIdx],
            quantity: Math.max(0, locs[srcIdx].quantity - item.quantity),
          };
        }

        // Add to destination
        const destIdx = locs.findIndex(
          (l) => l.warehouseId === destWh.id && l.locationName === transferData.destinationLocation
        );
        if (destIdx >= 0) {
          locs[destIdx] = {
            ...locs[destIdx],
            quantity: locs[destIdx].quantity + item.quantity,
          };
        } else {
          locs.push({
            warehouseId: destWh.id,
            warehouseName: destWh.name,
            locationId: `loc-${Date.now()}`,
            locationName: transferData.destinationLocation,
            quantity: item.quantity,
          });
        }

        // Total company inventory remains unchanged!
        updatedProducts[prodIndex] = {
          ...prod,
          locations: locs,
        };

        newLedgerEntries.push({
          id: `ledg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStr,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          transactionType: 'Transfer',
          quantityChange: 0, // Total company stock unchanged
          previousStock: prod.currentStock,
          newStock: prod.currentStock,
          warehouseId: destWh.id,
          warehouseName: `${sourceWh.name} ➔ ${destWh.name}`,
          locationName: `${transferData.sourceLocation} ➔ ${transferData.destinationLocation} (${item.quantity} ${prod.unit})`,
          userId: currentUser.id,
          userName: currentUser.name,
          reason: transferData.reason,
          referenceDoc: trfNum,
        });
      }

      const newTransfer: InternalTransfer = {
        id: `trf-${Date.now()}`,
        transferNumber: trfNum,
        sourceWarehouseId: sourceWh.id,
        sourceWarehouseName: sourceWh.name,
        sourceLocation: transferData.sourceLocation,
        destinationWarehouseId: destWh.id,
        destinationWarehouseName: destWh.name,
        destinationLocation: transferData.destinationLocation,
        date: new Date().toISOString().slice(0, 10),
        status: 'done',
        items: transferData.items.map((i) => {
          const p = data.products.find((prod) => prod.id === i.productId);
          return {
            productId: i.productId,
            productName: p?.name || 'Product',
            sku: p?.sku || '',
            quantity: i.quantity,
            unit: p?.unit || 'units',
          };
        }),
        reason: transferData.reason,
        requestedBy: currentUser.name,
        validatedAt: nowStr,
      };

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: nowStr,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'TRANSFER_EXECUTED',
        details: `Internal transfer ${trfNum}: Moved goods from ${sourceWh.name} to ${destWh.name}`,
      };

      setData((prev) => ({
        ...prev,
        products: updatedProducts,
        transfers: [newTransfer, ...prev.transfers],
        ledger: [...newLedgerEntries, ...prev.ledger],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));

      return { success: true, message: `Transfer ${trfNum} completed successfully!`, transferId: newTransfer.id };
    },
    [data, currentUser]
  );

  // 4. INVENTORY ADJUSTMENT: Reconciles recorded vs physical count with reason
  const createAdjustment = useCallback(
    (adjustmentData: {
      productId: string;
      warehouseId: string;
      location: string;
      physicalCount: number;
      reason: AdjustmentReason;
      notes?: string;
    }) => {
      const prod = data.products.find((p) => p.id === adjustmentData.productId);
      const warehouse = data.warehouses.find((w) => w.id === adjustmentData.warehouseId);
      if (!prod || !warehouse) {
        return { success: false, message: 'Invalid product or warehouse.' };
      }

      const adjNum = `ADJ-2026-${String(Math.floor(Math.random() * 800) + 100).padStart(3, '0')}`;
      const nowStr = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const recorded = prod.currentStock;
      const physical = adjustmentData.physicalCount;
      const diff = physical - recorded;

      const updatedProducts = data.products.map((p) => {
        if (p.id === prod.id) {
          const locs = [...(p.locations || [])];
          const locIdx = locs.findIndex(
            (l) => l.warehouseId === warehouse.id && l.locationName === adjustmentData.location
          );
          if (locIdx >= 0) {
            locs[locIdx] = {
              ...locs[locIdx],
              quantity: Math.max(0, locs[locIdx].quantity + diff),
            };
          }
          return {
            ...p,
            currentStock: physical,
            locations: locs,
          };
        }
        return p;
      });

      const newLedgerEntry: StockLedgerEntry = {
        id: `ledg-${Date.now()}`,
        timestamp: nowStr,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        transactionType: adjustmentData.reason === 'Damaged' ? 'Damage' : 'Adjustment',
        quantityChange: diff,
        previousStock: recorded,
        newStock: physical,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        locationName: adjustmentData.location,
        userId: currentUser.id,
        userName: currentUser.name,
        reason: `${adjustmentData.reason}: ${adjustmentData.notes || 'Reconciliation variance'}`,
        referenceDoc: adjNum,
      };

      const newAdjustment: InventoryAdjustment = {
        id: `adj-${Date.now()}`,
        adjustmentNumber: adjNum,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        location: adjustmentData.location,
        recordedStock: recorded,
        physicalCount: physical,
        difference: diff,
        unit: prod.unit,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes,
        adjustedBy: currentUser.name,
        date: nowStr,
        status: 'done',
      };

      const refreshed = refreshProductsHealth(updatedProducts);
      const newRecommendations = InventoryEngine.generateDynamicRecommendations(refreshed, data.warehouses);

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: nowStr,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'INVENTORY_ADJUSTMENT',
        details: `Adjustment ${adjNum}: ${prod.name} count adjusted from ${recorded} to ${physical} (${diff > 0 ? '+' : ''}${diff} ${prod.unit})`,
      };

      setData((prev) => ({
        ...prev,
        products: refreshed,
        adjustments: [newAdjustment, ...prev.adjustments],
        ledger: [newLedgerEntry, ...prev.ledger],
        recommendations: newRecommendations,
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));

      return { success: true, message: `Adjustment ${adjNum} applied. Stock reconciled to ${physical} ${prod.unit}!`, adjustmentId: newAdjustment.id };
    },
    [data, currentUser]
  );

  // Autopilot: Approve recommendation
  const approveRecommendation = useCallback(
    (id: string) => {
      const rec = data.recommendations.find((r) => r.id === id);
      if (!rec) return { success: false, message: 'Recommendation not found.' };

      if (rec.type === 'reorder') {
        // Automatically trigger a receipt for the recommended quantity
        const prod = data.products.find((p) => p.id === rec.productId);
        const supplier = data.suppliers.find((s) => s.id === prod?.supplierId) || data.suppliers[0];

        if (!prod) {
          return { success: false, message: 'Product linked to recommendation was not found.' };
        }

        if (!supplier) {
          return { success: false, message: 'No supplier is available for this reorder recommendation.' };
        }

        const res = createReceipt({
          supplierId: supplier.id,
          warehouseId: prod.warehouseId || 'wh-01',
          items: [
            {
              productId: rec.productId,
              quantity: rec.recommendedQuantity || 100,
              targetLocation: prod?.primaryLocation || 'Rack A',
            },
          ],
          notes: `Autopilot Approved: Automated replenishment based on prediction analysis.`,
        });

        setData((prev) => ({
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.id === id ? { ...r, status: 'approved' } : r
          ),
        }));

        return { success: true, message: `Approved! ${rec.actionSummary}. ${res.message}` };
      }

      if (rec.type === 'transfer' && rec.sourceWarehouseId && rec.targetWarehouseId) {
        // Automatically trigger an internal transfer
        const res = createTransfer({
          sourceWarehouseId: rec.sourceWarehouseId,
          sourceLocation: 'Rack D',
          destinationWarehouseId: rec.targetWarehouseId,
          destinationLocation: 'Rack B',
          items: [{ productId: rec.productId, quantity: rec.recommendedQuantity || 50 }],
          reason: 'Autopilot Approved: Inter-warehouse surplus buffer optimization',
        });

        setData((prev) => ({
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.id === id ? { ...r, status: 'approved' } : r
          ),
        }));

        return { success: true, message: `Approved! Inter-warehouse transfer executed. ${res.message}` };
      }

      // Mark approved for anomaly or dead stock
      setData((prev) => ({
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.id === id ? { ...r, status: 'approved' } : r
        ),
      }));

      return { success: true, message: `Recommendation marked as approved and scheduled for execution.` };
    },
    [data, createReceipt, createTransfer]
  );

  const rejectRecommendation = useCallback((id: string, reason?: string) => {
    setData((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((r) =>
        r.id === id ? { ...r, status: 'rejected' } : r
      ),
    }));
  }, []);

  // Section 45: Interactive Demo Scenario Runner
  const executeDemoScenarioStep = useCallback(
    (stepNumber: 1 | 2 | 3 | 4 | 5) => {
      const steelProd = data.products.find((p) => p.sku === 'SKU-STL-101') || data.products[0];

      if (stepNumber === 1) {
        // Step 1: Receive 100 kg Steel -> Inventory increases by 100
        createReceipt({
          supplierId: steelProd.supplierId,
          warehouseId: 'wh-01',
          items: [{ productId: steelProd.id, quantity: 100, targetLocation: 'Rack A' }],
          notes: 'Demo Scenario Step 1: Inbound batch 100 kg Steel Rods',
        });
        setDemoStepCompleted(1);
        return {
          success: true,
          title: 'Step 1 Complete: Received 100 kg Steel',
          message: `Inventory increased by +100 kg. Stock Ledger updated with transaction reference REC. Real-time graph reflects upward trajectory!`,
        };
      }

      if (stepNumber === 2) {
        // Step 2: Transfer Main Store -> Production Rack
        createTransfer({
          sourceWarehouseId: 'wh-01',
          sourceLocation: 'Rack A',
          destinationWarehouseId: 'wh-03',
          destinationLocation: 'Production Floor',
          items: [{ productId: steelProd.id, quantity: 40 }],
          reason: 'Demo Scenario Step 2: Production line allocation',
        });
        setDemoStepCompleted(2);
        return {
          success: true,
          title: 'Step 2 Complete: Transferred to Production Floor',
          message: `40 kg Steel moved from Main Store (Rack A) to Production Floor. Notice: Total company inventory remains unchanged, while location-level stocks updated!`,
        };
      }

      if (stepNumber === 3) {
        // Step 3: Deliver 20 units -> Inventory decreases
        const chairProd = data.products.find((p) => p.sku === 'SKU-CHR-404') || data.products[3];
        createDelivery({
          customerName: 'Demo Client Horizon Ltd',
          warehouseId: 'wh-02',
          shippingAddress: '404 Industrial Lane',
          items: [{ productId: chairProd.id, quantity: 10, sourceLocation: 'Rack E' }],
          notes: 'Demo Scenario Step 3: Outgoing order dispatch',
        });
        setDemoStepCompleted(3);
        return {
          success: true,
          title: 'Step 3 Complete: Delivered 10 Units',
          message: `Dispatched finished goods to client. Inventory decreased by 10 units. Ledger recorded outgoing order!`,
        };
      }

      if (stepNumber === 4) {
        // Step 4: Adjust damaged stock: 3 kg damaged -> Inventory decreases by 3
        const currentSteel = data.products.find((p) => p.id === steelProd.id)?.currentStock || 120;
        createAdjustment({
          productId: steelProd.id,
          warehouseId: 'wh-01',
          location: 'Rack A',
          physicalCount: Math.max(0, currentSteel - 3),
          reason: 'Damaged',
          notes: 'Demo Scenario Step 4: 3 kg surface oxidation write-off during quality audit',
        });
        setDemoStepCompleted(4);
        return {
          success: true,
          title: 'Step 4 Complete: Damaged Stock Reconciled',
          message: `Physical count recorded 3 kg variance due to oxidation damage. Ledger logged transaction as Damage!`,
        };
      }

      if (stepNumber === 5) {
        // Step 5: System analyzes resulting history live!
        setDemoStepCompleted(5);
        return {
          success: true,
          title: 'Step 5 Complete: Full System Analysis Generated',
          message: `StockSense analytics engine re-evaluated: Burn rate, Days remaining, Forecasts, and Autopilot recommendations are now refreshed across all dashboards!`,
        };
      }

      return { success: false, title: 'Invalid Step', message: 'Please select a valid step 1 to 5.' };
    },
    [data, createReceipt, createDelivery, createTransfer, createAdjustment]
  );

  const resetAllData = useCallback(() => {
    const refreshed = OfflineStorageService.resetToDefaultData();
    setData(refreshed);
    setDemoStepCompleted(0);
  }, []);

  const exportDataJSON = useCallback(() => {
    OfflineStorageService.exportJSON(data);
  }, [data]);

  const addProduct = useCallback((newProdData: Omit<Product, 'id' | 'healthStatus' | 'healthScore' | 'daysRemaining' | 'createdDate' | 'lastUpdatedDate'>) => {
    const newProd: Product = {
      ...newProdData,
      id: `prod-${Date.now()}`,
      createdDate: new Date().toISOString().slice(0, 10),
      lastUpdatedDate: new Date().toISOString().slice(0, 10),
      healthStatus: 'healthy',
      healthScore: 85,
      daysRemaining: 30,
      daysWithoutMovement: 0,
      locations: newProdData.locations || [
        {
          warehouseId: newProdData.warehouseId,
          warehouseName: 'Main Central Warehouse',
          locationId: 'loc-01',
          locationName: newProdData.primaryLocation,
          quantity: newProdData.currentStock,
        },
      ],
    };
    const evaluated = refreshProductsHealth([newProd, ...data.products]);
    setData((prev) => ({
      ...prev,
      products: evaluated,
    }));
  }, [data.products]);

  const updateProduct = useCallback((updated: Product) => {
    setData((prev) => {
      const refreshed = refreshProductsHealth(
        prev.products.map((p) => (p.id === updated.id ? updated : p))
      );
      return {
        ...prev,
        products: refreshed,
      };
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
  }, []);

  const storageStats = useMemo(() => {
    return OfflineStorageService.getStorageStats();
  }, [data]);

  const value = {
    products: data.products,
    warehouses: data.warehouses,
    suppliers: data.suppliers,
    receipts: data.receipts,
    deliveries: data.deliveries,
    transfers: data.transfers,
    adjustments: data.adjustments,
    ledger: data.ledger,
    recommendations: data.recommendations,
    anomalies: data.anomalies,
    notifications: data.notifications,
    auditLogs: data.auditLogs,
    currentUser,
    users: data.users,
    savedAccounts: data.savedAccounts || [],
    rememberedEmail: data.rememberedEmail,
    theme: data.theme,
    isOnline,
    storageStats,
    toggleDarkMode,
    switchUserRole,
    registerUser,
    loginUser,
    quickLoginUser,
    removeSavedAccount,
    updateUserProfile,
    markNotificationRead,
    clearAllNotifications,
    createReceipt,
    createDelivery,
    createTransfer,
    createAdjustment,
    approveRecommendation,
    rejectRecommendation,
    executeDemoScenarioStep,
    demoStepCompleted,
    resetAllData,
    exportDataJSON,
    addProduct,
    updateProduct,
    deleteProduct,
  };

  return React.createElement(InventoryContext.Provider, { value }, children);
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return ctx;
};
