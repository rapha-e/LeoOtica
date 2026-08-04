import uuid
from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base

class Laboratory(Base):
    __tablename__ = "laboratory_profile"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    cep: Mapped[str] = mapped_column(String(20), nullable=False)
    telephone: Mapped[str] = mapped_column(String(50), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(25), nullable=False)
