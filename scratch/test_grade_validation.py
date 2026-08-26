import asyncio
import httpx
import json

async def test_grade_validation():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # Login
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token_info = login_res.json()
        token = token_info.get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        stores_res = await client.get("/optical-stores/", headers=headers)
        stores_list = stores_res.json()
        store_id = stores_list[0]["id"]
        
        model_id = "7b899c14-8ada-46c3-a23a-9186cfee82d3" # LP PHOTO FILTRO AZUL AR 1.56
        
        print("=== TESTE 1: Grau Inexistente na Grade (Esférico -18.75 / Cilíndrico -7.25) ===")
        invalid_payload = {
            "optical_store_id": store_id,
            "client_order_number": "TEST-INVALID-DEGREE",
            "tray_number": "BD-999",
            "priority": "NORMAL",
            "os_type": "PADRAO",
            "lens_model_id": model_id,
            "od_prescription": {"spherical": -18.75, "cylindrical": -7.25, "axis": 90, "addition": 0.0, "dnp": 31.0, "height": 20.0},
            "oe_prescription": {"spherical": -18.75, "cylindrical": -7.25, "axis": 90, "addition": 0.0, "dnp": 31.0, "height": 20.0},
            "frame_geometry": {"frame_a": 52.0, "frame_b": 36.0, "frame_bridge": 18.0, "frame_ed": 56.0, "frame_type": "ACETATO"}
        }
        res1 = await client.post("/os/factory/register", json=invalid_payload, headers=headers)
        print("Status code 1:", res1.status_code)
        print("Response 1:", res1.text)

        print("\n=== TESTE 2: Grau Válido com Estoque na Grade (Esférico -2.00 / Cilíndrico -1.00) ===")
        valid_payload = {
            "optical_store_id": store_id,
            "client_order_number": "TEST-VALID-DEGREE",
            "tray_number": "BD-100",
            "priority": "NORMAL",
            "os_type": "PADRAO",
            "lens_model_id": model_id,
            "od_prescription": {"spherical": -2.00, "cylindrical": -1.00, "axis": 90, "addition": 0.0, "dnp": 31.0, "height": 20.0},
            "oe_prescription": {"spherical": -2.00, "cylindrical": -1.00, "axis": 90, "addition": 0.0, "dnp": 31.0, "height": 20.0},
            "frame_geometry": {"frame_a": 52.0, "frame_b": 36.0, "frame_bridge": 18.0, "frame_ed": 56.0, "frame_type": "ACETATO"}
        }
        res2 = await client.post("/os/factory/register", json=valid_payload, headers=headers)
        print("Status code 2:", res2.status_code)
        print("Response 2:", json.dumps(res2.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(test_grade_validation())
