import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base

class CustomerPriceTable(Base):
    __tablename__ = "customer_price_tables"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    optical_store_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("optical_stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relacionamentos
    optical_store: Mapped["OpticalStore"] = relationship("OpticalStore", foreign_keys="CustomerPriceTable.optical_store_id")


    items: Mapped[List["CustomerPriceItem"]] = relationship(
        "CustomerPriceItem", back_populates="price_table", cascade="all, delete-orphan"
    )

class CustomerPriceItem(Base):
    __tablename__ = "customer_price_items"
    
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    price_table_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customer_price_tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'product', 'treatment', 'service'
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    custom_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relacionamentos
    price_table: Mapped[CustomerPriceTable] = relationship(CustomerPriceTable, back_populates="items")
