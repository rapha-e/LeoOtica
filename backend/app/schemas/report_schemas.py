import uuid
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class BaseReportSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)

# --- SCHEMAS DE PRODUÇÃO (MES) ---

class ProductionOSItem(BaseReportSchema):
    id: uuid.UUID
    os_number: str
    client_order_number: Optional[str] = None
    optical_store_name: Optional[str] = None
    tray_number: Optional[str] = None
    os_type: str
    status: str
    priority: str
    production_route: Optional[str] = None
    lens_model_name: Optional[str] = None
    od_degree: Optional[str] = None
    oe_degree: Optional[str] = None
    total_amount: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: Optional[datetime] = None
    lead_time_hours: Optional[float] = None

class ProductionKPISchema(BaseReportSchema):
    total_orders: int = 0
    orders_completed: int = 0
    orders_in_progress: int = 0
    orders_rework: int = 0
    orders_blocked: int = 0
    avg_lead_time_hours: float = 0.0
    express_route_count: int = 0
    cnc_route_count: int = 0

class ProductionAnalyticResponse(BaseReportSchema):
    kpis: ProductionKPISchema
    orders: List[ProductionOSItem]
    orders_by_status: Dict[str, int]
    orders_by_route: Dict[str, int]


# --- SCHEMAS DE ESTOQUE (WMS & CMP) ---

class InventoryKardexItem(BaseReportSchema):
    id: uuid.UUID
    matrix_type: str
    model_name: str
    brand: str
    treatment: str
    refractive_index: Optional[Decimal] = None
    base_curve: Optional[Decimal] = None
    spherical: Optional[Decimal] = None
    cylindrical: Optional[Decimal] = None
    addition: Optional[Decimal] = None
    eye: Optional[str] = None
    location_tag: Optional[str] = None
    barcode: Optional[str] = None
    quantity_available: int = 0
    reserved_quantity: int = 0
    free_quantity: int = 0
    unit_cost_cmp: Decimal = Decimal("0.00")
    total_value_cmp: Decimal = Decimal("0.00")
    last_purchase_price: Optional[Decimal] = None

class InventoryKPISchema(BaseReportSchema):
    total_items_count: int = 0
    total_units_stock: int = 0
    total_units_reserved: int = 0
    total_stock_value_cmp: Decimal = Decimal("0.00")
    critical_items_count: int = 0
    rupture_items_count: int = 0

class InventoryKardexResponse(BaseReportSchema):
    kpis: InventoryKPISchema
    items: List[InventoryKardexItem]
    stock_by_matrix: Dict[str, int]
    value_by_matrix: Dict[str, Decimal]


# --- SCHEMAS COMERCIAIS & VENDAS ---

class CommercialRankingItem(BaseReportSchema):
    optical_store_id: uuid.UUID
    store_name: str
    trade_name: Optional[str] = None
    cnpj: Optional[str] = None
    total_orders_count: int = 0
    total_billed_amount: Decimal = Decimal("0.00")
    average_ticket: Decimal = Decimal("0.00")
    status_policy: str = "POLICY_ALERT"

class CommercialKPISchema(BaseReportSchema):
    total_sales_amount: Decimal = Decimal("0.00")
    total_orders_sold: int = 0
    overall_avg_ticket: Decimal = Decimal("0.00")
    active_stores_count: int = 0

class TreatmentSalesItem(BaseReportSchema):
    treatment_name: str
    quantity_sold: int = 0
    total_amount: Decimal = Decimal("0.00")

class CommercialRankingResponse(BaseReportSchema):
    kpis: CommercialKPISchema
    ranking: List[CommercialRankingItem]
    top_treatments: List[TreatmentSalesItem]


# --- SCHEMAS FINANCEIROS & DRE ---

class FinancialDRELineItem(BaseReportSchema):
    account_code: str
    description: str
    amount: Decimal = Decimal("0.00")
    percentage: float = 0.0
    is_group: bool = False
    is_negative: bool = False

class FinancialDREReportResponse(BaseReportSchema):
    period_start: str
    period_end: str
    gross_revenue: Decimal = Decimal("0.00")
    deductions: Decimal = Decimal("0.00")
    net_revenue: Decimal = Decimal("0.00")
    cmv_total: Decimal = Decimal("0.00")
    gross_profit: Decimal = Decimal("0.00")
    gross_margin_pct: float = 0.0
    operating_expenses: Decimal = Decimal("0.00")
    payroll_expenses: Decimal = Decimal("0.00")
    net_profit: Decimal = Decimal("0.00")
    net_margin_pct: float = 0.0
    dre_statement: List[FinancialDRELineItem]


# --- SCHEMAS DE AGING LIST / INADIMPLÊNCIA ---

class AgingTitleItem(BaseReportSchema):
    id: uuid.UUID
    optical_store_id: uuid.UUID
    store_name: str
    document_number: str
    due_date: date
    days_overdue: int = 0
    amount: Decimal = Decimal("0.00")
    amount_paid: Decimal = Decimal("0.00")
    balance_due: Decimal = Decimal("0.00")
    aging_bucket: str  # 'A_VENCER', '1_15', '16_30', '31_60', '60_MAIS'
    status: str

class AgingBucketSummary(BaseReportSchema):
    bucket: str
    label: str
    count: int = 0
    total_amount: Decimal = Decimal("0.00")

class AgingSummarySchema(BaseReportSchema):
    total_receivable: Decimal = Decimal("0.00")
    total_overdue: Decimal = Decimal("0.00")
    total_to_mature: Decimal = Decimal("0.00")
    delinquency_rate_pct: float = 0.0

class FinancialAgingResponse(BaseReportSchema):
    summary: AgingSummarySchema = Field(default_factory=AgingSummarySchema)
    total_receivable: Decimal = Decimal("0.00")
    total_overdue: Decimal = Decimal("0.00")
    total_to_mature: Decimal = Decimal("0.00")
    delinquency_rate_pct: float = 0.0
    bucket_summaries: List[AgingBucketSummary]
    titles: List[AgingTitleItem]
