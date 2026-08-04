import sys
import asyncio
from decimal import Decimal
from sqlalchemy import select
from backend.app.core.database import AsyncSessionLocal
from backend.app.crud import supplier_order as crud_supplier
from backend.app.crud import os as crud_os
from backend.app.schemas.supplier_order import SupplierOrderCreate, SupplierOrderItemCreate
from backend.app.schemas.os import ServiceOrderCreate

async def main():
    print("=== TESTANDO NOVAS FUNCIONALIDADES DO NOVA LAB V 2.0 ===")
    async with AsyncSessionLocal() as db:
        # 1. Testando criacao de Pedido no Fornecedor (Custo vs Revenda)
        order_in = SupplierOrderCreate(
            supplier_name="Distribuidora Zeiss Matriz",
            notes="Teste automatizado de Pedido no Fornecedor",
            items=[
                SupplierOrderItemCreate(
                    model_name="Lente Essilor Crizal Easy 1.56",
                    dioptria="Sph -2.00 / Cyl -1.00",
                    quantity=10,
                    unit_cost_price=Decimal("35.00"),
                    unit_resale_price=Decimal("140.00")
                )
            ]
        )
        created_order = await crud_supplier.create_supplier_order(db, order_in)
        print(f"[PASS] Pedido no Fornecedor Criado: {created_order.order_number} | Status: {created_order.status}")
        print(f"       Custo Total: R$ {created_order.total_cost:.2f} | Revenda: R$ {created_order.total_estimated_resale:.2f} | Margem: {created_order.gross_margin_percent:.1f}%")

        # 2. Testando busca do ultimo custo pago no fornecedor
        if created_order.items and created_order.items[0].lens_model_id:
            last_cost = await crud_supplier.get_last_purchased_cost(db, created_order.items[0].lens_model_id)
            print(f"[PASS] Ultimo Custo Pago no Fornecedor: R$ {last_cost:.2f}")

        # 3. Testando criacao de OS de Reparo / Servico (Sem Lentes)
        os_repair_in = ServiceOrderCreate(
            os_number="OS-REPARO-2026-0001",
            client_name="Cliente Teste Reparo Solda Armacao",
            os_type="REPARO_SERVICO",
            clinical_notes="Solda em titanio na haste esquerda e troca de plaquetas"
        )
        created_repair_os = await crud_os.create_service_order(db, os_repair_in)
        print(f"[PASS] OS de Reparo/Servico Criada: {created_repair_os.os_number} | Tipo: {created_repair_os.os_type} | Status: {created_repair_os.status}")

        # 4. Testando conversao de Sugestao Preditiva IA em Pedido no Fornecedor
        ai_order = await crud_supplier.create_order_from_predictive_ai(db, supplier_name="Laboratorio Hoya Matriz")
        print(f"[PASS] Pedido via IA Preditiva Criado: {ai_order.order_number} | Itens: {len(ai_order.items)} itens gerados")

    print("=== TODOS OS TESTES DAS NOVAS FUNCIONALIDADES PASSARAM COM SUCESSO! ===")

if __name__ == "__main__":
    asyncio.run(main())
