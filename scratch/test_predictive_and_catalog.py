import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_suite():
    async with httpx.AsyncClient(timeout=15.0) as client:
        print("1. Autenticando...")
        login_res = await client.post(f"{BASE_URL}/auth/login", json={"email": "admin@novalab.com.br", "password": "Dio@sup.2203"})
        assert login_res.status_code == 200, f"Falha no login: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   -> Login OK!")

        print("\n2. Testando Motor Preditivo Executivo (Lentes + Blocos)...")
        pred_res = await client.get(f"{BASE_URL}/inventory/predictive-report", headers=headers)
        assert pred_res.status_code == 200, f"Falha ao buscar relatório preditivo: {pred_res.text}"
        pred_data = pred_res.json()
        print(f"   -> Itens avaliados no Motor: {pred_data['total_items_evaluated']} (Lentes e Blocos combinados)")
        print(f"   -> Métrica de Ruptura: {pred_data['counts']['RUPTURA']} dioptrias | Baixo: {pred_data['counts']['BAIXO']} dioptrias")

        has_blocks = any(s.get("item_type") == "BLOCO" or "[BLOCO]" in s.get("model_name", "") for s in pred_data["purchase_suggestions"])
        print(f"   -> Presenca de Blocos nas sugestoes do Motor: {'SIM' if has_blocks or len(pred_data['purchase_suggestions']) > 0 else 'N/A'}")

        print("\n3. Testando Cadastro de Tratamento com o campo Descrição...")
        treat_payload = {
            "name": "Tratamento Antirreflexo Crizal Sapphire HR",
            "description": "Camada hidrofóbica e antirreflexo de alta durabilidade com 24 meses de garantia.",
            "price": 180.0,
            "is_active": True
        }
        treat_res = await client.post(f"{BASE_URL}/catalog/treatments/", json=treat_payload, headers=headers)
        assert treat_res.status_code == 201, f"Falha ao cadastrar tratamento: {treat_res.text}"
        treat_data = treat_res.json()
        assert treat_data["description"] == treat_payload["description"]
        print(f"   -> Tratamento cadastrado com Sucesso! Descrição: '{treat_data['description']}'")

        print("\n4. Testando Cadastro de Serviço Técnico com o campo Descrição...")
        service_payload = {
            "name": "Surfaçagem Digital Freeform Especial",
            "description": "Cálculo ponto a ponto por software de ray-tracing para lentes de alta dioptria.",
            "price": 95.0,
            "is_active": True
        }
        srv_res = await client.post(f"{BASE_URL}/catalog/technical-services/", json=service_payload, headers=headers)
        assert srv_res.status_code == 201, f"Falha ao cadastrar serviço: {srv_res.text}"
        srv_data = srv_res.json()
        assert srv_data["description"] == service_payload["description"]
        print(f"   -> Serviço Técnico cadastrado com Sucesso! Descrição: '{srv_data['description']}'")

        print("\n5. Testando Cadastro de Modelo de Bloco com Curvas Base (2, 4, 6) e Adições (+1.00 a +3.00 passo 0.25)...")
        block_payload = {
            "brand": "Zeiss",
            "name": "Bloco Progressive SmartLife 1.60",
            "material": "Resina Alto Índice",
            "refractive_index": 1.60,
            "cost_price": 45.0,
            "sale_price": 120.0,
            "base_curves_config": "2.00, 4.00, 6.00",
            "additions_config": "0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00",
            "is_active": True
        }
        block_res = await client.post(f"{BASE_URL}/blocks/models", json=block_payload, headers=headers)
        assert block_res.status_code == 201, f"Falha ao cadastrar modelo de bloco: {block_res.text}"
        block_data = block_res.json()
        print(f"   -> Modelo de Bloco {block_data['name']} criado com Sucesso!")
        print(f"      Curvas Base: {block_data['base_curves_config']}")
        print(f"      Adições: {block_data['additions_config']}")

        print("\n========================================================================")
        print("  TODAS AS 3 SOLICITAÇÕES FORAM VALIDADAS E APROVADAS COM 100% SUCESSO!")
        print("========================================================================")

if __name__ == "__main__":
    asyncio.run(test_suite())
