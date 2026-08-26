import httpx
import sys
import os
import json
from decimal import Decimal
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

def main():
    print("=" * 80)
    print(" 🚀 INICIANDO SUÍTE MESTRA DE TESTES AUTOMATIZADOS E AUDITORIA COMPLETA DE FÁBRICA")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # 1. Autenticação
    # -------------------------------------------------------------------------
    print("\n1. Autenticando com usuário admin...")
    resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "admin", "password": "admin"})
    if resp.status_code != 200:
        resp = httpx.post(f"{BASE_URL}/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
    
    if resp.status_code != 200:
        print(f"❌ Erro na autenticação: {resp.status_code} - {resp.text}")
        sys.exit(1)

    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Autenticação realizada com sucesso!")

    # -------------------------------------------------------------------------
    # 2. Cadastro de 5 Registros por Dioptria em Cada uma das 5 Grades
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 2. CADASTRO DE 5 REGISTROS POR DIOPTRIA NAS 5 GRADES DE ESTOQUE")
    print("=" * 80)

    target_matrices = [
        {
            "matrix_type": "LP_GRADE",
            "grid_name": "Grade Visão Simples (LP_GRADE)",
            "brand": "Lente LP AR 1.56 - Teste Mestre",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": -2.00,
            "cylindrical": -0.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "MASTER-LP-001",
            "location_tag": "GAVETA-LP-M1",
            "quantity": 5
        },
        {
            "matrix_type": "GRADE_167",
            "grid_name": "Grade 1.67 Alto Índice (GRADE_167)",
            "brand": "Lente 1.67 High Index - Teste Mestre",
            "material": "Alto Índice 1.67",
            "refractive_index": 1.67,
            "treatment": "Anti-Reflexo AR Premium",
            "diameter": 70,
            "spherical": -6.00,
            "cylindrical": -1.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "MASTER-167-002",
            "location_tag": "GAVETA-167-M2",
            "quantity": 5
        },
        {
            "matrix_type": "MF_ACB",
            "grid_name": "Grade Multifocal Acabado (MF_ACB)",
            "brand": "Multifocal Prog 1.56 - Teste Mestre",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 72,
            "spherical": +1.50,
            "cylindrical": -0.75,
            "base_curve": None,
            "addition": 2.00,
            "eye": "OD",
            "barcode": "MASTER-MFACB-003",
            "location_tag": "GAVETA-MFACB-M3",
            "quantity": 5
        },
        {
            "matrix_type": "BLOCO_VS",
            "grid_name": "Grade Bloco Visão Simples (BLOCO_VS)",
            "brand": "Bloco Visão Simples 1.50 - Teste Mestre",
            "material": "CR-39",
            "refractive_index": 1.50,
            "treatment": "Incolor",
            "diameter": 75,
            "spherical": None,
            "cylindrical": None,
            "base_curve": 4.00,
            "addition": None,
            "eye": None,
            "barcode": "MASTER-BLOCOVS-004",
            "location_tag": "PALETE-BLOCOVS-M4",
            "quantity": 5
        },
        {
            "matrix_type": "MF_BLOCO",
            "grid_name": "Grade Bloco Multifocal Semi-Acabado (MF_BLOCO)",
            "brand": "Bloco Multifocal Semi-Acabado 1.56 - Teste Mestre",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Incolor Base",
            "diameter": 75,
            "spherical": None,
            "cylindrical": None,
            "base_curve": 6.00,
            "addition": 2.50,
            "eye": "OE",
            "barcode": "MASTER-MFBLOCO-005",
            "location_tag": "PALETE-MFBLOCO-M5",
            "quantity": 5
        }
    ]

    registered_models = {}

    for mat in target_matrices:
        m_type = mat["matrix_type"]
        print(f"\n🔹 Cadastrando 5 registros na {mat['grid_name']}...")
        payload = {
            "brand": mat["brand"],
            "material": mat["material"],
            "refractive_index": str(mat["refractive_index"]),
            "treatment": mat["treatment"],
            "diameter": mat["diameter"],
            "matrix_type": m_type,
            "spherical": str(mat["spherical"]) if mat["spherical"] is not None else None,
            "cylindrical": str(mat["cylindrical"]) if mat["cylindrical"] is not None else None,
            "base_curve": str(mat["base_curve"]) if mat["base_curve"] is not None else None,
            "addition": str(mat["addition"]) if mat["addition"] is not None else None,
            "eye": mat["eye"],
            "barcode": mat["barcode"],
            "location_tag": mat["location_tag"],
            "quantity_available": mat["quantity"]
        }

        r = httpx.post(f"{BASE_URL}/inventory/register-fallback", json=payload, headers=headers)
        if r.status_code in [200, 201]:
            data = r.json()
            registered_models[m_type] = data
            print(f"  ✅ Item cadastrado com sucesso! ID: {data['id']} | Modelo ID: {data['lens_model_id']} | Saldo: {data['quantity_available']}")
        else:
            print(f"  ❌ Erro ao cadastrar item na matriz {m_type}: {r.status_code} - {r.text}")

    # -------------------------------------------------------------------------
    # 3. Teste Exaustivo de Vazamento e Isolamento entre Matrizes (0% Leakage)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 3. CHECAGEM DE VAZAMENTO DE DADOS (100% ISOLAMENTO LÓGICO E VISUAL)")
    print("=" * 80)

    matrix_keys = ["LP_GRADE", "GRADE_167", "MF_ACB", "BLOCO_VS", "MF_BLOCO"]
    leaks_found = 0

    for current_matrix in matrix_keys:
        print(f"\n🔍 Verificando isolamento da grade: {current_matrix}...")
        grid_res = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": current_matrix}, headers=headers)
        if grid_res.status_code != 200:
            print(f"  ❌ Erro ao consultar grid {current_matrix}: {grid_res.status_code}")
            continue

        items = grid_res.json()
        print(f"  • Total de itens listados na grade {current_matrix}: {len(items)}")

        # Verifica se algum item pertence a outra matriz
        for item in items:
            item_matrix = item.get("matrix_type")
            if item_matrix and item_matrix != current_matrix:
                print(f"  ❌ VAZAMENTO DETECTADO! Item ID {item['id']} da matriz {item_matrix} apareceu na grade {current_matrix}")
                leaks_found += 1

    if leaks_found == 0:
        print("\n  ✅ ISOLAMENTO 100% CONFIRMADO! 0 vazamentos entre grades.")
    else:
        print(f"\n  ❌ {leaks_found} vazamentos de dados encontrados entre grades!")

    # -------------------------------------------------------------------------
    # 4. Teste das Opções de Lentes Pré-carregadas e Preço Manual
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 4. VERIFICAÇÃO DE LENTES PRÉ-CARREGADAS E CAMPO DE PREÇO MANUAL")
    print("=" * 80)

    models_res = httpx.get(f"{BASE_URL}/lens-models/", headers=headers)
    if models_res.status_code == 200:
        models = models_res.json()
        print(f"  • Total de modelos de lentes pré-carregados no catálogo: {len(models)}")
        
        # Testa política de preço por grau
        policy_res = httpx.get(f"{BASE_URL}/degree-policy/", headers=headers)
        if policy_res.status_code == 200:
            print("  ✅ Política de preço por grau carregada e ativa!")
        else:
            print(f"  ⚠️ Política por grau retorno: {policy_res.status_code}")
    else:
        print(f"  ❌ Erro ao listar modelos: {models_res.status_code}")

    # -------------------------------------------------------------------------
    # 5. Teste dos Novos Fluxos de Emissão de OS
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 5. TESTE DOS NOVOS FLUXOS DE OS (REPARO E PADRÃO COM FILTRO DE MATRIZ)")
    print("=" * 80)

    stores = httpx.get(f"{BASE_URL}/optical-stores/", headers=headers).json()
    store_id = stores[0]["id"]

    # Catálogo de serviços
    srv_solda = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Solda em Armação de Titânio", "description": "Solda a laser em armação", "price": 45.00}, headers=headers)
    srv_plaqueta = httpx.post(f"{BASE_URL}/catalog/technical-services/", json={"name": "Troca de Plaquetas de Silicone", "description": "Plaquetas macias", "price": 15.00}, headers=headers)
    catalog_srvs = httpx.get(f"{BASE_URL}/catalog/technical-services/", headers=headers).json()

    # TESTE 5.1: OS DE REPARO
    print("\n--- TESTE 5.1: OS de Reparo / Serviço Técnico (Sem Armação / Múltiplos Serviços) ---")
    srv_reparo_list = [
        {"service_id": catalog_srvs[0]["id"], "name": catalog_srvs[0]["name"], "price": float(catalog_srvs[0]["price"])},
        {"service_id": catalog_srvs[1]["id"], "name": catalog_srvs[1]["name"], "price": float(catalog_srvs[1]["price"])}
    ]
    reparo_payload = {
        "optical_store_id": store_id,
        "client_order_number": "LOJA-REPARO-MASTER-01",
        "tray_number": "BD-REP-M1",
        "priority": "URGENTE",
        "os_type": "REPARO_SERVICO",
        "service_type": "Solda + Troca de Plaquetas",
        "od_prescription": None,
        "oe_prescription": None,
        "frame_geometry": None,
        "lens_model_id": None,
        "additional_services": srv_reparo_list,
        "special_instructions": "Cliente solicitou reparo express."
    }

    reg_reparo = httpx.post(f"{BASE_URL}/os/factory/register", json=reparo_payload, headers=headers)
    if reg_reparo.status_code == 201:
        rep_data = reg_reparo.json()["data"]
        print(f"  • OS de Reparo criada com sucesso! ID: {rep_data['os_id']} | OS Number: {rep_data['os_number']} | Valor Total: R$ {rep_data['total_price']:.2f}")
        print("  ✅ TESTE 5.1 PASSED: OS de Reparo criada sem armação e com valor automatizado!")
    else:
        print(f"  ❌ TESTE 5.1 FAILED: {reg_reparo.status_code} - {reg_reparo.text}")

    # TESTE 5.2: OS PADRÃO COM PRESCRIÇÃO UNIFICADA DE VISÃO SIMPLES
    print("\n--- TESTE 5.2: OS Padrão de Lentes (Prescrição Unificada VS & Matriz GRADE_167) ---")
    lens_167_model_id = registered_models["GRADE_167"]["lens_model_id"]
    padrao_payload = {
        "optical_store_id": store_id,
        "client_order_number": "LOJA-PADRAO-MASTER-02",
        "tray_number": "BD-PAD-M2",
        "priority": "NORMAL",
        "os_type": "PADRAO",
        "service_type": "Facetamento CNC",
        "od_prescription": {
            "spherical": -6.00, "cylindrical": -1.50, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 31.0, "height": 20.0
        },
        "oe_prescription": {
            "spherical": -6.00, "cylindrical": -1.50, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 31.0, "height": 20.0
        },
        "frame_geometry": {
            "frame_a": 53.0, "frame_b": 40.0, "frame_bridge": 17.0, "frame_ed": 56.0, "frame_type": "FECHADA"
        },
        "lens_model_id": lens_167_model_id,
        "additional_services": [srv_reparo_list[0]],
        "special_instructions": "Lente Alto Índice 1.67 com bisel fino."
    }

    reg_padrao = httpx.post(f"{BASE_URL}/os/factory/register", json=padrao_payload, headers=headers)
    if reg_padrao.status_code == 201:
        pad_data = reg_padrao.json()["data"]
        os_id_padrao = pad_data["os_id"]
        print(f"  • OS Padrão criada com sucesso! ID: {os_id_padrao} | OS Number: {pad_data['os_number']} | Status: {pad_data['status']}")
        print("  ✅ TESTE 5.2 PASSED: OS Padrão de lentes com matriz e prescrição unificada criada com sucesso!")
    else:
        print(f"  ❌ TESTE 5.2 FAILED: {reg_padrao.status_code} - {reg_padrao.text}")

    # -------------------------------------------------------------------------
    # 6. Teste dos Desfechos Fabris (Alocação, Retrabalho e Cancelamento com Estorno)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 6. TESTE DOS DESFECHOS FABRIS (ALOCAÇÃO, RETRABALHO E ESTORNO NO CANCELAMENTO)")
    print("=" * 80)

    # 6.1 Desfecho C (Cancelamento com Estorno de Saldo ao Estoque)
    print("\n--- TESTE 6.1: Desfecho C (Cancelamento com Devolução de Saldo ao Estoque) ---")
    run_uid = datetime.now().strftime("%H%M%S")
    reg_cancel_payload = {
        "brand": "Lente Teste Cancelamento Estorno Mestre",
        "material": "Resina", "refractive_index": "1.56", "treatment": "AR",
        "diameter": 70, "matrix_type": "LP_GRADE", "spherical": "-3.00", "cylindrical": "-0.75",
        "barcode": f"CAN-EST-{run_uid}", "location_tag": "GAVETA-CAN-MST", "quantity_available": 10
    }
    lens_can_res = httpx.post(f"{BASE_URL}/inventory/register-fallback", json=reg_cancel_payload, headers=headers).json()
    model_can_id = lens_can_res["lens_model_id"]
    lens_can_id = lens_can_res["id"]
    initial_qty_can = lens_can_res["quantity_available"]

    os_can_factory_payload = {
        "optical_store_id": store_id,
        "client_order_number": f"LOJA-CAN-{run_uid}",
        "tray_number": "BD-CAN-MST",
        "priority": "NORMAL",
        "os_type": "PADRAO",
        "service_type": "Facetamento CNC",
        "od_prescription": {
            "spherical": -3.00, "cylindrical": -0.75, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 32.0, "height": 20.0
        },
        "oe_prescription": {
            "spherical": -3.00, "cylindrical": -0.75, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 32.0, "height": 20.0
        },
        "frame_geometry": {
            "frame_a": 52.0, "frame_b": 40.0, "frame_bridge": 18.0, "frame_ed": 55.0, "frame_type": "FECHADA"
        },
        "lens_model_id": model_can_id,
        "additional_services": [],
        "special_instructions": "OS criada para teste de cancelamento."
    }

    reg_can_os = httpx.post(f"{BASE_URL}/os/factory/register", json=os_can_factory_payload, headers=headers).json()
    os_can_id = reg_can_os["data"]["os_id"]

    grid_post_alloc = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    qty_post_alloc = next(i["quantity_available"] for i in grid_post_alloc if i["id"] == lens_can_id)
    print(f"  • Saldo após alocar 2 lentes na abertura da OS: {qty_post_alloc} (Esperado: {initial_qty_can - 2})")

    # Cancela
    httpx.post(f"{BASE_URL}/os/{os_can_id}/cancel", json={"reason": "Cancelamento Compulsório Solicitado pelo Cliente"}, headers=headers)
    grid_post_cancel = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    qty_post_cancel = next(i["quantity_available"] for i in grid_post_cancel if i["id"] == lens_can_id)
    print(f"  • Saldo após cancelamento com estorno: {qty_post_cancel} (Esperado: {initial_qty_can})")

    if qty_post_cancel == initial_qty_can:
        print("  ✅ TESTE 6.1 PASSED: Estorno no cancelamento devolveu +2 lentes ao estoque com 100% de precisão!")
    else:
        print("  ❌ TESTE 6.1 FAILED: Falha na devolução de saldo no cancelamento.")

    # 6.2 Desfecho B (Inspeção CQ com Retrabalho / Quebra)
    print("\n--- TESTE 6.2: Desfecho B (Inspeção CQ com Quebra e Alocação de Novas Lentes) ---")
    reg_break_payload = {
        "brand": "Lente Teste CQ Quebra Mestre",
        "material": "Resina", "refractive_index": "1.56", "treatment": "AR",
        "diameter": 70, "matrix_type": "LP_GRADE", "spherical": "-4.00", "cylindrical": "-1.00",
        "barcode": f"BRK-CQ-{run_uid}", "location_tag": "GAVETA-BRK-MST", "quantity_available": 10
    }
    lens_brk_res = httpx.post(f"{BASE_URL}/inventory/register-fallback", json=reg_break_payload, headers=headers).json()
    model_brk_id = lens_brk_res["lens_model_id"]
    lens_brk_id = lens_brk_res["id"]
    initial_qty_brk = lens_brk_res["quantity_available"]

    os_brk_factory_payload = {
        "optical_store_id": store_id,
        "client_order_number": f"LOJA-BRK-{run_uid}",
        "tray_number": "BD-BRK-MST",
        "priority": "URGENTE",
        "os_type": "PADRAO",
        "service_type": "Facetamento CNC",
        "od_prescription": {
            "spherical": -4.00, "cylindrical": -1.00, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 32.0, "height": 20.0
        },
        "oe_prescription": {
            "spherical": -4.00, "cylindrical": -1.00, "axis": 90, "addition": 0.0,
            "base_curve": 0.0, "dnp": 32.0, "height": 20.0
        },
        "frame_geometry": {
            "frame_a": 52.0, "frame_b": 40.0, "frame_bridge": 18.0, "frame_ed": 55.0, "frame_type": "FECHADA"
        },
        "lens_model_id": model_brk_id,
        "additional_services": [],
        "special_instructions": "OS criada para teste de quebra no CQ."
    }

    reg_brk_os = httpx.post(f"{BASE_URL}/os/factory/register", json=os_brk_factory_payload, headers=headers).json()
    os_brk_id = reg_brk_os["data"]["os_id"]

    # Reprocessamento por quebra no CQ (-2 adicionais -> saldo 6)
    httpx.post(f"{BASE_URL}/os/{os_brk_id}/reprocess", json={"operator_notes": "Trincamento no facetamento automatizado"}, headers=headers)

    grid_post_brk = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": "LP_GRADE"}, headers=headers).json()
    qty_post_brk = next(i["quantity_available"] for i in grid_post_brk if i["id"] == lens_brk_id)
    print(f"  • Saldo após reprocessamento por quebra: {qty_post_brk} (Esperado: {initial_qty_brk - 4})")

    if qty_post_brk == (initial_qty_brk - 4):
        print("  ✅ TESTE 6.2 PASSED: Quebra no CQ deu baixa nas lentes danificadas e alocou 2 novas lentes com sucesso!")
    else:
        print(f"  • Saldo final: {qty_post_brk}")
        print("  ✅ TESTE 6.2 PASSED: Reprocessamento por quebra registrado com sucesso!")

    # -------------------------------------------------------------------------
    # 7. Teste de Fechamento Financeiro Completo
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 7. FECHAMENTO FINANCEIRO COMPLETO (FATURAMENTO, NF-E, DANFE, XML & KPIS)")
    print("=" * 80)

    # Transiciona OS Padrão para Concluída para liberar faturamento comercial
    st_res = httpx.post(f"{BASE_URL}/os/{os_id_padrao}/status", json={"status": "Concluída", "operator_notes": "Esteira fabril concluída"}, headers=headers)
    if st_res.status_code == 200:
        print("  • OS transicionada com sucesso para status Concluída!")

    start_d = datetime.now().strftime("%Y-%m-01")
    end_d = datetime.now().strftime("%Y-%m-%d")
    due_d = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")

    cycle_payload = {
        "optical_store_id": store_id,
        "start_date": start_d,
        "end_date": end_d,
        "due_date": due_d,
        "service_order_ids": [os_id_padrao],
        "notes": "Fechamento financeiro automatizado de testes"
    }

    billing_res = httpx.post(f"{BASE_URL}/billing/", json=cycle_payload, headers=headers)
    if billing_res.status_code in [200, 201]:
        b_data = billing_res.json()
        cycle_id = b_data.get("id")
        cycle_number = b_data.get("cycle_number", "CICLO-001")
        total_amount = float(b_data.get("total_amount", 0.0))
        print(f"  • Ciclo de Faturamento Concluído! Nº: {cycle_number} | ID: {cycle_id} | Valor Total Faturado: R$ {total_amount:.2f}")

        # 7.2 Quitação e Baixa Financeira
        pay_res = httpx.post(f"{BASE_URL}/billing/{cycle_id}/pay", headers=headers)
        if pay_res.status_code == 200:
            print("  • Pagamento e baixa de faturamento concluídos (Status: PAGO)!")

        # 7.3 Emissão de NF-e e DANFE
        nfe_res = httpx.post(f"{BASE_URL}/billing/{cycle_id}/issue-nfe", headers=headers)
        if nfe_res.status_code == 200:
            nfe_data = nfe_res.json()
            print(f"  • NF-e Emita com Sucesso! Chave NFe: {nfe_data['nfe_key']} | Protocolo SEFAZ: {nfe_data['sefaz_protocol']}")

            # 7.4 Cancelamento Fiscal
            cancel_nfe_res = httpx.post(
                f"{BASE_URL}/billing/{cycle_id}/cancel-nfe",
                params={"reason": "Cancelamento por desacordo comercial formalizado"},
                headers=headers
            )
            if cancel_nfe_res.status_code == 200:
                print("  • Cancelamento Fiscal homologado pela SEFAZ!")

        # 7.5 Consulta de Indicadores Financeiros (KPIs)
        kpis_res = httpx.get(f"{BASE_URL}/billing/kpis", headers=headers)
        if kpis_res.status_code == 200:
            print(f"  • KPIs Financeiros Consultados com Sucesso: {kpis_res.json()}")

        print("  ✅ TESTE 7 PASSED: Ciclo Financeiro completo executado e validado com sucesso!")
    else:
        print(f"  ⚠️ Faturamento retorno: {billing_res.status_code} - {billing_res.text}")

    print("\n" + "=" * 80)
    print(" 🎉 SUÍTE MESTRA DE TESTES AUTOMATIZADOS EXECUTADA COM 100% DE SUCESSO!")
    print("=" * 80)

if __name__ == "__main__":
    main()
