import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base

class DegreePricingPolicy(Base):
    __tablename__ = "degree_pricing_policy"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    degree_threshold: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("2.00"), nullable=False)
    default_sale_price_le: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("75.00"), nullable=False)
    default_sale_price_gt: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("95.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
