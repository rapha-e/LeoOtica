import httpx
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

def main():
    print("=" * 80)
    print(" 🧪 TESTE DE VALIDAÇÃO DE ALOCAÇÃO, ESTORNO NO CANCELAMENTO E DEDUÇÃO NO RETRABALHO")
    print("=" * 80)

    # 1. Login
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "admin", "password": "admin"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Cadastro de Lente de Teste em Estoque com Saldo = 10
    reg_payload = {
        "brand": "Lente Teste Fluxo Alocacao",
        "material": "Resina",
        "refractive_index": "1.56",
        "treatment": "AR Standard",
        "diameter": 70,
        "matrix_type": "LP_GRADE",
        "spherical": "-2.00",
        "cylindrical": "-1.00",
        "barcode": "FLOW-TEST-999",
        "location_tag": "GAVETA-FLOW-1",
        "quantity_available": 10
    }
    reg_resp = httpx.post(f"{BASE_URL}/inventory/register-fallback", json=reg_payload, headers=headers)
    lens_item = reg_resp.json()
    model_id = lens_item["lens_model_id"]
    lens_id = lens_item["id"]

    grid_item = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    target_item = next(i for i in grid_item if i["id"] == lens_id)
    initial_qty = target_item["quantity_available"]
    print(f"✅ Lente de teste criada no estoque! ID: {lens_id} | Saldo Inicial: {initial_qty} unidades.")

    # -------------------------------------------------------------------------
    # TESTE 1: DESFECHO C - ALOCAÇÃO E ESTORNO NO CANCELAMENTO
    # -------------------------------------------------------------------------
    print("\n--- TESTE 1: Desfecho C (Cancelamento com Estorno de Saldo) ---")
    os_payload = {
        "os_number": "OS-FLOW-CANCEL-01",
        "client_name": "Cliente Teste Cancelamento",
        "od_spherical": -2.00,
        "od_cylindrical": -1.00,
        "oe_spherical": -2.00,
        "oe_cylindrical": -1.00,
        "od_dnp": 32.00,
        "oe_dnp": 32.00,
        "frame_a": 52.00,
        "frame_bridge": 18.00,
        "frame_ed": 55.00,
        "lens_model_id": model_id
    }
    create_os = httpx.post(f"{BASE_URL}/os/", json=os_payload, headers=headers).json()
    os_id = create_os["id"]

    # Alocação
    alloc = httpx.post(
        f"{BASE_URL}/os/{os_id}/allocate",
        json={"frame_a": 52.0, "frame_bridge": 18.0, "frame_ed": 55.0, "lens_model_id": model_id, "od_dnp": 32.0, "oe_dnp": 32.0},
        headers=headers
    ).json()

    # Verifica saldo no estoque pós-alocação (Deve ser initial_qty - 2)
    grid_post_alloc = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    item_post_alloc = next(i for i in grid_post_alloc if i["id"] == lens_id)
    qty_after_alloc = item_post_alloc["quantity_available"]
    print(f"  • Após Alocação (2 unidades reservadas): Saldo no Estoque = {qty_after_alloc} (Esperado: {initial_qty - 2})")

    # Cancelamento Compulsório
    canc = httpx.post(f"{BASE_URL}/os/{os_id}/cancel", json={"cancellation_reason": "Cancelamento de Teste"}, headers=headers).json()

    # Verifica saldo pós-cancelamento (Deve voltar para initial_qty)
    grid_post_canc = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    item_post_canc = next(i for i in grid_post_canc if i["id"] == lens_id)
    qty_after_canc = item_post_canc["quantity_available"]
    print(f"  • Após Cancelamento (Estorno automático): Saldo no Estoque = {qty_after_canc} (Esperado: {initial_qty})")

    if qty_after_canc == initial_qty:
        print("  ✅ DESFECHO C TESTADO E CONFIRMADO! O estorno de saldo no cancelamento funcionou perfeitamente!")
    else:
        print("  ❌ FALHA NO ESTORNO DO DESFECHO C!")

    # -------------------------------------------------------------------------
    # TESTE 2: DESFECHO B - REPROCESSAMENTO POR QUEBRA E NOVA ALOCAÇÃO
    # -------------------------------------------------------------------------
    print("\n--- TESTE 2: Desfecho B (Reprocessamento por Quebra & Nova Alocação) ---")
    os_b_payload = {
        "os_number": "OS-FLOW-REWORK-02",
        "client_name": "Cliente Teste Rework Quebra",
        "od_spherical": -2.00,
        "od_cylindrical": -1.00,
        "oe_spherical": -2.00,
        "oe_cylindrical": -1.00,
        "od_dnp": 32.00,
        "oe_dnp": 32.00,
        "frame_a": 52.00,
        "frame_bridge": 18.00,
        "frame_ed": 55.00,
        "lens_model_id": model_id
    }
    create_os_b = httpx.post(f"{BASE_URL}/os/", json=os_b_payload, headers=headers).json()
    os_b_id = create_os_b["id"]

    # 1ª Alocação (Dedução de 2 unidades: saldo = initial_qty - 2)
    httpx.post(
        f"{BASE_URL}/os/{os_b_id}/allocate",
        json={"frame_a": 52.0, "frame_bridge": 18.0, "frame_ed": 55.0, "lens_model_id": model_id, "od_dnp": 32.0, "oe_dnp": 32.0},
        headers=headers
    )
    
    grid_b1 = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    qty_b1 = next(i for i in grid_b1 if i["id"] == lens_id)["quantity_available"]
    print(f"  • Saldo após 1ª Alocação: {qty_b1}")

    # Quebra de Lente (Reprocessamento) -> Inutiliza lentes anteriores e manda OS de volta para Recebida
    reproc_resp = httpx.post(f"{BASE_URL}/os/{os_b_id}/reprocess", json={"operator_notes": "Lente trincou no facetamento"}, headers=headers)
    print(f"  • Quebra registrada! Status da OS retornado para: {reproc_resp.json()['status']}")

    # 2ª Alocação de Novas Lentes (Nova dedução de 2 unidades: saldo = initial_qty - 4)
    httpx.post(
        f"{BASE_URL}/os/{os_b_id}/allocate",
        json={"frame_a": 52.0, "frame_bridge": 18.0, "frame_ed": 55.0, "lens_model_id": model_id, "od_dnp": 32.0, "oe_dnp": 32.0},
        headers=headers
    )

    grid_b2 = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    qty_b2 = next(i for i in grid_b2 if i["id"] == lens_id)["quantity_available"]
    print(f"  • Saldo após 2ª Alocação (Substituição por Quebra): {qty_b2} (Esperado: {initial_qty - 4})")

    if qty_b2 == (initial_qty - 4):
        print("  ✅ DESFECHO B TESTADO E CONFIRMADO! O fluxo de reprocessamento por quebra, baixa de lentes destruídas e alocação de novo par funcionou perfeitamente!")
    else:
        print("  ❌ FALHA NO REPROCESSAMENTO DO DESFECHO B!")

    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
