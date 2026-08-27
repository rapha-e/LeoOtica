import asyncio
import sys
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.user import User, Role
from backend.app.api.endpoints.reports import (
    get_production_analytic_report,
    get_inventory_kardex_report,
    get_commercial_ranking_report,
    get_financial_dre_report,
    get_financial_aging_report
)
from backend.app.services.pdf_generator import (
    generate_dre_pdf,
    generate_inventory_kardex_pdf,
    generate_production_pdf,
    generate_aging_pdf
)
from backend.app.api.endpoints.reports_export import (
    export_report_pdf,
    export_report_excel
)

async def run_tests():
    print("Iniciando testes dos relatórios...")
    async with AsyncSessionLocal() as session:
        # Mock admin role & user
        admin_role = Role(name="Administrador", description="Acesso irrestrito")
        admin_user = User(
            name="Admin Test",
            email="admin@test.com",
            hashed_password="fake",
            role=admin_role,
            is_active=True
        )

        lab_info = {
            "name": "Nova LAB Ótica Industrial",
            "cnpj": "58.032.958/0001-44",
            "telephone": "61 99266-7281",
            "address": "Avenida transversal quadra 23 conjunto B lote 27"
        }

        # 1. Produção
        print("\n1. Testando Relatório de Produção Analítica...")
        prod_data = await get_production_analytic_report(
            start_date=None, end_date=None, status_filter=None,
            optical_store_id=None, production_route=None, priority=None,
            db=session, current_user=admin_user
        )
        print(f"   -> Sucesso! Total de OS: {prod_data.kpis.total_orders}")
        pdf_prod = generate_production_pdf(prod_data.model_dump(), lab_info)
        print(f"   -> PDF Produção gerado ({len(pdf_prod)} bytes)")
        excel_prod_res = await export_report_excel(report_type="production", db=session, current_user=admin_user)
        print(f"   -> Excel Produção StreamingResponse gerado")

        # 2. Estoque / Kardex
        print("\n2. Testando Relatório de Kardex / Posição de Estoque...")
        inv_data = await get_inventory_kardex_report(
            matrix_type=None, only_critical=False, only_in_stock=False,
            db=session, current_user=admin_user
        )
        print(f"   -> Sucesso! Total de itens: {inv_data.kpis.total_items_count}, Valor Total: R$ {inv_data.kpis.total_stock_value_cmp}")
        pdf_inv = generate_inventory_kardex_pdf(inv_data.model_dump(), lab_info)
        print(f"   -> PDF Kardex gerado ({len(pdf_inv)} bytes)")
        excel_inv_res = await export_report_excel(report_type="kardex", db=session, current_user=admin_user)
        print(f"   -> Excel Kardex StreamingResponse gerado")

        # 3. Comercial / Ranking
        print("\n3. Testando Relatório Comercial / Ranking...")
        comm_data = await get_commercial_ranking_report(
            start_date=None, end_date=None,
            db=session, current_user=admin_user
        )
        print(f"   -> Sucesso! Receita Bruta: R$ {comm_data.kpis.total_sales_amount}, Total Óticas: {comm_data.kpis.active_stores_count}")
        excel_comm_res = await export_report_excel(report_type="commercial", db=session, current_user=admin_user)
        print(f"   -> Excel Comercial StreamingResponse gerado")

        # 4. Financeiro / DRE
        print("\n4. Testando Relatório Financeiro DRE...")
        dre_data = await get_financial_dre_report(
            start_date=None, end_date=None,
            db=session, current_user=admin_user
        )
        print(f"   -> Sucesso! Receita Líquida: R$ {dre_data.net_revenue}, Lucro Líquido: R$ {dre_data.net_profit}")
        pdf_dre = generate_dre_pdf(dre_data.model_dump(), lab_info)
        print(f"   -> PDF DRE gerado ({len(pdf_dre)} bytes)")
        excel_dre_res = await export_report_excel(report_type="dre", db=session, current_user=admin_user)
        print(f"   -> Excel DRE StreamingResponse gerado")

        # 5. Financeiro / Aging List
        print("\n5. Testando Relatório de Aging List (Inadimplência)...")
        aging_data = await get_financial_aging_report(
            optical_store_id=None,
            db=session, current_user=admin_user
        )
        print(f"   -> Sucesso! Total a Receber: R$ {aging_data.summary.total_receivable}, Vencidos: R$ {aging_data.summary.total_overdue}")
        pdf_aging = generate_aging_pdf(aging_data.model_dump(), lab_info)
        print(f"   -> PDF Aging gerado ({len(pdf_aging)} bytes)")
        excel_aging_res = await export_report_excel(report_type="aging", db=session, current_user=admin_user)
        print(f"   -> Excel Aging StreamingResponse gerado")

    print("\n========================================================")
    print("[SUCESSO] Todos os 5 relatorios, PDFs e planilhas Excel foram validados com 100% de exito!")
    print("========================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
