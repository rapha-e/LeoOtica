import asyncio
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from decimal import Decimal
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.schemas.lens import RegisterFallbackRequest, ScanRequest
from backend.app.api.endpoints.inventory import register_fallback, scan_barcode
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.models.user import User

async def run_test():
    print("=== INICIANDO TESTE COMPLETO DE INCREMENTO DE ESTOQUE (16 UNIDADES) ===")
    async with AsyncSessionLocal() as db:
        # Obter um usuário qualquer para context
        user_stmt = select(User)
        user = (await db.execute(user_stmt)).scalars().first()
        if not user:
            print("Nenhum usuário encontrado!")
            return

        barcode_test = "2279710000000"
        
        # Limpa o barcode 2279710000000 se existir para começar do zero
        existing = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.barcode == barcode_test))).scalars().first()
        if existing:
            await db.delete(existing)
            await db.commit()
            print(f"Registro antigo de {barcode_test} deletado para o teste.")

        print("\n1. Cadastrando lente inédita bipada com QUANTIDADE = 16...")
        req = RegisterFallbackRequest(
            barcode=barcode_test,
            brand="LP Incolor 1.50",
            material="CR-39",
            refractive_index=Decimal("1.50"),
            treatment="Incolor",
            diameter=70,
            matrix_type="LP_GRADE",
            spherical=Decimal("0.00"),
            cylindrical=Decimal("0.00"),
            quantity=16,
            quantity_available=16,
            location_tag="GAVETA-01"
        )
        print(f"Payload enviado: quantity={req.quantity}, quantity_available={req.quantity_available}")
        
        result1 = await register_fallback(payload=req, current_user=user, db=db)
        print(f"-> Resultado do Primeiro Cadastro: Barcode: {result1.barcode} | Qty no Banco: {result1.quantity_available}")

        print("\n2. Simulando SEGUNDO incremento (+10 unidades) no mesmo código de barras...")
        scan_req = ScanRequest(
            barcode=barcode_test,
            quantity=10
        )
        scan_res = await scan_barcode(payload=scan_req, current_user=user, db=db)
        print(f"-> Resultado da Bipagem Scan: Mensagem: {scan_res.message}")
        print(f"-> Novo Saldo no Banco: {scan_res.item.quantity_available} un (Esperado: 26 un)")

        # Limpeza final do registro de teste
        item_to_del = (await db.execute(select(LensInventoryGrade).where(LensInventoryGrade.barcode == barcode_test))).scalars().first()
        if item_to_del:
            await db.delete(item_to_del)
            await db.commit()
            print("\nLimpeza final do teste concluída com sucesso.")

if __name__ == "__main__":
    asyncio.run(run_test())
