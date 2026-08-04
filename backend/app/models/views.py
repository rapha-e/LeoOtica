from decimal import Decimal
from sqlalchemy import Numeric, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base

class LensConsumptionVelocity(Base):
    __tablename__ = "view_lens_consumption_velocity"
    
    # Mapeamento do SQLAlchemy para a View SQL Read-only
    lens_inventory_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand: Mapped[str] = mapped_column(String(100))
    material: Mapped[str] = mapped_column(String(50))
    spherical: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    cylindrical: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    quantity_available: Mapped[int] = mapped_column(Integer)
    units_consumed_30_days: Mapped[int] = mapped_column(Integer)
    daily_burn_rate: Mapped[Decimal] = mapped_column(Numeric(4, 2))
