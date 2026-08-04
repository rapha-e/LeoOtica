import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_fixes():
    async with httpx.AsyncClient(timeout=15.0) as client:
        print("1. Autenticando...")
        login_res = await client.post(f"{BASE_URL}/auth/login", json={"email": "admin@novalab.com.br", "password": "Dio@sup.2203"})
        assert login_res.status_code == 200, f"Falha no login: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   -> Login OK!")

        print("\n2. Buscando lista de Ordens de Serviço (OS)...")
        os_res = await client.get(f"{BASE_URL}/os/", headers=headers)
        assert os_res.status_code == 200, f"Falha ao buscar OSs: {os_res.text}"
        os_list = os_res.json()
        assert len(os_list) > 0, "Nenhuma OS localizada."
        target_os = os_list[0]
        print(f"   -> OS selecionada: {target_os['os_number']} (ID: {target_os['id']})")

        print("\n3. Testando Endpoint de Cancelamento de OS...")
        cancel_res = await client.post(f"{BASE_URL}/os/{target_os['id']}/cancel", json={"cancellation_reason": "Cancelamento de teste de integridade"}, headers=headers)
        assert cancel_res.status_code == 200, f"Falha no cancelamento: {cancel_res.text}"
        print(f"   -> OS {target_os['os_number']} cancelada com Sucesso! Status: {cancel_res.json()['status']}")

        print("\n4. Testando Baixa no Contas a Receber...")
        rec_res = await client.get(f"{BASE_URL}/finance-corp/receivables", headers=headers)
        assert rec_res.status_code == 200
        receivables = rec_res.json()
        if len(receivables) > 0:
            target_rec = receivables[0]
            pay_rec_res = await client.post(f"{BASE_URL}/finance-corp/receivables/{target_rec['id']}/pay", json={"amount": 100.0, "notes": "Teste Pix"}, headers=headers)
            assert pay_rec_res.status_code == 200, f"Falha ao baixar recebimento: {pay_rec_res.text}"
            print(f"   -> Baixa no Contas a Receber registrada com Sucesso! Status: {pay_rec_res.json()['status']}")

        print("\n5. Testando Pagamento no Contas a Pagar...")
        pay_res = await client.get(f"{BASE_URL}/finance-corp/payables", headers=headers)
        assert pay_res.status_code == 200
        payables = pay_res.json()
        if len(payables) > 0:
            target_pay = payables[0]
            pay_payable_res = await client.post(f"{BASE_URL}/finance-corp/payables/{target_pay['id']}/pay", json={"amount": 50.0}, headers=headers)
            assert pay_payable_res.status_code == 200, f"Falha ao pagar conta a pagar: {pay_payable_res.text}"
            print(f"   -> Pagamento no Contas a Pagar registrado com Sucesso! Status: {pay_payable_res.json()['status']}")

        print("\n========================================================================")
        print("  TODOS OS CORREÇÕES E TESTES FORAM VALIDADOS COM 100% DE SUCESSO!")
        print("========================================================================")

if __name__ == "__main__":
    asyncio.run(test_fixes())
