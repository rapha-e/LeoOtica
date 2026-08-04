import urllib.request
import urllib.error
import os

def test_excel_export():
    url = "http://localhost:8000/api/v1/alerts/export-purchases?lead_time_days=7&safety_days=5&coverage_days=15"
    print("Enviando requisição GET para exportar planilha Excel...")
    import json
    import pytest
    login_url = "http://localhost:8000/api/v1/auth/login"
    login_data = json.dumps({"email": "suporte", "password": "Dio@sup.2203"}).encode("utf-8")
    login_req = urllib.request.Request(login_url, data=login_data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(login_req) as login_resp:
            token_info = json.loads(login_resp.read().decode("utf-8"))
            access_token = token_info["access_token"]
    except Exception as e:
        print(f"Servidor não disponível ou erro ao obter token: {e}")
        pytest.skip("Servidor HTTP local não está acessível para teste de integração")

    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {access_token}")
        with urllib.request.urlopen(req) as response:
            status_code = response.status
            content_type = response.headers.get("Content-Type")
            content_disposition = response.headers.get("Content-Disposition")
            
            print(f"Status da Resposta: {status_code}")
            print(f"Content-Type: {content_type}")
            print(f"Content-Disposition: {content_disposition}")
            
            assert status_code == 200, "Erro: Status de resposta deve ser 200"
            assert "vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type, "Erro: Content-Type incorreto"
            
            # Salva o arquivo localmente para inspeção se necessário
            output_path = os.path.join(os.path.dirname(__file__), "teste_excel.xlsx")
            with open(output_path, "wb") as f:
                f.write(response.read())
            print(f"Planilha exportada com sucesso e salva em: {output_path}")
            
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(f"Detalhes: {e.read().decode('utf-8')}")
        exit(1)
    except AssertionError as e:
        print(f"Falha na validação do teste: {e}")
        exit(1)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        exit(1)

if __name__ == "__main__":
    test_excel_export()
