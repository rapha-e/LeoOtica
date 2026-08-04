import requests
import time

def run_test():
    # Login
    url_login = "http://localhost:8000/api/v1/auth/login"
    res_login = requests.post(url_login, json={"email": "admin", "password": "admin"})
    if res_login.status_code != 200:
        print("Falha no login:", res_login.text)
        return

    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    timestamp = int(time.time())
    cnpj_dinamico = f"55555555{timestamp}"[:14]
    sku_dinamico = f"L-DEL-{timestamp}"

    # Criar uma ótica de faturamento de teste
    url_store = "http://localhost:8000/api/v1/optical-stores/"
    store_payload = {
        "cnpj": cnpj_dinamico,
        "corporate_name": "Otica Teste Faturamento",
        "trade_name": "Otica Teste",
        "email": "otica@teste.com",
        "is_active": True
    }
    res_store = requests.post(url_store, json=store_payload, headers=headers)
    print("Criar Otica:", res_store.status_code)
    if res_store.status_code != 201:
        print("Erro ao criar ótica:", res_store.text)
        return
    store_id = res_store.json()["id"]

    # Criar produto no catálogo
    url_prod = "http://localhost:8000/api/v1/catalog/products/"
    prod_payload = {
        "name": "Lente Teste Delete 5",
        "sku": sku_dinamico,
        "cost_price": 10.0,
        "sale_price": 50.0,
        "is_lens": True,
        "brand": "Teste",
        "material": "Resina",
        "refractive_index": 1.56,
        "treatment": "Incolor",
        "diameter": 70
    }
    res_prod = requests.post(url_prod, json=prod_payload, headers=headers)
    print("Criar Produto:", res_prod.status_code)
    if res_prod.status_code != 201:
        print("Erro ao criar produto:", res_prod.text)
        return
    prod_id = res_prod.json()["id"]

    # Criar OS
    url_os = "http://localhost:8000/api/v1/os/"
    os_payload = {
        "client_name": "Maria Teste",
        "optical_store_id": store_id
    }
    res_os = requests.post(url_os, json=os_payload, headers=headers)
    print("Criar OS:", res_os.status_code)
    if res_os.status_code != 201:
        print("Erro ao criar OS:", res_os.text)
        return
    os_id = res_os.json()["id"]

    # Adicionar item à OS
    url_item = f"http://localhost:8000/api/v1/os/{os_id}/items/"
    item_payload = {
        "entity_type": "product",
        "entity_id": prod_id,
        "quantity": 1
    }
    res_item = requests.post(url_item, json=item_payload, headers=headers)
    print("Adicionar Item:", res_item.status_code)
    if res_item.status_code != 201:
        print("Erro ao adicionar item:", res_item.text)
        return
    item_id = res_item.json()["id"]

    # Remover item da OS
    url_delete = f"http://localhost:8000/api/v1/os/{os_id}/items/{item_id}"
    res_delete = requests.delete(url_delete, headers=headers)
    print("Deletar Item Status Code:", res_delete.status_code)

    # Limpeza
    res_del_prod = requests.delete(f"{url_prod}{prod_id}", headers=headers)
    print("Deletar Produto Status Code:", res_del_prod.status_code)
    res_del_store = requests.delete(f"{url_store}{store_id}", headers=headers)
    print("Deletar Otica Status Code:", res_del_store.status_code)

if __name__ == "__main__":
    run_test()
