import asyncio
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.core.config import settings
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensInventoryGrade
from backend.app.schemas.movement import StockMovementCreate
from backend.app.crud import movement as crud_movement, lens as crud_lens
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def main():
    barcode = "2279710000000"
    qty_to_add = 10

    async with AsyncSessionLocal() as db:
        item = await crud_lens.get_inventory_by_barcode(db, barcode)
        if not item:
            print(f"Lente com código {barcode} não encontrada no banco.")
            return

        initial_qty = item.quantity_available
        print("=== ESTADO INICIAL DA LENTE ===")
        print(f"Código de Barras: {item.barcode}")
        print(f"Modelo: {item.lens_model.brand if item.lens_model else 'N/A'}")
        print(f"ESF: {item.spherical:.2f} | CIL: {item.cylindrical:.2f}")
        print(f"Quantidade em Estoque ANTES: {initial_qty} unidades")
        print(f"Gaveta / Localização: {item.location_tag}")
        print("-" * 50)

        # Executa o incremento no estoque exatamente como a API /scan faz
        movement_in = StockMovementCreate(
            lens_inventory_id=item.id,
            movement_type="AUDIT",
            quantity=qty_to_add,
            reason=f"Bipagem e Incremento de Estoque (+{qty_to_add})"
        )
        updated_movement = await crud_movement.create_stock_movement(db, movement_in)
        await db.commit()

        updated_item = updated_movement.lens_inventory
        new_qty = updated_item.quantity_available

        print("=== RESULTADO DA OPERAÇÃO DE INCREMENTO ===")
        print(f"Quantidade ANTES: {initial_qty} un")
        print(f"Quantidade ADICIONADA: +{qty_to_add} un")
        print(f"Quantidade DEPOIS (Novo Saldo): {new_qty} un")
        print("-" * 50)

        if new_qty == initial_qty + qty_to_add:
            print("✅ TESTE CONCLUÍDO COM SUCESSO! A adição das 10 unidades foi realizada e persistida no banco de dados com sucesso.")
        else:
            print(f"❌ DIVERGÊNCIA: Esperado {initial_qty + qty_to_add}, encontrado {new_qty}")

if __name__ == "__main__":
    asyncio.run(main())
