import asyncio
import httpx
import json

async def test_register_without_validations():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token_info = login_res.json()
        token = token_info.get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        stores_res = await client.get("/optical-stores/", headers=headers)
        models_res = await client.get("/lens-models/", headers=headers)
        stores_list = stores_res.json()
        models_list = models_res.json()
        
        store_id = stores_list[0]["id"]
        model_id = models_list[0]["id"]
        
        # Test case: CIL -1, axis 0 (EXACTLY LIKE USER ANEXO 1 & 2), and optional frame/prescription fields
        payload = {
            "optical_store_id": store_id,
            "client_order_number": "TEST-FLEX-1",
            "tray_number": "BD-FLEX",
            "priority": "NORMAL",
            "os_type": "PADRAO",
            "lens_model_id": model_id,
            "od_prescription": {
                "spherical": -2.0,
                "cylindrical": -1.0,
                "axis": 0,          # Axis = 0 now allowed freely without error
                "addition": 0.0,
                "prism_value": 0.0,
                "dnp": 0.0,         # Dnp = 0 allowed
                "height": 0.0       # Height = 0 allowed
            },
            "oe_prescription": {
                "spherical": -2.0,
                "cylindrical": -1.0,
                "axis": 0,
                "addition": 0.0,
                "prism_value": 0.0,
                "dnp": 0.0,
                "height": 0.0
            },
            "frame_geometry": {
                "frame_a": 0.0,
                "frame_b": 0.0,
                "frame_bridge": 0.0,
                "frame_ed": 0.0,
                "frame_type": "ACETATO"
            }
        }
        
        res = await client.post("/os/factory/register", json=payload, headers=headers)
        print("Status code:", res.status_code)
        print("Response:", json.dumps(res.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(test_register_without_validations())
