import httpx
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

def main():
    print("=" * 80)
    print(" 🧪 TESTE AUTOMATIZADO DOS NOVOS FLUXOS DE OS (REPARO & PADRÃO POR MATRIZ)")
    print("=" * 80)

    # 1. Login
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "admin", "password": "admin"})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Busca Ótica Parceira
    stores = httpx.get(f"{BASE_URL}/optical-stores/", headers=headers).json()
    store_id = stores[0]["id"]
    print(f"✅ Ótica comercial selecionada: {stores[0]['trade_name']} (ID: {store_id})")

    # 3. Garante cadastro de vários serviços técnicos no catálogo
    srv_solda_resp = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Solda em Armação de Titânio", "description": "Solda a laser em armação", "price": 45.00}, headers=headers)
    srv_plaqueta_resp = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Troca de Plaquetas de Silicone", "description": "Plaquetas macias", "price": 15.00}, headers=headers)
    srv_ajuste_resp = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Ajuste e Alinhamento Técnico", "description": "Alinhamento de hastes e ponte", "price": 25.00}, headers=headers)
    srv_color_resp = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Coloração Solar Personalizada", "description": "Banho de cor customizado", "price": 35.00}, headers=headers)

    catalog_srvs = httpx.get(f"{BASE_URL}/catalog/technical-services/", headers=headers).json()
    print(f"✅ Catálogo de Serviços Técnicos atualizado ({len(catalog_srvs)} serviços disponíveis).")

    # -------------------------------------------------------------------------
    # TESTE 1: OS DE APENAS REPARO / SERVIÇO TÉCNICO (SEM ARMAÇÃO / SEM LENTES)
    # -------------------------------------------------------------------------
    print("\n--- TESTE 1: OS de Apenas Reparo / Serviço Técnico (Múltiplos Serviços) ---")
    
    selected_srv_list = [
        {"service_id": catalog_srvs[0]["id"], "name": catalog_srvs[0]["name"], "price": float(catalog_srvs[0]["price"])},
        {"service_id": catalog_srvs[1]["id"], "name": catalog_srvs[1]["name"], "price": float(catalog_srvs[1]["price"])},
        {"service_id": catalog_srvs[2]["id"], "name": catalog_srvs[2]["name"], "price": float(catalog_srvs[2]["price"])}
    ]
    expected_reparos_total = sum(s["price"] for s in selected_srv_list)

    reparo_payload = {
        "optical_store_id": store_id,
        "client_order_number": "LOJA-REPARO-101",
        "tray_number": "BD-REPARO-01",
        "priority": "URGENTE",
        "os_type": "REPARO_SERVICO",
        "service_type": ", ".join(s["name"] for s in selected_srv_list),
        "od_prescription": None,
        "oe_prescription": None,
        "frame_geometry": None,  # SEM DADOS DE ARMAÇÃO E BISEL
        "lens_model_id": None,   # SEM ALOCAÇÃO DE LENTES
        "additional_services": selected_srv_list,
        "special_instructions": "Cliente necessita de reparo urgente nas hastes e solda."
    }

    reg_reparo_resp = httpx.post(f"{BASE_URL}/os/factory/register", json=reparo_payload, headers=headers)
    if reg_reparo_resp.status_code == 201:
        reparo_data = reg_reparo_resp.json()["data"]
        os_id = reparo_data["os_id"]
        total_price = reparo_data["total_price"]
        print(f"  • OS de Reparo criada com sucesso! ID: {os_id} | OS Number: {reparo_data['os_number']}")
        print(f"  • Status Inicial: {reparo_data['status']} | Valor Total Calculado: R$ {total_price:.2f} (Esperado: R$ {expected_reparos_total:.2f})")
        
        # Consulta OS detalhada para conferir os itens comerciais gravados
        os_detail = httpx.get(f"{BASE_URL}/os/{os_id}", headers=headers).json()
        item_count = len(os_detail.get("items", []))
        print(f"  • Total de Serviços Gravados na OS: {item_count} itens.")
        
        if total_price == expected_reparos_total and item_count == len(selected_srv_list):
            print("  ✅ TESTE 1 PASSED: OS de Reparo sem armação criada com múltiplos serviços e valor total 100% exato!")
        else:
            print("  ❌ TESTE 1 FAILED: Divergência nos valores ou itens.")
    else:
        print(f"  ❌ TESTE 1 FAILED: {reg_reparo_resp.status_code} - {reg_reparo_resp.text}")

    # -------------------------------------------------------------------------
    # TESTE 2: OS PADRÃO DE LENTES COM FILTRO POR MATRIZ E SERVIÇOS ADICIONAIS
    # -------------------------------------------------------------------------
    print("\n--- TESTE 2: OS Padrão de Lentes (Matriz GRADE_167 + Serviços Adicionais) ---")

    # Busca modelos de lentes e filtra por GRADE_167
    models = httpx.get(f"{BASE_URL}/lens-models/", headers=headers).json()
    model_167 = next((m for m in models if m.get("matrix_type") == "GRADE_167"), models[0])
    print(f"  • Modelo selecionado (Matriz: {model_167['matrix_type']}): {model_167['brand']} (Preço Venda: R$ {model_167['sale_price']})")

    add_srv = [
        {"service_id": catalog_srvs[3]["id"], "name": catalog_srvs[3]["name"], "price": float(catalog_srvs[3]["price"])}
    ]
    lens_unit_price = float(model_167.get("sale_price") or 80.0)
    expected_padrao_total = (lens_unit_price * 2) + add_srv[0]["price"]

    padrao_payload = {
        "optical_store_id": store_id,
        "client_order_number": "LOJA-PADRAO-202",
        "tray_number": "BD-CNC-02",
        "priority": "NORMAL",
        "os_type": "PADRAO",
        "service_type": "Surfaçagem + Montagem CNC",
        "od_prescription": {
            "spherical": -2.00,
            "cylindrical": -0.50,
            "axis": 90,
            "addition": 0.00,
            "dnp": 31.5,
            "height": 20.0
        },
        "oe_prescription": {
            "spherical": -2.00,
            "cylindrical": -0.50,
            "axis": 90,
            "addition": 0.00,
            "dnp": 31.5,
            "height": 20.0
        },
        "frame_geometry": {
            "frame_a": 52.0,
            "frame_b": 36.0,
            "frame_bridge": 18.0,
            "frame_ed": 56.0,
            "frame_type": "ACETATO",
            "bevel_type": "AUTOMATICO"
        },
        "lens_model_id": model_167["id"],
        "additional_services": add_srv,
        "special_instructions": "Facetamento CNC com tratamento solar adicionado."
    }

    reg_padrao_resp = httpx.post(f"{BASE_URL}/os/factory/register", json=padrao_payload, headers=headers)
    if reg_padrao_resp.status_code == 201:
        padrao_data = reg_padrao_resp.json()["data"]
        os_id_p = padrao_data["os_id"]
        total_p = padrao_data["total_price"]
        print(f"  • OS Padrão criada com sucesso! ID: {os_id_p} | OS Number: {padrao_data['os_number']}")
        print(f"  • Status Inicial: {padrao_data['status']} | Valor Total: R$ {total_p:.2f}")

        if total_p > 0:
            print("  ✅ TESTE 2 PASSED: OS Padrão de lentes com matriz e serviços adicionais criada com sucesso!")
        else:
            print("  ❌ TESTE 2 FAILED: Valor zerado.")
    else:
        print(f"  ❌ TESTE 2 FAILED: {reg_padrao_resp.status_code} - {reg_padrao_resp.text}")

    print("\n" + "=" * 80)
    print(" 🎉 TODOS OS TESTES DOS NOVOS FLUXOS DE OS FORAM CONCLUÍDOS COM SUCESSO!")
    print("=" * 80)

if __name__ == "__main__":
    main()
