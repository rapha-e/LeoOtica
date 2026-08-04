import asyncio
import json
import os
import sys
import time
import urllib.request
import urllib.error
import concurrent.futures

BASE_URL = "http://localhost:8000/api/v1"

test_results = {
    "technical_api": [],
    "business_rbac": [],
    "edge_cases": [],
    "performance": {},
    "ai_copilot": [],
    "e2e_workflow": []
}

def log_test(category, test_name, passed, details="", duration_ms=0):
    status_str = "[PASSED]" if passed else "[FAILED]"
    print(f"  {status_str} {test_name} ({duration_ms:.1f}ms) - {details}")
    test_results[category].append({
        "name": test_name,
        "passed": passed,
        "details": details,
        "duration_ms": duration_ms
    })

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    if data and isinstance(data, dict):
        data_bytes = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif data and isinstance(data, bytes):
        data_bytes = data
    else:
        data_bytes = None

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    start_time = time.time()
    try:
        with urllib.request.urlopen(req) as resp:
            elapsed = (time.time() - start_time) * 1000
            content = resp.read().decode("utf-8")
            try:
                json_body = json.loads(content)
            except Exception:
                json_body = content
            return resp.status, json_body, elapsed
    except urllib.error.HTTPError as e:
        elapsed = (time.time() - start_time) * 1000
        err_content = e.read().decode("utf-8")
        try:
            json_body = json.loads(err_content)
        except Exception:
            json_body = err_content
        return e.code, json_body, elapsed
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        return 500, str(e), elapsed

def run_all_tests():
    print(f"\n========================================================================")
    print(f"   INICIANDO SUITE MESTRA DE TESTES E HOMOLOGACAO - NOVA LAB V 2.0")
    print(f"========================================================================\n")

    # =========================================================================
    # 1. TESTES DE AUTENTICACAO E RBAC
    # =========================================================================
    print(f"--> 1. TESTES DE AUTENTICACAO E CONTROLE DE ACESSO (RBAC)")
    
    # 1.1 Login Administrador (Suporte)
    status, body, elapsed = make_request(f"{BASE_URL}/auth/login", method="POST", data={"email": "suporte", "password": "Dio@sup.2203"})
    admin_token = body.get("access_token") if status == 200 else None
    log_test("business_rbac", "Login Administrador Suporte", status == 200 and admin_token is not None, f"Status {status}", elapsed)

    # 1.2 Login Operador de Fabrica
    status, body, elapsed = make_request(f"{BASE_URL}/auth/login", method="POST", data={"email": "operador@novalab.com.br", "password": "operador123"})
    op_token = body.get("access_token") if status == 200 else None
    log_test("business_rbac", "Login Operador de Fabrica", status == 200 and op_token is not None, f"Status {status}", elapsed)

    # 1.3 RBAC: Operador tentando acessar rota Admin de Gerenciamento de Usuarios
    headers_op = {"Authorization": f"Bearer {op_token}"}
    status, body, elapsed = make_request(f"{BASE_URL}/admin/users/", method="GET", headers=headers_op)
    log_test("business_rbac", "RBAC Bloqueio Operador em Rota Admin (/admin/users/)", status == 403, f"Status {status} (Esperado 403)", elapsed)

    # 1.4 RBAC: Administrador acessando a rota Admin de Gerenciamento de Usuarios
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    status, body, elapsed = make_request(f"{BASE_URL}/admin/users/", method="GET", headers=headers_admin)
    log_test("business_rbac", "RBAC Permissao Admin em Rota Admin (/admin/users/)", status == 200 and isinstance(body, list), f"Status {status} - Total {len(body) if isinstance(body, list) else 0} usuarios", elapsed)


    # =========================================================================
    # 2. TESTES DE API & ENDPOINTS TECNICOS
    # =========================================================================
    print(f"\n--> 2. TESTES DE INTEGRACAO E API (ENDPOINTS TECNICOS)")

    # 2.1 Grade de Lentes Acabadas
    status, body, elapsed = make_request(f"{BASE_URL}/inventory/grid", method="GET", headers=headers_admin)
    log_test("technical_api", "GET /inventory/grid (Grade de Lentes)", status == 200 and isinstance(body, list), f"Total {len(body) if isinstance(body, list) else 0} itens", elapsed)

    # 2.2 Modelos de Blocos Semiacabados (Novo)
    status, body, elapsed = make_request(f"{BASE_URL}/blocks/models", method="GET", headers=headers_admin)
    block_model_id = body[0]["id"] if status == 200 and isinstance(body, list) and len(body) > 0 else None
    log_test("technical_api", "GET /blocks/models (Modelos de Blocos)", status == 200 and block_model_id is not None, f"Total {len(body) if isinstance(body, list) else 0} modelos", elapsed)

    # 2.3 Matriz de 30 Celulas de Bloco
    if block_model_id:
        status, body, elapsed = make_request(f"{BASE_URL}/blocks/grid/{block_model_id}", method="GET", headers=headers_admin)
        log_test("technical_api", "GET /blocks/grid/{id} (Matriz 30 celulas)", status == 200 and body.get("total_items") == 30, f"Total celulas: {body.get('total_items')}", elapsed)

    # 2.4 Fechamento Financeiro - Grupos Pendentes
    status, body, elapsed = make_request(f"{BASE_URL}/billing/pending-groups", method="GET", headers=headers_admin)
    log_test("technical_api", "GET /billing/pending-groups (Elegiveis faturamento)", status == 200, f"Total grupos elegiveis: {len(body) if isinstance(body, list) else 0}", elapsed)

    # 2.5 Financeiro Corporativo - KPIs Executivos
    status, body, elapsed = make_request(f"{BASE_URL}/finance-corp/kpis-executive", method="GET", headers=headers_admin)
    log_test("technical_api", "GET /finance-corp/kpis-executive (DRE & KPIs)", status == 200, f"Faturamento Bruto: R$ {body.get('gross_revenue', 0):.2f}" if isinstance(body, dict) else f"Status {status}", elapsed)

    # 2.6 Financeiro Corporativo - Central de Alertas
    status, body, elapsed = make_request(f"{BASE_URL}/finance-corp/overdue-alerts", method="GET", headers=headers_admin)
    log_test("technical_api", "GET /finance-corp/overdue-alerts (Alertas Vencidos)", status == 200, f"Alertas encontrados: {body.get('overdue_count', 0)}" if isinstance(body, dict) else f"Status {status}", elapsed)


    # =========================================================================
    # 3. TESTES DE BORDA E CASOS NEGATIVOS (EDGE CASES)
    # =========================================================================
    print(f"\n--> 3. TESTES DE BORDA E VALIDACAO NEGATIVA (EDGE CASES)")

    # 3.1 Login com Senha Incorreta
    status, body, elapsed = make_request(f"{BASE_URL}/auth/login", method="POST", data={"email": "suporte", "password": "senha_errada_123"})
    log_test("edge_cases", "Login com Senha Incorreta", status == 400, f"Status {status} (Esperado 400 Bad Request)", elapsed)

    # 3.2 Bipagem de OS Inexistente na Esteira MES
    status, body, elapsed = make_request(f"{BASE_URL}/factory/os/bip-bancada", method="POST", data={"os_number": "OS-INEXISTENTE-9999"}, headers=headers_admin)
    log_test("edge_cases", "Bipagem de OS Inexistente", status == 404, f"Status {status} (Esperado 404 Not Found)", elapsed)

    # 3.3 Token Invalido/Corrompido
    status, body, elapsed = make_request(f"{BASE_URL}/inventory/grid", method="GET", headers={"Authorization": "Bearer token_corrompido_123"})
    log_test("edge_cases", "Requisicao com Token Invalido", status == 401, f"Status {status} (Esperado 401 Unauthorized)", elapsed)

    # 3.4 Incremento de Bloco com Codigo de Barras Inexistente
    status, body, elapsed = make_request(f"{BASE_URL}/blocks/bip-increment", method="POST", data={"barcode": "BARCODE_INEXISTENTE_99"}, headers=headers_admin)
    log_test("edge_cases", "Bipagem de Bloco com Codigo Inexistente", status == 404, f"Status {status} (Esperado 404 Not Found)", elapsed)


    # =========================================================================
    # 4. TESTES DE REGRESSAO E FLUXO E2E (ESTEIRA MES & FATURAMENTO)
    # =========================================================================
    print(f"\n--> 4. TESTES DE REGRESSAO END-TO-END (E2E WORKFLOW)")

    # 4.1 Entrada de nova OS
    os_payload = {
        "client_name": "Paciente Teste E2E",
        "doctor_name": "Dr. Roberto Teste",
        "optical_store_id": None
    }
    status, os_res, elapsed = make_request(f"{BASE_URL}/os/", method="POST", data=os_payload, headers=headers_admin)
    os_number = os_res.get("os_number") if status in [200, 201] and isinstance(os_res, dict) else None
    log_test("e2e_workflow", "E2E 1/3: Entrada de Nova OS", status in [200, 201] and os_number is not None, f"OS Gerada: {os_number}", elapsed)

    # 4.2 Bipagem na Esteira MES (Avanco de Etapa)
    if os_number:
        status, bip_res, elapsed = make_request(f"{BASE_URL}/factory/os/bip-bancada", method="POST", data={"os_number": os_number, "target_status": "SEPARACAO"}, headers=headers_admin)
        new_status = bip_res.get("status") if status == 200 and isinstance(bip_res, dict) else str(bip_res)
        log_test("e2e_workflow", "E2E 2/3: Avanco de Etapa na Esteira MES via Bipagem", status == 200, f"Status Resultante: {new_status}", elapsed)

    # 4.3 Consulta do Bom Dia Executivo
    status, briefing_res, elapsed = make_request(f"{BASE_URL}/analytics/morning-briefing", method="GET", headers=headers_admin)
    log_test("e2e_workflow", "E2E 3/3: Painel 'Bom Dia Executivo'", status == 200 and isinstance(briefing_res, dict) and "summary_markdown" in briefing_res, f"OSs Atrasadas: {briefing_res.get('overdue_os_count', 0) if isinstance(briefing_res, dict) else 0}", elapsed)


    # =========================================================================
    # 5. TESTES DO ASSISTENTE IA (COPILOT & FALLBACK OFFLINE)
    # =========================================================================
    print(f"\n--> 5. TESTES DE RESILIENCIA E FALLBACK DA IA (COPILOT)")

    # 5.1 Pergunta sobre Faturamento de Oticas
    status, body, elapsed = make_request(f"{BASE_URL}/analytics/assistant", method="POST", data={"message": "Quais oticas mais faturaram este mes?"}, headers=headers_admin)
    resp_text = body.get("response", "") if isinstance(body, dict) else ""
    log_test("ai_copilot", "IA: Intencao Comercial / Faturamento", status == 200 and len(resp_text) > 0, f"Tamanho resposta: {len(resp_text)} chars", elapsed)

    # 5.2 Pergunta sobre Lentes e Estoque
    status, body, elapsed = make_request(f"{BASE_URL}/analytics/assistant", method="POST", data={"message": "Quais lentes tiveram maior consumo?"}, headers=headers_admin)
    resp_text = body.get("response", "") if isinstance(body, dict) else ""
    log_test("ai_copilot", "IA: Intencao Consumo de Lentes", status == 200 and len(resp_text) > 0, f"Tamanho resposta: {len(resp_text)} chars", elapsed)

    # 5.3 Pergunta Geral / Mensagem de Saudacao
    status, body, elapsed = make_request(f"{BASE_URL}/analytics/assistant", method="POST", data={"message": "Como funciona o sistema?"}, headers=headers_admin)
    resp_text = body.get("response", "") if isinstance(body, dict) else ""
    log_test("ai_copilot", "IA: Resposta Generica / Fallback Seguro", status == 200 and "Assistente Operacional" in resp_text, "Mensagem amigavel de fallback", elapsed)


    # =========================================================================
    # 6. TESTES DE CARGA, ESTRESSE E PERFORMANCE CONCORRENTE
    # =========================================================================
    print(f"\n--> 6. TESTES DE CARGA, ESTRESSE E PERFORMANCE (REQUISICOES CONCORRENTES)")
    print("  Enviando 50 requisicoes simultaneas paralelas em multiplos threads...")

    concurrent_reqs = 50
    success_count = 0
    fail_count = 0
    latencies = []

    def single_bench_req(i):
        endpoint = f"{BASE_URL}/inventory/grid"
        st = time.time()
        status, body, el = make_request(endpoint, method="GET", headers=headers_admin)
        return status == 200, el

    start_bench = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(single_bench_req, i) for i in range(concurrent_reqs)]
        for f in concurrent.futures.as_completed(futures):
            ok, lat = f.result()
            if ok:
                success_count += 1
            else:
                fail_count += 1
            latencies.append(lat)
    
    total_bench_time = time.time() - start_bench
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0
    throughput = concurrent_reqs / total_bench_time

    print(f"  [BENCHMARK CONCLUIDO]")
    print(f"  - Total Requisicoes: {concurrent_reqs}")
    print(f"  - Sucesso: {success_count} ({success_count/concurrent_reqs*100:.1f}%) | Falhas: {fail_count}")
    print(f"  - Tempo Total de Carga: {total_bench_time:.2f}s")
    print(f"  - Vazao (Throughput): {throughput:.2f} req/seg")
    print(f"  - Latencia Media: {avg_latency:.2f} ms")
    print(f"  - Latencia P95 (95th Percentile): {p95_latency:.2f} ms")

    test_results["performance"] = {
        "total_requests": concurrent_reqs,
        "successful_requests": success_count,
        "failed_requests": fail_count,
        "total_time_seconds": total_bench_time,
        "throughput_req_per_sec": throughput,
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency
    }

    # Salva relatorio em formato JSON em scratch
    report_file = os.path.join(os.path.dirname(__file__), "test_suite_results.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)

    print(f"\n========================================================================")
    print(f"   SUITE MESTRA DE TESTES CONCLUIDA COM EXITO!")
    print(f"   Relatorio tecnico consolidado salvo em: {report_file}")
    print(f"========================================================================\n")

if __name__ == "__main__":
    run_all_tests()
