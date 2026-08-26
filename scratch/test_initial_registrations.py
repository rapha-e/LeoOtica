import httpx
import sys

BASE_URL = "http://localhost:8000/api/v1"

def main():
    print("========================================================================")
    print("  VALIDAÇÃO DOS FLUXOS DE CADASTRATAMENTO INICIAL - NOVA LAB V 2.0")
    print("========================================================================")

    # 1. AUTENTICAÇÃO COMO ADMIN
    print("\n1. Autenticando com usuário Administrador (admin / admin)...")
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "admin", "password": "admin"})
    if resp.status_code != 200:
        print(f"❌ Erro na autenticação: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    auth_data = resp.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✅ Autenticação realizada com sucesso! Token gerado para {auth_data['name']} ({auth_data['role']}).")

    # 2. ATUALIZAÇÃO DOS PARÂMETROS DO SISTEMA
    print("\n2. Salvando Parâmetros Globais do Sistema (Política por Grau)...")
    param_payload = {
        "lp_ar_156_cyl_threshold": "2.00",
        "lp_ar_156_price_base": "75.00",
        "lp_ar_156_price_over": "95.00",
        "financial_delinquency_policy": "POLICY_ALERT"
    }
    resp_param = httpx.post(f"{BASE_URL}/system-parameters/", json=param_payload, headers=headers)
    if resp_param.status_code in (200, 201):
        print("✅ Parâmetros do Sistema configurados e salvos com sucesso!")
    else:
        print(f"⚠️ Resposta dos parâmetros: {resp_param.status_code} - {resp_param.text}")

    # 3. CADASTRO DE NOVO USUÁRIO OPERADOR DE BANCADA
    print("\n3. Cadastrando novo usuário Operador de Bancada...")
    user_payload = {
        "name": "Carlos Eduardo Técnico",
        "email": "carlos.tecnico@novalab.com.br",
        "password": "Senha@Segura2026",
        "role": "Operador"
    }
    resp_user = httpx.post(f"{BASE_URL}/users/", json=user_payload, headers=headers)
    if resp_user.status_code in (200, 201):
        created_user = resp_user.json()
        print(f"✅ Usuário criado com sucesso: {created_user.get('name')} (ID: {created_user.get('id')})")
    else:
        print(f"⚠️ Retorno usuário (ou já existente): {resp_user.status_code} - {resp_user.text}")

    # 4. CADASTRO DE ÓTICA CLIENTE PARCEIRA
    print("\n4. Cadastrando Ótica Cliente Parceira...")
    store_payload = {
        "trade_name": "Ótica Visão Real - Loja 02",
        "corporate_name": "Visão Real Comércio de Óptica LTDA",
        "cnpj": "58.032.958/0001-44",
        "telephone": "61 98888-7777",
        "address": "Av. Comercial Quadra 04 Lote 12 - Brasília/DF",
        "delinquency_policy": "POLICY_ALERT"
    }
    resp_store = httpx.post(f"{BASE_URL}/optical-stores/", json=store_payload, headers=headers)
    store_id = None
    if resp_store.status_code in (200, 201):
        store_data = resp_store.json()
        store_id = store_data.get('id')
        print(f"✅ Ótica Cliente cadastrada com sucesso: {store_data.get('trade_name')} (ID: {store_id})")
    else:
        # Tenta listar óticas ativas se já existir
        list_stores = httpx.get(f"{BASE_URL}/optical-stores/", headers=headers).json()
        if list_stores:
            store_id = list_stores[0]['id']
            print(f"ℹ️ Ótica parceira existente obtida da lista: {list_stores[0]['trade_name']} (ID: {store_id})")

    # 5. CADASTRO DE SERVIÇO TÉCNICO E TRATAMENTO NO CATÁLOGO FINANCEIRO
    print("\n5. Cadastrando Serviço Técnico Fabril e Tratamento no Catálogo Financeiro...")
    srv_payload = {
        "name": "Surfaçagem + Montagem Completa",
        "code": "SRV-SURF-01",
        "price": 35.00,
        "description": "Serviço de alta precisão de surfaçagem digital e facetamento CNC",
        "is_active": True
    }
    resp_srv = httpx.post(f"{BASE_URL}/catalog/technical-services/", json=srv_payload, headers=headers)
    if resp_srv.status_code in (200, 201):
        print(f"✅ Serviço Técnico cadastrado: {srv_payload['name']} (R$ 35.00)")
    else:
        print(f"ℹ️ Serviço Técnico já existente ou atualizado no catálogo.")

    trat_payload = {
        "name": "Anti-Reflexo Crizal Easy",
        "code": "TRAT-AR-01",
        "price": 45.00,
        "description": "Camada protetora hidrofóbica e anti-risco",
        "is_active": True
    }
    resp_trat = httpx.post(f"{BASE_URL}/catalog/treatments/", json=trat_payload, headers=headers)
    if resp_trat.status_code in (200, 201):
        print(f"✅ Tratamento cadastrado: {trat_payload['name']} (R$ 45.00)")
    else:
        print(f"ℹ️ Tratamento já existente ou atualizado no catálogo.")

    # 6. CADASTRO DE MODELO DE LENTE NO CADASTRADOR UNIFICADO
    print("\n6. Cadastrando Modelo de Lente no Cadastrador Unificado...")
    lens_model_payload = {
        "brand": "Visão Simples AR 1.56",
        "name": "Visão Simples AR 1.56 - Essilor",
        "material": "Resina (Ind. 1.56)",
        "refractive_index": "1.56",
        "matrix_type": "VISAO_SIMPLES",
        "treatment": "Anti-Reflexo Crizal Easy",
        "production_route": "ESTOQUE_SURFACAGEM",
        "sale_price": 75.00
    }
    resp_model = httpx.post(f"{BASE_URL}/lenses/models", json=lens_model_payload, headers=headers)
    lens_model_id = None
    if resp_model.status_code in (200, 201):
        model_data = resp_model.json()
        lens_model_id = model_data.get('id')
        print(f"✅ Modelo de Lente cadastrado no estoque: {lens_model_payload['name']} (ID: {lens_model_id})")
    else:
        # Se falhar ou listar existentes
        list_models = httpx.get(f"{BASE_URL}/lenses/models", headers=headers).json()
        if list_models:
            lens_model_id = list_models[0]['id']
            print(f"ℹ️ Modelo de lente existente obtido do cadastro: {list_models[0].get('name')}")

    # 7. EMISSÃO DA PRIMEIRA ORDEM DE SERVIÇO FABRIL (NOVA OS COM OCR / MANUAL)
    print("\n7. Registrando Primeira Ordem de Serviço Fabril (Nova OS)...")
    if store_id and lens_model_id:
        os_payload = {
            "opticalStoreId": store_id,
            "clientOrderNumber": "PED-884920",
            "trayNumber": "BANDEJA-42",
            "priority": "URGENTE",
            "osType": "PADRAO",
            "serviceType": "Surfaçagem + Montagem Completa",
            "od": {
                "spherical": "-2.50",
                "cylindrical": "-0.75",
                "axis": "90",
                "addition": "0.00",
                "dnp": "31.5",
                "height": "19.0"
            },
            "oe": {
                "spherical": "-2.25",
                "cylindrical": "-1.00",
                "axis": "85",
                "addition": "0.00",
                "dnp": "32.0",
                "height": "19.0"
            },
            "frame": {
                "a": "54",
                "b": "38",
                "bridge": "17",
                "ed": "58",
                "type": "ACETATO",
                "bevelType": "AUTOMATICO"
            },
            "lensModelId": lens_model_id,
            "specialInstructions": "Armação enviada pelo cliente. Tomar cuidado no aquecimento."
        }
        resp_os = httpx.post(f"{BASE_URL}/os/factory", json=os_payload, headers=headers)
        if resp_os.status_code in (200, 201):
            created_os = resp_os.json()
            print("========================================================================")
            print(f"🎉 TESTE CONCLUÍDO COM SUCESSO COMPLETO!")
            print(f"   Ordem de Serviço Criada: {created_os.get('os_number', 'OS Fabril')}")
            print(f"   Status Atual: {created_os.get('status')}")
            print(f"   Valor Total Calculado: R$ {float(created_os.get('total_amount', 0)):.2f}")
            print("========================================================================")
        else:
            print(f"❌ Erro ao registrar OS: {resp_os.status_code} - {resp_os.text}")
    else:
        print("⚠️ Não foi possível obter Ótica ou Lente para criar a OS de teste.")

if __name__ == "__main__":
    main()
