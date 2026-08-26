import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from backend.app.core.database import engine, AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.financial_catalog import Product
from backend.app.crud.lens import create_lens_model, create_inventory_item, delete_lens_model, get_inventory_grid
from backend.app.schemas.lens import LensModelCreate, LensInventoryGradeCreate
from backend.app.crud.financial_catalog import delete_product

async def test_deletion_cascade():
    async with AsyncSessionLocal() as db:
        print("--- 1. Criando Modelo de Lente Teste ---")
        model_data = LensModelCreate(
            brand="MarcaTesteDelete",
            material="Resina",
            refractive_index=Decimal("1.56"),
            treatment="AR",
            diameter=70,
            cost_price=Decimal("20.00"),
            sale_price=Decimal("80.00")
        )
        model = await create_lens_model(db, model_data)
        print(f"Modelo criado. ID: {model.id}")

        print("--- 2. Adicionando itens na grade de estoque (dioptrias) ---")
        item1 = await create_inventory_item(db, LensInventoryGradeCreate(
            lens_model_id=model.id,
            spherical=Decimal("-2.00"),
            cylindrical=Decimal("-1.00"),
            quantity_available=15,
            barcode="DELTEST001"
        ))
        item2 = await create_inventory_item(db, LensInventoryGradeCreate(
            lens_model_id=model.id,
            spherical=Decimal("-4.00"),
            cylindrical=Decimal("-2.00"),
            quantity_available=20,
            barcode="DELTEST002"
        ))

        # Verifica se os itens foram gravados na grade
        grid = await get_inventory_grid(db, lens_model_id=model.id)
        assert len(grid) == 2, f"Esperado 2 itens na grade, encontrado {len(grid)}"
        print(f"Itens na grade antes da exclusao: {len(grid)}")

        print("--- 3. Excluindo Modelo da Lente ---")
        success = await delete_lens_model(db, model.id)
        assert success, "delete_lens_model falhou!"

        # Verifica se a grade foi totalmente excluida do banco
        grid_after = await get_inventory_grid(db, lens_model_id=model.id)
        assert len(grid_after) == 0, f"Grade de estoque ainda possui {len(grid_after)} itens!"
        print("SUCCESS: Grade de estoque limpa com sucesso ao deletar a lente!")

        print("\n--- 4. Testando exclusao via Catálogo Comercial (Product) ---")
        model2 = await create_lens_model(db, LensModelCreate(
            brand="MarcaTesteProdDelete",
            material="CR-39",
            refractive_index=Decimal("1.50"),
            treatment="Incolor",
            diameter=70
        ))
        await create_inventory_item(db, LensInventoryGradeCreate(
            lens_model_id=model2.id,
            spherical=Decimal("0.00"),
            cylindrical=Decimal("0.00"),
            quantity_available=10,
            barcode="DELPROD001"
        ))

        # Busca produto no catalogo associado
        p_res = await db.execute(select(Product).where(Product.lens_model_id == model2.id))
        prod = p_res.scalar_one()
        print(f"Produto Comercial criado com sucesso. ID: {prod.id}")

        print("--- Excluindo produto do catalogo ---")
        del_prod_success = await delete_product(db, prod.id)
        assert del_prod_success, "delete_product falhou!"

        grid_prod_after = await get_inventory_grid(db, lens_model_id=model2.id)
        assert len(grid_prod_after) == 0, "Grade de estoque ainda existe apos exclusao do produto da lente!"
        print("SUCCESS: Grade de estoque limpa com sucesso ao excluir produto do catalogo comercial!")

        print("\n==================================================")
        print("TODOS OS TESTES DE DELECAO DE GRADE PASSARAM COM SUCESSO!")
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_deletion_cascade())
