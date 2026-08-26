import sys
import os
sys.path.insert(0, os.path.abspath('.'))
import asyncio
import httpx

async def test_single_eye_mf_os():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # 1. Login
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get stores and lens model
        stores_res = await client.get("/optical-stores/", headers=headers)
        stores = stores_res.json()
        store_id = stores[0]["id"] if stores else None
        
        lenses_res = await client.get("/lens-models/", headers=headers)
        lenses = lenses_res.json()
        mf_model = next((m for m in lenses if "Bloco MF INCOLOR 1.50" in m.get("brand", "") or "Bloco MF INCOLOR 1.50" in m.get("name", "")), None)
        
        if not mf_model:
            print("Model not found in catalog!")
            return
            
        print(f"Testing with model: {mf_model['id']} - {mf_model['brand']}")
        
        # 3. Payload for single eye OD (base 2.00, add 1.00)
        payload = {
            "optical_store_id": store_id,
            "client_order_number": "TEST-MF-OD-ONLY",
            "tray_number": "BD-99",
            "priority": "NORMAL",
            "os_type": "PADRAO",
            "lens_model_id": mf_model["id"],
            "od_prescription": {
                "spherical": 0.0,
                "cylindrical": 0.0,
                "axis": 0,
                "addition": 1.0,
                "base_curve": 2.0,
                "dnp": 30.0,
                "height": 20.0
            },
            "oe_prescription": None,
            "special_instructions": "Teste alocação olho único OD"
        }
        
        res = await client.post("/os/factory/register", json=payload, headers=headers)
        print("Status code:", res.status_code)
        print("Response:", res.json())

if __name__ == "__main__":
    asyncio.run(test_single_eye_mf_os())
