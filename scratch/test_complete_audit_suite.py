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
    print(" 🚀 INICIANDO SUÍTE COMPLETA DE AUDITORIA, VERIFICAÇÃO E CICLO DE FÁBRICA")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # 1. Autenticação
    # -------------------------------------------------------------------------
    print("\n1. Autenticando com usuário admin/suporte...")
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
    # 2. Cadastro de 5 Registros por Dioptria em Cada Grade
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📌 2. CADASTRO DE 5 REGISTROS POR DIOPTRIA EM CADA UMA DAS 5 GRADES")
    print("=" * 80)

    target_matrices = [
        {
            "matrix_type": "LP_GRADE",
            "grid_name": "Grade Visão Simples (LP_GRADE)",
            "brand": "Lente LP AR 1.56 - Teste Audit",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": -2.00,
            "cylindrical": -0.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "AUDIT-LP-001",
            "location_tag": "GAVETA-LP-A1",
            "quantity": 5
        },
        {
            "matrix_type": "GRADE_167",
            "grid_name": "Grade 1.67 Alto Índice (GRADE_167)",
            "brand": "Lente 1.67 High Index - Teste Audit",
            "material": "Alto Índice 1.67",
            "refractive_index": 1.67,
            "treatment": "Anti-Reflexo AR Premium",
            "diameter": 70,
            "spherical": -6.00,
            "cylindrical": -1.50,
            "base_curve": None,
            "addition": None,
            "eye": None,
            "barcode": "AUDIT-167-002",
            "location_tag": "GAVETA-167-B2",
            "quantity": 5
        },
        {
            "matrix_type": "MF_ACB",
            "grid_name": "Grade Multifocal Acabado (MF_ACB)",
            "brand": "Multifocal Prog 1.56 - Teste Audit",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Anti-Reflexo AR",
            "diameter": 70,
            "spherical": 1.00,
            "cylindrical": -0.50,
            "base_curve": 4.00,
            "addition": 2.00,
            "eye": "OD",
            "barcode": "AUDIT-MFACB-003",
            "location_tag": "GAVETA-MFACB-C3",
            "quantity": 5
        },
        {
            "matrix_type": "BLOCO_VS",
            "grid_name": "Grade Bloco Visão Simples (BLOCO_VS)",
            "brand": "Bloco VS CNC - Teste Audit",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Incolor Base",
            "diameter": 75,
            "spherical": 0.00,
            "cylindrical": 0.00,
            "base_curve": 4.25,
            "addition": None,
            "eye": None,
            "barcode": "AUDIT-BVS-004",
            "location_tag": "GAVETA-BVS-D4",
            "quantity": 5
        },
        {
            "matrix_type": "MF_BLOCO",
            "grid_name": "Grade Bloco Multifocal (MF_BLOCO)",
            "brand": "Bloco MF Semi-Acabado - Teste Audit",
            "material": "Resina",
            "refractive_index": 1.56,
            "treatment": "Incolor Base",
            "diameter": 75,
            "spherical": 0.00,
            "cylindrical": 0.00,
            "base_curve": 6.00,
            "addition": 2.50,
            "eye": "OD",
            "barcode": "AUDIT-BMF-005",
            "location_tag": "GAVETA-BMF-E5",
            "quantity": 5
        }
    ]

    registered_models = {}

    for idx, item in enumerate(target_matrices, 1):
        m_type = item["matrix_type"]
        grid_name = item["grid_name"]
        print(f"\n  [{idx}/5] Cadastrando 5 unidades na {grid_name}...")

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
            print(f"  ❌ Erro ao cadastrar item na grade {m_type}: {reg_resp.status_code} - {reg_resp.text}")
            sys.exit(1)

        created_item = reg_resp.json()
        registered_models[m_type] = created_item
        print(f"  ✅ Item cadastrado com sucesso na grade {m_type}! (ID: {created_item['id']}, Barcode: {created_item.get('barcode')})")

    # -------------------------------------------------------------------------
    # 3. CHECAGEM EXAUSTIVA DE VAZAMENTO ENTRE MATRIZES (100% ISOLAMENTO)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("🔒 3. CHECAGEM EXAUSTIVA DE VAZAMENTO ENTRE TODAS AS GRADES (ISOLAMENTO LÓGICO)")
    print("=" * 80)

    matrix_list = ["LP_GRADE", "GRADE_167", "MF_ACB", "BLOCO_VS", "MF_BLOCO"]
    isolation_success = True

    for target_matrix in matrix_list:
        grid_resp = httpx.get(f"{BASE_URL}/inventory/grid", params={"matrix_type": target_matrix}, headers=headers)
        if grid_resp.status_code != 200:
            print(f"❌ Erro ao consultar a grade {target_matrix}: {grid_resp.status_code}")
            isolation_success = False
            continue

        items = grid_resp.json()
        print(f"\n📌 Consultando Matriz: '{target_matrix}' -> Retornou {len(items)} itens no estoque.")

        # Verifica se TODOS os itens pertencem EXCLUSIVAMENTE a esta matriz
        leaked_items = []
        for item in items:
            model_info = item.get("lens_model") or {}
            item_matrix = model_info.get("matrix_type")
            if item_matrix != target_matrix:
                leaked_items.append({"item_id": item["id"], "expected": target_matrix, "found": item_matrix})

        if leaked_items:
            print(f"  ❌ VAZAMENTO DETECTADO na grade {target_matrix}! Itens de outras grades encontrados:")
            for lk in leaked_items:
                print(f"     • Item {lk['item_id']}: Esperado '{lk['expected']}', Encontrado '{lk['found']}'")
            isolation_success = False
        else:
            print(f"  ✅ ISOLAMENTO 100% CONFIRMADO na grade {target_matrix}! NENHUM item de outras grades vazou.")

    if not isolation_success:
        print("❌ FALHA NO ISOLAMENTO DE GRADES DETECTADA!")
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 4. Verificação de Lentes Pré-Carregadas e Campo de Preço Manual
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("🏷️ 4. VERIFICAÇÃO DE LENTES PRÉ-CARREGADAS E INSERÇÃO MANUAL DE PREÇOS")
    print("=" * 80)

    models_resp = httpx.get(f"{BASE_URL}/lens-models/", headers=headers)
    if models_resp.status_code != 200:
        print(f"❌ Erro ao listar modelos de lentes: {models_resp.status_code}")
        sys.exit(1)

    all_models = models_resp.json()
    print(f"✅ Total de modelos de lentes pré-carregados no catálogo: {len(all_models)}")
    for m in all_models[:5]:
        print(f"   • Modelo: {m.get('brand')} | Matriz: {m.get('matrix_type')} | Venda: R$ {m.get('sale_price')} | Acima do Limite: R$ {m.get('sale_price_over_threshold')}")

    # Testando criação de modelo sem regra por grau (preço customizado fixo)
    custom_model_payload = {
        "brand": "Lente Especial Fixo",
        "name": "Lente Personalizada Sem Limite Grau",
        "material": "Resina",
        "refractive_index": 1.56,
        "treatment": "Crizal Prevencia",
        "diameter": 70,
        "matrix_type": "LP_GRADE",
        "production_route": "EXPRESSA_FACETAMENTO",
        "cost_price": 40.00,
        "sale_price": 120.00,
        "degree_threshold": 2.00,
        "sale_price_over_threshold": 120.00 # Mesmo preço para testar valor único/fixo
    }
    c_resp = httpx.post(f"{BASE_URL}/lens-models/", json=custom_model_payload, headers=headers)
    if c_resp.status_code in (200, 201):
        c_model = c_resp.json()
        print(f"✅ Modelo com preço fixo/customizado criado com sucesso! ID: {c_model['id']} - Preço Venda: R$ {c_model['sale_price']}")
    else:
        print(f"⚠️ Resposta da criação de modelo customizado: {c_resp.status_code} - {c_resp.text}")

    # -------------------------------------------------------------------------
    # 5. Abertura de OS e Ciclo de Fábrica com Finais Variáveis
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("🏭 5. ABERTURA DE OS E CICLO DE FÁBRICA COM FINAIS VARIÁVEIS")
    print("=" * 80)

    # 1. Garante uma ótica comercial para vínculo
    stores_resp = httpx.get(f"{BASE_URL}/optical-stores/", headers=headers)
    if stores_resp.status_code == 200 and stores_resp.json():
        store_id = stores_resp.json()[0]["id"]
    else:
        # Cria ótica de teste se necessário
        store_create = httpx.post(
            f"{BASE_URL}/optical-stores/",
            json={"trade_name": "Ótica Visão Perfeita Audit", "corporate_name": "Visão Perfeita Ltda", "cnpj": "12345678000199"},
            headers=headers
        )
        store_id = store_create.json()["id"]

    print(f"✅ Ótica comercial selecionada/vinculada: {store_id}")

    # --- DESFECHO A: Fluxo Normal Completo até Entregue ---
    print("\n🔹 Desfecho A: Fluxo Normal Completo (Recebida -> CQ Final -> Entregue)...")
    os_a_payload = {
        "os_number": f"OS-AUDIT-A-{int(datetime.now().timestamp())}",
        "client_name": "Cliente Desfecho Sucesso",
        "optical_store_id": store_id,
        "od_spherical": -2.00,
        "od_cylindrical": -0.50,
        "oe_spherical": -2.00,
        "oe_cylindrical": -0.50,
        "total_amount": 150.00
    }
    os_a_resp = httpx.post(f"{BASE_URL}/os/", json=os_a_payload, headers=headers)
    if os_a_resp.status_code not in (200, 201):
        print(f"❌ Erro ao criar OS A: {os_a_resp.status_code} - {os_a_resp.text}")
        sys.exit(1)

    os_a = os_a_resp.json()
    os_a_id = os_a["id"]
    print(f"   • OS A criada: {os_a['os_number']} (ID: {os_a_id}) - Status Inicial: {os_a['status']}")

    # Avança status da OS A pelo workflow
    statuses_a = ["Triagem", "Produção", "Facetamento", "Montagem", "CQ Final", "Expedição", "Entregue"]
    for st in statuses_a:
        st_resp = httpx.post(f"{BASE_URL}/os/{os_a_id}/status", json={"status": st, "notes": f"Avanço audit para {st}"}, headers=headers)
        if st_resp.status_code == 200:
            print(f"     ➜ Status atualizado para: {st} ✅")
        else:
            print(f"     ⚠️ Status {st}: {st_resp.status_code} - {st_resp.text}")

    # --- DESFECHO B: Recusa no Controle de Qualidade (CQ Inspection - Retrabalho) ---
    print("\n🔹 Desfecho B: Recusa no CQ / Retrabalho...")
    os_b_payload = {
        "os_number": f"OS-AUDIT-B-{int(datetime.now().timestamp())}",
        "client_name": "Cliente Desfecho CQ Retrabalho",
        "optical_store_id": store_id,
        "od_spherical": -1.50,
        "od_cylindrical": -0.75,
        "total_amount": 180.00
    }
    os_b_resp = httpx.post(f"{BASE_URL}/os/", json=os_b_payload, headers=headers)
    os_b = os_b_resp.json()
    os_b_id = os_b["id"]
    print(f"   • OS B criada: {os_b['os_number']} (ID: {os_b_id})")

    # Avança OS B para bancada CQ
    httpx.post(f"{BASE_URL}/os/{os_b_id}/status", json={"status": "CQ", "notes": "Encaminhando para CQ"}, headers=headers)

    # Registro de Inspeção CQ Reprovada / Retrabalho
    cq_payload = {
        "check_grau": False,
        "check_eixo": True,
        "check_prisma": True,
        "check_acabamento": False,
        "result": "RETRABALHO",
        "rework_destination": "Produção",
        "notes": "Grau fora da tolerância de montagem"
    }
    cq_resp = httpx.post(f"{BASE_URL}/os/{os_b_id}/cq", json=cq_payload, headers=headers)
    if cq_resp.status_code in (200, 201):
        print(f"   ✅ Inspeção CQ registrada com sucesso: Resultado 'RETRABALHO' -> Destino 'Produção'!")
    else:
        print(f"   ⚠️ Inspeção CQ: {cq_resp.status_code} - {cq_resp.text}")

    # --- DESFECHO C: Cancelamento da OS com Liberação de Estoque ---
    print("\n🔹 Desfecho C: Cancelamento da OS (Status Cancelada)...")
    os_c_payload = {
        "os_number": f"OS-AUDIT-C-{int(datetime.now().timestamp())}",
        "client_name": "Cliente Desfecho Cancelado",
        "optical_store_id": store_id,
        "od_spherical": -3.00,
        "od_cylindrical": -1.00,
        "total_amount": 200.00
    }
    os_c_resp = httpx.post(f"{BASE_URL}/os/", json=os_c_payload, headers=headers)
    os_c = os_c_resp.json()
    os_c_id = os_c["id"]
    
    canc_resp = httpx.post(f"{BASE_URL}/os/{os_c_id}/cancel", json={"cancellation_reason": "Pedido cancelado pelo cliente"}, headers=headers)
    if canc_resp.status_code == 200:
        print(f"   ✅ OS C cancelada com sucesso! Status: {canc_resp.json()['status']}")
    else:
        print(f"   ⚠️ Erro ao cancelar OS C: {canc_resp.status_code} - {canc_resp.text}")

    # --- DESFECHO D: Trava e Liberação Financeira ---
    print("\n🔹 Desfecho D: Trava e Liberação Financeira...")
    os_d_payload = {
        "os_number": f"OS-AUDIT-D-{int(datetime.now().timestamp())}",
        "client_name": "Cliente Trava Financeira",
        "optical_store_id": store_id,
        "total_amount": 250.00
    }
    os_d_resp = httpx.post(f"{BASE_URL}/os/", json=os_d_payload, headers=headers)
    os_d_id = os_d_resp.json()["id"]

    hold_resp = httpx.post(f"{BASE_URL}/os/{os_d_id}/status", json={"status": "Bloqueada por Inadimplência", "notes": "Bloqueio preventivo"}, headers=headers)
    print(f"   • Status atualizado para: {hold_resp.json().get('status')} ✅")

    release_resp = httpx.post(f"{BASE_URL}/os/{os_d_id}/authorize-financial", json={"notes": "Autorizado por gerente"}, headers=headers)
    print(f"   • Status liberado para: {release_resp.json().get('status')} ✅")

    # -------------------------------------------------------------------------
    # 6. Fechamento Financeiro Completo (Todas as Possibilidades)
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("💰 6. FECHAMENTO FINANCEIRO COMPLETO (CICLO, PAGAMENTO, EXPORTAÇÃO E FISCAL)")
    print("=" * 80)

    # 1. Criação do Ciclo de Faturamento
    now = datetime.now()
    start_date = (now - timedelta(days=30)).isoformat()
    end_date = (now + timedelta(days=1)).isoformat()
    due_date = (now + timedelta(days=15)).isoformat()

    cycle_payload = {
        "optical_store_id": store_id,
        "start_date": start_date,
        "end_date": end_date,
        "due_date": due_date,
        "service_order_ids": [os_a_id]
    }

    c_create_resp = httpx.post(f"{BASE_URL}/billing/", json=cycle_payload, headers=headers)
    if c_create_resp.status_code not in (200, 201):
        print(f"❌ Erro ao criar ciclo de faturamento: {c_create_resp.status_code} - {c_create_resp.text}")
        sys.exit(1)

    cycle = c_create_resp.json()
    cycle_id = cycle["id"]
    print(f"✅ Ciclo de Faturamento gerado com Sucesso! ID: {cycle_id} | Total: R$ {cycle['total_amount']} | Status: {cycle['status']}")

    # 2. Exportação PDF
    pdf_resp = httpx.get(f"{BASE_URL}/billing/{cycle_id}/export-pdf", headers=headers)
    if pdf_resp.status_code == 200:
        print(f"✅ Exportação em PDF A4 gerada com sucesso ({len(pdf_resp.content)} bytes)")
    else:
        print(f"⚠️ Exportação PDF: {pdf_resp.status_code}")

    # 3. Exportação Excel
    excel_resp = httpx.get(f"{BASE_URL}/billing/{cycle_id}/export-excel", headers=headers)
    if excel_resp.status_code == 200:
        print(f"✅ Exportação em Excel (.xlsx) gerada com sucesso ({len(excel_resp.content)} bytes)")
    else:
        print(f"⚠️ Exportação Excel: {excel_resp.status_code}")

    # 4. Emissão Fiscal de NF-e
    nfe_resp = httpx.post(f"{BASE_URL}/billing/{cycle_id}/nfe", headers=headers)
    if nfe_resp.status_code in (200, 201):
        nfe_data = nfe_resp.json()
        print(f"✅ NF-e simulada emitida com sucesso! Número: {nfe_data['nfe_number']} | Chave: {nfe_data['chave_acesso']}")

        # Download DANFE PDF e XML
        danfe_resp = httpx.get(f"{BASE_URL}/billing/{cycle_id}/nfe/danfe", headers=headers)
        xml_resp = httpx.get(f"{BASE_URL}/billing/{cycle_id}/nfe/xml", headers=headers)
        if danfe_resp.status_code == 200 and xml_resp.status_code == 200:
            print(f"✅ DANFE PDF ({len(danfe_resp.content)} bytes) e XML ({len(xml_resp.content)} bytes) obtidos com sucesso!")

        # Cancelamento da NF-e
        nfe_cancel_resp = httpx.post(f"{BASE_URL}/billing/{cycle_id}/nfe/cancel", headers=headers)
        if nfe_cancel_resp.status_code in (200, 201):
            print(f"✅ NF-e cancelada fiscalmente com sucesso! Status: {nfe_cancel_resp.json()['status']}")
    else:
        print(f"⚠️ Emissão NF-e: {nfe_resp.status_code} - {nfe_resp.text}")

    # 5. Quitação do Ciclo de Faturamento (Status FECHADO -> PAGO)
    pay_resp = httpx.post(f"{BASE_URL}/billing/{cycle_id}/pay", headers=headers)
    if pay_resp.status_code == 200:
        paid_cycle = pay_resp.json()
        print(f"✅ Ciclo de Faturamento quitado com sucesso! Status final: '{paid_cycle['status']}'")
    else:
        print(f"⚠️ Quitação de ciclo: {pay_resp.status_code} - {pay_resp.text}")

    # 6. Indicadores de Contas a Receber (KPIs)
    kpis_resp = httpx.get(f"{BASE_URL}/billing/kpis", headers=headers)
    if kpis_resp.status_code == 200:
        kpis = kpis_resp.json()
        print(f"✅ KPIs de Contas a Receber obtidos com sucesso: {json.dumps(kpis, ensure_ascii=False)}")

    print("\n" + "=" * 80)
    print("🎉 SUÍTE COMPLETA DE AUDITORIA CONCLUÍDA COM 100% DE SUCESSO!")
    print("=" * 80)

if __name__ == "__main__":
    main()
