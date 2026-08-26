import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_full_system_validation():
    print("=" * 80)
    print(" TESTE E VALIDACAO COMPLETA DO SISTEMA DE LENTES E GRADES")
    print("=" * 80)

    # 1. Autenticacao
    print("\n1. Autenticando usuario Administrador...")
    auth_resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "admin@leootica.com.br", "password": "admin123"}
    )
    if auth_resp.status_code != 200:
        print(f" ERROR: Falha na autenticacao: {auth_resp.text}")
        return
    
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(" [OK] Autenticado com sucesso!")

    # 2. Teste de Cadastro de Marca, Modelo e Tratamento nas 5 Grades Opticas
    matrix_test_cases = [
        {
            "matrix_type": "LP_GRADE",
            "matrix_name": "Visao Simples Lente Pronta (LP_GRADE)",
            "brand": "Essilor Teste",
            "name": "Crizal Sapphire HR 1.56",
            "treatment": "Anti-Reflexo AR",
            "spherical": -2.50,
            "cylindrical": -1.00,
            "barcode": "7899000000101",
            "location_tag": "GAV-LP-01"
        },
        {
            "matrix_type": "LP_GRADE",
            "matrix_name": "Visao Simples Lente Pronta (Tratamento BlueCut)",
            "brand": "Hoya Teste",
            "name": "BlueControl 1.56",
            "treatment": "Filtro Azul / BlueCut",
            "spherical": -3.00,
            "cylindrical": -0.50,
            "barcode": "7899000000102",
            "location_tag": "GAV-LP-02"
        },
        {
            "matrix_type": "GRADE_167",
            "matrix_name": "Grade 1.67 Alto Indice (GRADE_167)",
            "brand": "NovaLab Teste",
            "name": "Miya 1.67 Asferica",
            "treatment": "Photo 1.67 AR",
            "spherical": -6.00,
            "cylindrical": -2.00,
            "barcode": "7899000000103",
            "location_tag": "GAV-167-01"
        },
        {
            "matrix_type": "MF_ACB",
            "matrix_name": "Multifocal Acabado (MF_ACB)",
            "brand": "Kodak Teste",
            "name": "Kodak Precise 1.56",
            "treatment": "Clean&Clear AR",
            "spherical": 1.50,
            "cylindrical": -0.75,
            "base_curve": 4.00,
            "addition": 2.00,
            "eye": "OD",
            "barcode": "7899000000104",
            "location_tag": "GAV-MFACB-01"
        },
        {
            "matrix_type": "BLOCO_VS",
            "matrix_name": "Bloco Visao Simples (BLOCO_VS)",
            "brand": "Zeiss Teste",
            "name": "Bloco VS Policarbonato",
            "treatment": "Incolor Semiacabado",
            "spherical": 0.0,
            "cylindrical": 0.0,
            "base_curve": 6.00,
            "barcode": "7899000000105",
            "location_tag": "GAV-BLOCO-VS-01"
        },
        {
            "matrix_type": "MF_BLOCO",
            "matrix_name": "Bloco Multifocal (MF_BLOCO)",
            "brand": "Shamir Teste",
            "name": "Bloco MF Progressive",
            "treatment": "Incolor HardClear",
            "spherical": 0.0,
            "cylindrical": 0.0,
            "base_curve": 5.00,
            "addition": 2.50,
            "eye": "OE",
            "barcode": "7899000000106",
            "location_tag": "GAV-BLOCO-MF-01"
        }
    ]

    print("\n2. Executando cadastros de teste com Marca, Modelo, Matriz e Tratamentos...")
    created_items = []
    for test in matrix_test_cases:
        # a) Cria o modelo com marca e modelo especificados
        model_payload = {
            "brand": test["brand"],
            "name": test["name"],
            "material": "Resina / HighIndex",
            "refractive_index": 1.56,
            "treatment": test["treatment"],
            "diameter": 70,
            "matrix_type": test["matrix_type"],
            "production_route": "EXPRESSA_FACETAMENTO",
            "cost_price": 30.00,
            "sale_price": 85.00,
            "degree_threshold": 2.00,
            "sale_price_over_threshold": 105.00
        }
        model_resp = requests.post(f"{BASE_URL}/lens-models/", json=model_payload, headers=headers)
        if model_resp.status_code not in (200, 201):
            print(f" ERROR: Erro ao criar modelo para {test['matrix_name']}: {model_resp.text}")
            continue
        created_model = model_resp.json()

        # b) Registra o item no estoque
        item_payload = {
            "barcode": test["barcode"],
            "lens_model_id": created_model["id"],
            "spherical": test["spherical"],
            "cylindrical": test["cylindrical"],
            "base_curve": test.get("base_curve"),
            "addition": test.get("addition"),
            "eye": test.get("eye", "OD"),
            "quantity_available": 10,
            "location_tag": test["location_tag"]
        }
        item_resp = requests.post(f"{BASE_URL}/inventory/register-fallback", json=item_payload, headers=headers)
        if item_resp.status_code not in (200, 201):
            print(f" ERROR: Erro ao salvar item de estoque para {test['matrix_name']}: {item_resp.text}")
            continue
        created_item = item_resp.json()
        created_items.append((test, created_model, created_item))
        print(f"   [OK] [{test['matrix_type']}] Marca: '{test['brand']}' | Modelo: '{test['name']}' | Tratamento: '{test['treatment']}' -> Cadastrado com sucesso!")

    # 3. Validacao de Salvamento na Grade Correta
    print("\n3. Validando se as lentes estao salvas e sendo retornadas na grade correta...")
    grid_resp = requests.get(f"{BASE_URL}/inventory/grid", headers=headers)
    if grid_resp.status_code != 200:
        print(f" ERROR: Erro ao buscar grade de inventario: {grid_resp.text}")
        return
    
    all_grid_items = grid_resp.json()
    print(f"   • Total de itens no inventario: {len(all_grid_items)}")

    success_count = 0
    for test, model, item in created_items:
        found_in_grid = [i for i in all_grid_items if String_or_None(i.get("barcode")) == test["barcode"]]
        if found_in_grid:
            matched_item = found_in_grid[0]
            lens_model_data = matched_item.get("lens_model") or {}
            saved_matrix = lens_model_data.get("matrix_type")
            saved_brand = lens_model_data.get("brand")
            saved_name = lens_model_data.get("name")
            saved_treatment = lens_model_data.get("treatment")

            if saved_matrix == test["matrix_type"] and saved_brand == test["brand"] and saved_name == test["name"]:
                print(f"   [MATCH OK] MATRIZ {test['matrix_type']}: COINCIDE 100%! Marca='{saved_brand}', Modelo='{saved_name}', Tratamento='{saved_treatment}'")
                success_count += 1
            else:
                print(f"   [ERROR] Divergencia na Matriz {test['matrix_type']}: Esperado={test['matrix_type']}, obtido={saved_matrix}")
        else:
            print(f"   [ERROR] Item com codigo {test['barcode']} nao encontrado na grade!")

    print("\n4. Validando tratamentos visiveis na Visao Simples LP...")
    lp_items = [i for i in all_grid_items if (i.get("lens_model") or {}).get("matrix_type") == "LP_GRADE"]
    lp_treatments = set((i.get("lens_model") or {}).get("treatment") for i in lp_items if (i.get("lens_model") or {}).get("treatment"))
    print(f"   • Tratamentos identificados na grade Visao Simples LP: {list(lp_treatments)}")

    print("\n" + "=" * 80)
    print(f" RESULTADO FINAL DA VALIDACAO: {success_count}/{len(created_items)} TESTES APROVADOS")
    print("=" * 80)

def String_or_None(val):
    return str(val) if val is not None else None

if __name__ == "__main__":
    test_full_system_validation()
