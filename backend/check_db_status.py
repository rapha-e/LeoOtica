import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.insert(0, r'c:\Users\rapha\Documents\LeoOtica')

from backend.app.core.database import AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.os import ServiceOrder
from backend.app.models.movement import StockMovement

async def check():
    async with AsyncSessionLocal() as db:
        u_count = len((await db.execute(select(User))).scalars().all())
        m_count = len((await db.execute(select(LensModel))).scalars().all())
        g_count = len((await db.execute(select(LensInventoryGrade))).scalars().all())
        os_count = len((await db.execute(select(ServiceOrder))).scalars().all())
        mov_count = len((await db.execute(select(StockMovement))).scalars().all())
        sum_stock = (await db.execute(select(func.sum(LensInventoryGrade.quantity_available)))).scalar() or 0
        print(f"Usuarios: {u_count}, Modelos: {m_count}, Dioptrias na Grade: {g_count}, OS: {os_count}, Movimentacoes: {mov_count}, SaldoTotalEstoque: {sum_stock}")

if __name__ == "__main__":
    asyncio.run(check())
