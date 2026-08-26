import asyncio
import httpx
import json

async def test_price_update():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        # Login
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token_info = login_res.json()
        token = token_info.get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test payload setting LP Incolor 1.50 price_base to 180.00 and price_over to 300.00
        # And LP AR 1.56 price_base to 210.00 and price_over to 350.00
        params_payload = {
            "lp_incolor_150_cyl_threshold": "2.00",
            "lp_incolor_150_price_base": "180.00",
            "lp_incolor_150_price_over": "300.00",
            "lp_ar_156_cyl_threshold": "2.00",
            "lp_ar_156_price_base": "210.00",
            "lp_ar_156_price_over": "350.00"
        }
        
        res = await client.post("/system-parameters/", json=params_payload, headers=headers)
        print("Status code:", res.status_code)
        
        # Verify LensModel prices after update
        models_res = await client.get("/lens-models/", headers=headers)
        models = models_res.json()
        print("\n=== NOVOS PREÇOS DE LensModel APÓS ATUALIZAÇÃO ===")
        for m in models:
            if "Incolor 1.50" in m['brand'] or "AR 1.56" in m['brand']:
                print(f"- {m['brand']}: sale_price={m.get('sale_price')}, sale_price_over_threshold={m.get('sale_price_over_threshold')}, degree_threshold={m.get('degree_threshold')}")

        # Verify Product prices in catalog
        prods_res = await client.get("/catalog/products/", headers=headers)
        prods = prods_res.json()
        print("\n=== NOVOS PREÇOS DE Product APÓS ATUALIZAÇÃO ===")
        for p in prods:
            if "Incolor 1.50" in p['name'] or "AR 1.56" in p['name']:
                print(f"- {p['name']}: sale_price={p.get('sale_price')}")

if __name__ == "__main__":
    asyncio.run(test_price_update())
