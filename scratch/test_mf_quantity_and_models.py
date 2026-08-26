import asyncio
import os
import sys
import uuid
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_test():
    print("=" * 80)
    print(" TESTE: REGISTRO DE MULTIFOCAL ACABADO COM 10 UNIDADES (OD + OE)")
    print("=" * 80)

    # Login
    auth_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@leootica.com.br", "password": "admin123"})
    if auth_resp.status_code != 200:
        print(f"[FAIL] Falha na autenticacao: {auth_resp.text}")
        return
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cria modelo MF_ACB
    unique_brand = f"MF ACB Incolor 1.50 {uuid.uuid4().hex[:4]}"
    model_payload = {
        "brand": unique_brand,
        "name": unique_brand,
        "material": "CR-39 (Incolor)",
        "refractive_index": 1.50,
        "treatment": "Incolor",
        "diameter": 70,
        "matrix_type": "MF_ACB",
        "production_route": "EXPRESSA_FACETAMENTO",
        "cost_price": 25.00,
        "sale_price": 75.00
    }
    m_resp = requests.post(f"{BASE_URL}/lens-models/", json=model_payload, headers=headers)
    if m_resp.status_code not in (200, 201):
        print(f"[FAIL] Erro ao criar modelo MF_ACB: {m_resp.text}")
        return
    model = m_resp.json()
    model_id = model["id"]
    print(f"[OK] Modelo criado: ID={model_id} | {model['brand']} | {model['material']} ({model['treatment']})")

    # 2. Registra 10 unidades para OD
    base_code = f"TEST-MF-{uuid.uuid4().hex[:6].upper()}"
    od_resp = requests.post(f"{BASE_URL}/inventory/register-fallback", json={
        "barcode": f"{base_code}-OD",
        "lens_model_id": model_id,
        "spherical": 0.0,
        "cylindrical": 0.0,
        "base_curve": 4.00,
        "addition": 2.00,
        "eye": "OD",
        "quantity": 10,
        "location_tag": "GAV-01"
    }, headers=headers)
    
    # Registra 10 unidades para OE
    oe_resp = requests.post(f"{BASE_URL}/inventory/register-fallback", json={
        "barcode": f"{base_code}-OE",
        "lens_model_id": model_id,
        "spherical": 0.0,
        "cylindrical": 0.0,
        "base_curve": 4.00,
        "addition": 2.00,
        "eye": "OE",
        "quantity": 10,
        "location_tag": "GAV-01"
    }, headers=headers)

    print(f"[OK] Registro OD status: {od_resp.status_code}")
    print(f"[OK] Registro OE status: {oe_resp.status_code}")

    # 3. Consulta a grade no backend e verifica os itens retornados
    grid_resp = requests.get(f"{BASE_URL}/inventory/grid?lens_model_id={model_id}", headers=headers)
    grid_items = grid_resp.json()
    print(f"-> Total de registros retornados na grade para o modelo MF: {len(grid_items)}")

    od_item = next((i for i in grid_items if i.get("eye") == "OD" and float(i.get("base_curve") or 0) == 4.0 and float(i.get("addition") or 0) == 2.0), None)
    oe_item = next((i for i in grid_items if i.get("eye") == "OE" and float(i.get("base_curve") or 0) == 4.0 and float(i.get("addition") or 0) == 2.0), None)

    if od_item and oe_item:
        print(f" [MATCH OK] OD encontrado: Qtd={od_item['quantity_available']} (Esperado: 10)")
        print(f" [MATCH OK] OE encontrado: Qtd={oe_item['quantity_available']} (Esperado: 10)")
        if od_item['quantity_available'] == 10 and oe_item['quantity_available'] == 10:
            print("\n================================================================================")
            print(" RESULTADO DA VALIDACAO: TESTE APROVADO COM SUCESSO! (10 un OD + 10 un OE)")
            print("================================================================================\n")
        else:
            print("[FAIL] Quantidades incorretas!")
    else:
        print(f"[FAIL] OD ou OE nao encontrados como itens distintos! OD={od_item}, OE={oe_item}")

if __name__ == "__main__":
    run_test()
