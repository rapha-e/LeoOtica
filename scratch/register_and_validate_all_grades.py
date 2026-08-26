import httpx
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

def main():
    print("=" * 80)
    print(" 🚀 CADASTRO DE LENTE EM CADA GRADE E VALIDAÇÃO DE SUCESSO")
    print("=" * 80)

    # 1. Autenticação
    print("\n1. Autenticando com usuário admin...")
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "admin", "password": "admin"})
    if resp.status_code != 200:
        print(f"❌ Erro na autenticação: {resp.status_code} - {resp.text}")
        sys.exit(1)

    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Autenticação realizada com sucesso!")

    # Definindo as 5 grades (Matrizes Ópticas)
    target_matrices = [
        {
            "matrix_type": "LP_GRADE",
            "grid_name": "Grade Visão Simples (LP Grade)",
            "brand": "Lente Pronta LP AR 1.56 - Teste",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": -2.00,
            "cylindrical": -0.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "7891000000011",
            "location_tag": "GAVETA-LP-A1",
            "quantity": 10
        },
        {
            "matrix_type": "GRADE_167",
            "grid_name": "Grade 1.67 (Alto Índice)",
            "brand": "Lente 1.67 AR Asférica - Teste",
            "material": "Alto Índice 1.67",
            "refractive_index": 1.67,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": -6.00,
            "cylindrical": -1.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "7891000000022",
            "location_tag": "GAVETA-167-B2",
            "quantity": 12
        },
        {
            "matrix_type": "MF_ACB",
            "grid_name": "Grade Multifocal Acabado (MF ACB)",
            "brand": "Multifocal Acabado Prog 1.56 - Teste",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": 1.00,
            "cylindrical": -0.50,
            "base_curve": 4.00,
            "addition": 2.00,
            "eye": "OD",
            "barcode": "7891000000033",
            "location_tag": "GAVETA-MFACB-C3",
            "quantity": 8
        },
        {
            "matrix_type": "BLOCO_VS",
            "grid_name": "Grade Bloco Visão Simples (BLOCO VS)",
            "brand": "Bloco VS Surfaçagem CNC - Teste",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Incolor Base",
            "diameter": 75,
            "spherical": 0.00,
            "cylindrical": 0.00,
            "base_curve": 4.25,
            "addition": None,
            "eye": None,
            "barcode": "7891000000044",
            "location_tag": "GAVETA-BVS-D4",
            "quantity": 15
        },
        {
            "matrix_type": "MF_BLOCO",
            "grid_name": "Grade Bloco Multifocal (MF BLOCO)",
            "brand": "Bloco MF Semi-Acabado - Teste",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Incolor Base",
            "diameter": 75,
            "spherical": 0.00,
            "cylindrical": 0.00,
            "base_curve": 6.00,
            "addition": 2.50,
            "eye": "OD",
            "barcode": "7891000000055",
            "location_tag": "GAVETA-BMF-E5",
            "quantity": 20
        }
    ]

    results = []

    for idx, item in enumerate(target_matrices, 1):
        m_type = item["matrix_type"]
        grid_name = item["grid_name"]
        print(f"\n------------------------------------------------------------------------")
        print(f"📌 {idx}. Efetuando Cadastro na Grade: {grid_name} ({m_type})")
        print(f"------------------------------------------------------------------------")

        # 1. Cadastro via Register Fallback (cria modelo e insere item na grade)
        payload = {
            "brand": item["brand"],
            "material": item["material"],
            "refractive_index": str(item["refractive_index"]),
            "treatment": item["treatment"],
            "diameter": item["diameter"],
            "matrix_type": m_type,
            "production_route": "EXPRESSA_FACETAMENTO" if "GRADE" in m_type or "ACB" in m_type else "SURFACAGEM_CNC",
            "cost_price": "30.00",
            "sale_price": "80.00",
            "degree_threshold": "2.00",
            "sale_price_over_threshold": "100.00",
            "spherical": str(item["spherical"]),
            "cylindrical": str(item["cylindrical"]),
            "base_curve": str(item["base_curve"]) if item["base_curve"] is not None else None,
            "addition": str(item["addition"]) if item["addition"] is not None else None,
            "eye": item["eye"],
            "barcode": item["barcode"],
            "location_tag": item["location_tag"],
            "quantity_available": item["quantity"]
        }

        reg_resp = httpx.post(f"{BASE_URL}/inventory/register-fallback", json=payload, headers=headers)
        if reg_resp.status_code not in (200, 201):
            print(f"❌ Erro ao cadastrar item na grade {m_type}: {reg_resp.status_code} - {reg_resp.text}")
            results.append({"matrix": m_type, "status": "FAIL", "reason": reg_resp.text})
            continue

        created_item = reg_resp.json()
        print(f"✅ Item enviado ao backend e cadastrado com ID: {created_item['id']}")

        # 2. Validação de pertencer à grade correta e retorno no grid de estoque
        scan_resp = httpx.post(f"{BASE_URL}/inventory/scan", json={"barcode": item["barcode"]}, headers=headers)
        if scan_resp.status_code != 200:
            print(f"❌ Erro na consulta/bipagem de validação: {scan_resp.status_code}")
            results.append({"matrix": m_type, "status": "FAIL", "reason": "Erro no scan"})
            continue

        scan_data = scan_resp.json()
        if not scan_data.get("found") or not scan_data.get("item"):
            print(f"❌ Validação falhou: Item não localizado por barcode.")
            results.append({"matrix": m_type, "status": "FAIL", "reason": "Item não encontrado no scan"})
            continue

        retrieved_item = scan_data["item"]
        model_info = retrieved_item.get("lens_model") or {}
        actual_matrix_type = model_info.get("matrix_type")

        # Validações dos critérios
        valid_matrix = (actual_matrix_type == m_type)
        valid_barcode = (retrieved_item.get("barcode") == item["barcode"])
        valid_location = (retrieved_item.get("location_tag") == item["location_tag"])

        if valid_matrix and valid_barcode and valid_location:
            print(f"🎉 VALIDAÇÃO DE SUCESSO NA GRADE CORRETA:")
            print(f"   • Modelo: {model_info.get('brand')} (ID: {model_info.get('id')})")
            print(f"   • Matriz Cadastrada: '{actual_matrix_type}' (Esperado: '{m_type}') -> COINCIDE CORRETAMENTE! ✅")
            print(f"   • Código de Barras: {retrieved_item.get('barcode')} ✅")
            print(f"   • Localização Física: {retrieved_item.get('location_tag')} ✅")
            print(f"   • Saldo em Estoque: {retrieved_item.get('quantity_available')} unidades ✅")
            results.append({"matrix": m_type, "status": "SUCCESS", "details": retrieved_item})
        else:
            print(f"❌ Validação falhou nos atributos: Matriz={actual_matrix_type}, Barcode={retrieved_item.get('barcode')}")
            results.append({"matrix": m_type, "status": "FAIL", "reason": "Divergência de atributos no banco"})

    print("\n" + "=" * 80)
    print("📊 RESUMO FINAL DA VALIDAÇÃO EM CADA GRADE:")
    print("=" * 80)
    successes = 0
    for res in results:
        status_icon = "✅ SUCESSO" if res["status"] == "SUCCESS" else "❌ FALHA"
        print(f"  • Matriz {res['matrix']:<12}: {status_icon}")
        if res["status"] == "SUCCESS":
            successes += 1

    print(f"\nTotal: {successes}/{len(target_matrices)} grades validadas com 100% de sucesso!")

if __name__ == "__main__":
    main()
