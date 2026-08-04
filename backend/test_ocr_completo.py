import sqlite3
import urllib.request
import urllib.error
import json
import os

def setup_partner_shop():
    db_path = os.path.join(os.path.dirname(__file__), "leootica.db")
    print(f"Conectando ao banco SQLite local em: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Garante que a tabela partner_shops existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='partner_shops'")
    if not cursor.fetchone():
        print("Erro: Tabela 'partner_shops' nao encontrada. Inicie o backend primeiro.")
        conn.close()
        return None
        
    # Verifica se já existe a ótica
    cursor.execute("SELECT id FROM partner_shops WHERE trade_name = 'Ótica do Centro'")
    row = cursor.fetchone()
    if not row:
        print("Inserindo parceiro 'Ótica do Centro' para testes...")
        import uuid
        partner_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO partner_shops (id, corporate_name, trade_name, cnpj, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (partner_id, "Ótica do Centro Ltda", "Ótica do Centro", "99.888.777/0001-66", 1, "2026-06-07 12:00:00")
        )
        conn.commit()
    else:
        partner_id = row[0]
        print(f"Parceiro 'Ótica do Centro' já cadastrado com ID: {partner_id}")
        
    conn.close()
    return partner_id

def test_ocr_upload():
    # 1. Garante que o parceiro de teste está inserido no banco de dados SQLite real do backend
    partner_id = setup_partner_shop()
    if not partner_id:
        print("Erro ao configurar parceiro. Abortando teste.")
        return
    
    # 2. Executa a requisição HTTP POST para o endpoint /upload-receita
    url = "http://localhost:8000/api/v1/os/upload-receita"
    filename = "receita_sucesso.jpg"
    file_content = b"fake image bytes"
    
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    body = []
    body.append(f"--{boundary}".encode('utf-8'))
    body.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode('utf-8'))
    body.append('Content-Type: image/jpeg'.encode('utf-8'))
    body.append(b'')
    body.append(file_content)
    body.append(f"--{boundary}--".encode('utf-8'))
    body.append(b'')
    
    req_body = b"\r\n".join(body)
    
    import pytest
    # Login para obter o token do operador padrão
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

    req = urllib.request.Request(url, data=req_body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", f"Bearer {access_token}")
    
    print("\nEnviando receita_sucesso.jpg para /api/v1/os/upload-receita...")
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.status
            res_content = response.read().decode('utf-8')
            print(f"Status da Resposta: {status_code}")
            
            data = json.loads(res_content)
            
            # Validações dos requisitos solicitados
            # 1. Nome do paciente alterado para "Rafael Silva"
            assert data.get("client_name") == "Rafael Silva", f"Erro: client_name esperado 'Rafael Silva', recebido '{data.get('client_name')}'"
            # 2. Nome do médico extraído/mockado
            assert data.get("doctor_name") == "Dra. Sandra de Sá", f"Erro: doctor_name esperado 'Dra. Sandra de Sá', recebido '{data.get('doctor_name')}'"
            # 3. Ótica associada
            assert str(data.get("partner_shop_id")).replace("-", "") == str(partner_id).replace("-", ""), f"Erro: partner_shop_id esperado '{partner_id}', recebido '{data.get('partner_shop_id')}'"
            
            print("\n[OK] TODAS AS VALIDACOES DE OCR PASSARAM COM SUCESSO!")
            print(f"  - Paciente: {data.get('client_name')}")
            print(f"  - Medico: {data.get('doctor_name')}")
            partner_shop = data.get('partner_shop') or {}
            print(f"  - Otica Parceira Associada: {partner_shop.get('trade_name', 'N/A')}")
            
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(f"Detalhes do erro:\n{e.read().decode('utf-8')}")
        exit(1)
    except AssertionError as e:
        print(f"Falha na validacao do teste: {e}")
        exit(1)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        exit(1)

if __name__ == "__main__":
    test_ocr_upload()
