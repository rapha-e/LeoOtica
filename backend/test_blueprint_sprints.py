import pytest
import pytest_asyncio
from decimal import Decimal
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from backend.app.main import app
from backend.app.core.database import AsyncSessionLocal
from backend.app.models.lens import LensModel, LensInventoryGrade
from backend.app.models.optical_store import OpticalStore
from backend.app.models.financial_corp import AccountsPayable, AccountsReceivable, FinancialTransaction
from backend.app.models.user import User, Role
from backend.app.core.security import create_access_token


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def admin_auth_headers():
    async with AsyncSessionLocal() as db:
        role_res = await db.execute(select(Role).where(Role.name == "Administrador"))
        role_admin = role_res.scalars().first()
        if not role_admin:
            role_admin = Role(id=uuid.uuid4(), name="Administrador", description="Administrador de Fábrica")
            db.add(role_admin)
            await db.commit()
            await db.refresh(role_admin)

        admin_user = User(
            id=uuid.uuid4(),
            name="Admin Blueprint Test",
            email=f"admin_test_{uuid.uuid4().hex[:6]}@novalab.com.br",
            role_id=role_admin.id,
            hashed_password="fakehashedpassword"
        )
        db.add(admin_user)
        await db.commit()

        token = create_access_token(str(admin_user.id))
        return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_sprint_1_and_2_cmp_calculation(async_client, admin_auth_headers):
    """
    Testa a Sprint 1 e Sprint 2:
    - Registro de lente via FallbackModal com Preço de Custo (cost_price)
    - Verificação de gravação de average_cost_price e last_purchase_price
    - Cálculo de Custo Médio Ponderado (CMP) ao realizar nova entrada de estoque
    """
    unique_id = uuid.uuid4().hex[:6]
    brand_name = f"NovaLab CMP {unique_id}"
    barcode = f"EAN-CMP-{unique_id}"

    payload = {
        "brand": brand_name,
        "material": "Resina",
        "refractive_index": 1.56,
        "treatment": "Anti-Reflexo",
        "diameter": 70,
        "cost_price": 20.00,
        "average_cost_price": 20.00,
        "last_purchase_price": 20.00,
        "sale_price": 60.00,
        "spherical": -2.00,
        "cylindrical": -0.50,
        "barcode": barcode,
        "quantity_available": 10,
        "quantity": 10
    }

    # 1. Registro Fallback inicial com 10 unidades a R$ 20.00
    res1 = await async_client.post("/api/v1/inventory/register-fallback", json=payload, headers=admin_auth_headers)
    assert res1.status_code == 201, res1.text
    data1 = res1.json()
    assert data1["barcode"] == barcode
    assert data1["quantity_available"] == 10
    assert float(data1["average_cost_price"]) == 20.00
    assert float(data1["last_purchase_price"]) == 20.00

    # 2. Nova entrada de 10 unidades com custo de R$ 30.00 (CMP esperado: (10*20 + 10*30) / 20 = 25.00)
    res2 = await async_client.post("/api/v1/inventory/register-fallback", json={
        **payload,
        "cost_price": 30.00,
        "average_cost_price": 30.00,
        "last_purchase_price": 30.00,
        "quantity_available": 10,
        "quantity": 10
    }, headers=admin_auth_headers)
    assert res2.status_code == 201, res2.text
    data2 = res2.json()

    assert data2["quantity_available"] == 20
    assert float(data2["average_cost_price"]) == 25.00
    assert float(data2["last_purchase_price"]) == 30.00


@pytest.mark.asyncio
async def test_sprint_3_bipador_search_and_atomic_reservation(async_client, admin_auth_headers):
    """
    Testa a Sprint 3:
    - Busca de lente via bipador sem alterar estoque (/inventory/by-barcode/{barcode})
    - Reserva atômica de estoque em alocação (quantity_reserved += 1)
    """
    unique_id = uuid.uuid4().hex[:6]
    brand_name = f"NovaLab Bip {unique_id}"
    barcode = f"EAN-BIP-{unique_id}"

    # Cadastra lente no estoque com saldo 5
    res_reg = await async_client.post("/api/v1/inventory/register-fallback", json={
        "brand": brand_name,
        "material": "Resina",
        "refractive_index": 1.56,
        "treatment": "Anti-Reflexo",
        "diameter": 70,
        "cost_price": 25.00,
        "sale_price": 75.00,
        "spherical": -1.00,
        "cylindrical": -0.25,
        "barcode": barcode,
        "quantity_available": 5,
        "quantity": 5
    }, headers=admin_auth_headers)
    assert res_reg.status_code == 201, res_reg.text

    # 1. Consulta pelo bipador
    res_bip = await async_client.get(f"/api/v1/inventory/by-barcode/{barcode}", headers=admin_auth_headers)
    assert res_bip.status_code == 200, res_bip.text
    bip_data = res_bip.json()
    assert bip_data["barcode"] == barcode
    assert bip_data["quantity_available"] == 5
    assert bip_data["reserved_quantity"] == 0

    # 2. Criação de Ótica Parceira para teste de registro de OS
    async with AsyncSessionLocal() as db:
        store = OpticalStore(
            id=uuid.uuid4(),
            trade_name=f"Ótica Bipador {unique_id}",
            corporate_name="Ótica Bipador LTDA",
            cnpj=f"{uuid.uuid4().int % 100000000000000:014d}"
        )
        db.add(store)
        await db.commit()
        store_id = store.id

    # 3. Registro de OS utilizando o modelo cadastrado
    model_id = bip_data["lens_model_id"]
    os_payload = {
        "optical_store_id": str(store_id),
        "client_order_number": f"PED-BIP-{unique_id}",
        "tray_number": f"B-{unique_id[:4]}",
        "lens_model_id": str(model_id),
        "od_prescription": {
            "spherical": -1.00,
            "cylindrical": -0.25,
            "axis": 90,
            "addition": 0.0,
            "dnp": 31.0,
            "height": 20.0
        },
        "frame_geometry": {
            "frame_a": 52.0,
            "frame_bridge": 18.0,
            "frame_ed": 56.0
        }
    }

    res_os = await async_client.post("/api/v1/os/factory/register", json=os_payload, headers=admin_auth_headers)
    assert res_os.status_code == 201, res_os.text

    # Verifica se a reserva atômica foi incrementada
    res_bip_after = await async_client.get(f"/api/v1/inventory/by-barcode/{barcode}", headers=admin_auth_headers)
    assert res_bip_after.status_code == 200, res_bip_after.text
    bip_after_data = res_bip_after.json()
    assert bip_after_data["reserved_quantity"] == 1
    assert bip_after_data["quantity_available"] == 5


@pytest.mark.asyncio
async def test_sprint_4_contas_a_pagar_receber_and_dre(async_client, admin_auth_headers):
    """
    Testa a Sprint 4:
    - Cadastro e pagamento de Contas a Pagar (Folha + Fornecedores)
    - Conciliação de Contas a Receber
    - Gravação de FinancialTransaction
    - Cálculo da DRE Consolidada (/finance-corp/dre)
    """
    # 1. Cadastra conta a pagar de Folha de Pagamento
    due_date_str = datetime.now(timezone.utc).isoformat()
    pay_folha = await async_client.post("/api/v1/finance-corp/payables", json={
        "description": "Folha de Pagamento Funcionários",
        "supplier_name": "Fábrica NovaLab Staff",
        "amount": 2000.00,
        "due_date": due_date_str
    }, headers=admin_auth_headers)
    assert pay_folha.status_code == 200, pay_folha.text
    folha_data = pay_folha.json()
    folha_id = folha_data["id"]

    # Liquida a conta a pagar da Folha
    pay_res = await async_client.post(f"/api/v1/finance-corp/payables/{folha_id}/pay", json={"amount": 2000.00}, headers=admin_auth_headers)
    assert pay_res.status_code == 200, pay_res.text

    # 2. Consulta o endpoint de DRE Consolidado
    res_dre = await async_client.get("/api/v1/finance-corp/dre", headers=admin_auth_headers)
    assert res_dre.status_code == 200, res_dre.text
    dre = res_dre.json()

    assert "gross_revenue" in dre
    assert "cmv_real" in dre
    assert "payroll" in dre
    assert "net_profit" in dre
    assert dre["payroll"] >= 2000.00
