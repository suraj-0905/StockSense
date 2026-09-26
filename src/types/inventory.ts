export type UserRole = 'manager' | 'staff' | 'admin' | 'auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  warehouseId?: string;
  lastLogin?: string;
  password?: string;
  department?: string;
  createdAt?: string;
  savedOnDevice?: boolean;
  uniqueCode?: string; // 10-digit unique registration identification code
}

export interface SavedAccount {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  warehouseId?: string;
  savedPassword?: string;
  lastLogin: string;
  rememberPassword?: boolean;
  uniqueCode?: string; // 10-digit unique registration identification code
}

export type ProductCategory = 
  | 'Raw Materials' 
  | 'Components' 
  | 'Finished Goods' 
  | 'Packaging' 
  | 'Hardware' 
  | 'Electronics';

export type UnitOfMeasure = 'kg' | 'pcs' | 'units' | 'boxes' | 'sheets' | 'bundles' | 'meters';

export type HealthStatus = 'stockout_risk' | 'low_stock' | 'healthy' | 'slow_moving' | 'dead_stock';

export interface ProductStockLocation {
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string; // e.g. "Rack A", "Production Floor"
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: UnitOfMeasure;
  initialStock: number;
  currentStock: number;
  reorderPoint: number;
  safetyStock: number;
  unitCost: number; // in USD
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  primaryLocation: string; // e.g. "Rack A"
  locations: ProductStockLocation[];
  barcode: string;
  qrCode: string;
  avgDailyUsage: number;
  leadTimeDays: number;
  healthStatus: HealthStatus;
  healthScore: number; // 0 - 100
  daysRemaining: number; // calculated stockout projection
  daysWithoutMovement: number;
  createdDate: string;
  lastUpdatedDate: string;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string; // "Rack A"
  name: string;
  zone: string;
  capacityUnits: number;
  currentOccupancy: number;
  status: 'optimal' | 'warning' | 'critical';
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  managerName: string;
  totalCapacity: number;
  currentStockUnits: number;
  locations: WarehouseLocation[];
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  avgDeliveryDays: number;
  lateDeliveriesCount: number;
  totalOrdersCount: number;
  defectRatePercentage: number;
  rating: number; // out of 5
  suppliedCategories: ProductCategory[];
}

export type DocumentStatus = 'draft' | 'waiting' | 'ready' | 'done' | 'canceled';

export interface ReceiptItem {
  productId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unit: UnitOfMeasure;
  targetLocation: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  date: string;
  status: DocumentStatus;
  items: ReceiptItem[];
  notes?: string;
  validatedBy?: string;
  validatedAt?: string;
}

export interface DeliveryItem {
  productId: string;
  productName: string;
  sku: string;
  requestedQty: number;
  pickedQty: number;
  packedQty: number;
  unit: UnitOfMeasure;
  sourceLocation: string;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  date: string;
  status: DocumentStatus;
  items: DeliveryItem[];
  shippingAddress: string;
  notes?: string;
  validatedBy?: string;
  validatedAt?: string;
}

export interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: UnitOfMeasure;
}

export interface InternalTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceLocation: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationLocation: string;
  date: string;
  status: DocumentStatus;
  items: TransferItem[];
  reason: string;
  requestedBy: string;
  validatedAt?: string;
}

export type AdjustmentReason = 'Damaged' | 'Lost / Shrinkage' | 'Physical Recount' | 'Expired' | 'Found Surplus';

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  location: string;
  recordedStock: number;
  physicalCount: number;
  difference: number;
  unit: UnitOfMeasure;
  reason: AdjustmentReason;
  notes?: string;
  adjustedBy: string;
  date: string;
  status: 'done';
}

export type TransactionType = 'Receipt' | 'Delivery' | 'Transfer' | 'Adjustment' | 'Damage' | 'Return';

export interface StockLedgerEntry {
  id: string;
  timestamp: string;
  productId: string;
  productName: string;
  sku: string;
  transactionType: TransactionType;
  quantityChange: number; // positive or negative
  previousStock: number;
  newStock: number;
  warehouseId: string;
  warehouseName: string;
  locationName: string;
  userId: string;
  userName: string;
  reason: string;
  referenceDoc: string; // e.g. "REC-2026-089", "DEL-2026-104", "TRF-2026-042"
}

export type RecommendationType = 'reorder' | 'transfer' | 'review_anomaly' | 'dead_stock';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  recommendedQuantity?: number;
  unit: UnitOfMeasure;
  sourceWarehouseId?: string;
  sourceWarehouseName?: string;
  targetWarehouseId?: string;
  targetWarehouseName?: string;
  urgency: 'high' | 'medium' | 'low';
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  actionSummary: string;
}

export interface AnomalyRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  warehouseName: string;
  type: 'Unusually Large Dispatch' | 'Spike in Wastage' | 'Repetitive Adjustment' | 'Unusual Transfer Velocity';
  severity: 'high' | 'medium' | 'low';
  details: string;
  status: 'investigating' | 'reviewed' | 'resolved';
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  read: boolean;
  linkModule?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface ForecastDataPoint {
  dayLabel: string;
  date: string;
  actualStock?: number;
  predictedStock: number;
  lowerConfidence: number;
  upperConfidence: number;
  isFuture: boolean;
}
