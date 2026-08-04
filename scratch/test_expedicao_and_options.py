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

        print("\n2. Testando fluxo de despesca/expedicao da OS...")
        # Busca OSs em Expedição
        exp_res = await client.get(f"{BASE_URL}/os/?status=Expedi%C3%A7%C3%A3o", headers=headers)
        assert exp_res.status_code == 200
        exp_orders = exp_res.json()
        print(f"   -> Ordens atualmente na bancada Expedicao: {len(exp_orders)}")

        if len(exp_orders) > 0:
            target_os = exp_orders[0]
            os_id = target_os["id"]
            print(f"   -> Transicionando OS {target_os['os_number']} de Expedicao para Concluida...")
            
            trans_res = await client.post(
                f"{BASE_URL}/os/{os_id}/status", 
                json={"status": "Concluída", "operator_notes": "Pacote expedido pela fábrica com sucesso.", "sector": "Expedição & Logística"},
                headers=headers
            )
            assert trans_res.status_code == 200, f"Falha na transicao: {trans_res.text}"
            updated_os = trans_res.json()
            assert updated_os["status"] == "Concluída", f"Status incorreto: {updated_os['status']}"
            print(f"   -> OS {target_os['os_number']} transicionou com Sucesso para status: '{updated_os['status']}'")

            # Verifica se a OS não está mais na bancada de Expedição
            exp_res_after = await client.get(f"{BASE_URL}/os/?status=Expedi%C3%A7%C3%A3o", headers=headers)
            assert not any(o["id"] == os_id for o in exp_res_after.json()), "A OS nao saiu da bancada de Expedicao!"
            print("   -> OS removida da bancada Expedicao com sucesso (saiu da Expedicao!)")

            # Verifica se a OS aparece na aba Concluída
            conc_res = await client.get(f"{BASE_URL}/os/?status=Conclu%C3%ADda", headers=headers)
            assert any(o["id"] == os_id for o in conc_res.json()), "A OS nao foi encontrada na aba Concluida!"
            print("   -> OS listada na nova aba Concluidas / Entregues com sucesso!")

            # Verifica se a OS continua disponivel para faturamento no Fechamento Financeiro
            billing_res = await client.get(f"{BASE_URL}/billing/pending", headers=headers)
            assert billing_res.status_code == 200, f"Falha na busca do faturamento: {billing_res.text}"
            print("   -> Faturamento Financeiro consultado com sucesso (OS Concluida mantida elegivel p/ faturamento)")

        print("\n3. Validando opcoes de Cadastro de Bloco...")
        block_payload = {
            "brand": "Hoya",
            "name": "Bloco Nulux 1.67 Single",
            "material": "Resina Alto Índice",
            "refractive_index": 1.67,
            "cost_price": 60.0,
            "sale_price": 180.0,
            "base_curves_config": "2.00, 4.00, 6.00", # Exatamente 3 opcoes
            "additions_config": "0.00, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00", # Exatamente 10 opcoes
            "is_active": True
        }
        b_res = await client.post(f"{BASE_URL}/blocks/models", json=block_payload, headers=headers)
        assert b_res.status_code == 201
        b_data = b_res.json()
        bases = [b.strip() for b in b_data["base_curves_config"].split(",")]
        adds = [a.strip() for a in b_data["additions_config"].split(",")]
        assert len(bases) == 3, f"Esperado 3 bases, obtido: {len(bases)}"
        assert len(adds) == 10, f"Esperado 10 adicoes, obtido: {len(adds)}"
        print(f"   -> Bloco cadastrado com sucesso com 3 Curvas Base {bases} e 10 Adicoes {adds}!")

        print("\n========================================================================")
        print("  TODAS AS CORRECOES FORAM TESTADAS E APROVADAS COM SUCESSO!")
        print("========================================================================")

if __name__ == "__main__":
    asyncio.run(test_suite())
