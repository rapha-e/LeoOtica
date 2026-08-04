import asyncio
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

async def test_dual_orders_and_finance():
    async with httpx.AsyncClient(timeout=15.0) as client:
        print("1. Autenticando como Administrador (admin@novalab.com.br)...")
        login_res = await client.post(f"{BASE_URL}/auth/login", json={"email": "admin@novalab.com.br", "password": "Dio@sup.2203"})
        assert login_res.status_code == 200, f"Falha no login: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   -> Login OK!")

        print("\n2. Buscando lista de Óticas Parceiras para o Pedido de Venda...")
        stores_res = await client.get(f"{BASE_URL}/optical-stores/", headers=headers)
        assert stores_res.status_code == 200, f"Falha ao buscar óticas: {stores_res.text}"
        stores = stores_res.json()
        assert len(stores) > 0, "Nenhuma ótica encontrada"
        store_id = stores[0]["id"]
        print(f"   -> Ótica selecionada: {stores[0]['trade_name']} (ID: {store_id})")

        print("\n3. Criando Pedido Comercial de Venda (Ótica -> Fábrica)...")
        order_payload = {
            "optical_store_id": store_id,
            "client_name": "Marcos Antônio Teste",
            "doctor_name": "Dr. Fernando Ruiz",
            "frame_type": "ACETATO",
            "payment_terms": "30_DIAS",
            "od_spherical": -3.50,
            "od_cylindrical": -1.25,
            "od_axis": 180,
            "od_addition": 2.00,
            "oe_spherical": -3.25,
            "oe_cylindrical": -1.50,
            "oe_axis": 175,
            "oe_addition": 2.00,
            "items": [
                {"item_type": "LENTE_ACABADA", "item_name": "Lente Policarbonato 1.59 Anti-Reflexo", "quantity": 2, "unit_price": 120.00, "total_price": 240.00},
                {"item_type": "TRATAMENTO", "item_name": "Filtro de Luz Azul BlueControl", "quantity": 2, "unit_price": 45.00, "total_price": 90.00}
            ]
        }

        create_res = await client.post(f"{BASE_URL}/orders/", json=order_payload, headers=headers)
        assert create_res.status_code == 201, f"Falha ao criar pedido: {create_res.text}"
        order_data = create_res.json()
        order_id = order_data["id"]
        print(f"   -> Pedido {order_data['order_number']} criado com sucesso! Status: {order_data['status']} | Total: R$ {order_data['total_amount']:.2f}")

        print("\n4. Faturando o Pedido de Venda e Gerando Contas a Receber (AR)...")
        if order_data["status"] == "BLOQUEADO_FINANCEIRO":
            print("   -> Pedido retido por crédito. Realizando aprovação financeira manual pelo Admin...")
            app_res = await client.post(f"{BASE_URL}/orders/{order_id}/approve-financial", headers=headers)
            assert app_res.status_code == 200, f"Falha na aprovação financeira: {app_res.text}"
            print("   -> Crédito Aprovado! Status atualizado para EM_PRODUCAO")

        bill_res = await client.post(f"{BASE_URL}/orders/{order_id}/bill", headers=headers)
        assert bill_res.status_code == 200, f"Falha ao faturar pedido: {bill_res.text}"
        print(f"   -> Pedido Faturado com Sucesso! Status: {bill_res.json()['status']}")

        print("\n5. Verificando o Título Gerado no Contas a Receber (AR)...")
        rec_res = await client.get(f"{BASE_URL}/finance-corp/receivables", headers=headers)
        assert rec_res.status_code == 200, f"Falha ao buscar Contas a Receber: {rec_res.text}"
        receivables = rec_res.json()
        assert len(receivables) > 0, "Nenhum título a receber localizado"
        print(f"   -> Encontrados {len(receivables)} títulos no Contas a Receber!")

        print("\n6. Testando Pedidos de Compra no Fornecedor (Fábrica -> Fornecedor)...")
        supplier_order_payload = {
            "supplier_name": "Essilor Brasil Ltda",
            "notes": "Compra quinzenal de insumos para estoque matriz",
            "items": [
                {
                    "lens_model_id": None,
                    "model_name": "Bloco Semiacabado CR-39 1.56 Base 4.00",
                    "dioptria": "Base 4.00 / Add 2.00",
                    "quantity": 10,
                    "unit_cost_price": 35.00,
                    "total_cost_price": 350.00,
                    "unit_resale_price": 95.00,
                    "total_resale_price": 950.00
                }
            ]
        }

        sup_res = await client.post(f"{BASE_URL}/supplier-orders/", json=supplier_order_payload, headers=headers)
        assert sup_res.status_code == 201, f"Falha ao criar pedido no fornecedor: {sup_res.text}"
        sup_data = sup_res.json()
        print(f"   -> Pedido no Fornecedor {sup_data['order_number']} criado com Sucesso! Total Custo: R$ {float(sup_data['total_cost']):.2f}")

        print("\n7. Verificando o Título no Contas a Pagar (AP)...")
        pay_res = await client.get(f"{BASE_URL}/finance-corp/payables", headers=headers)
        assert pay_res.status_code == 200, f"Falha ao buscar Contas a Pagar: {pay_res.text}"
        payables = pay_res.json()
        assert len(payables) > 0, "Nenhum título a pagar localizado"
        print(f"   -> Encontrados {len(payables)} títulos no Contas a Pagar!")

        print("\n8. Testando DRE e Fluxo de Caixa Corporativo...")
        dre_res = await client.get(f"{BASE_URL}/finance-corp/cash-flow", headers=headers)
        assert dre_res.status_code == 200, f"Falha ao buscar Fluxo de Caixa: {dre_res.text}"
        print("   -> Fluxo de Caixa e DRE calculados em tempo real com Sucesso!")

        print("\n========================================================================")
        print("  SUITE DE TESTES INTEGRAÇÃO DUAL DE PEDIDOS & FINANCEIRO CONCLUÍDA 100%!")
        print("========================================================================")

if __name__ == "__main__":
    asyncio.run(test_dual_orders_and_finance())
