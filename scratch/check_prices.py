import asyncio
import httpx

async def check_prices():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        models_res = await client.get("/lens-models/", headers=headers)
        models = models_res.json()
        print("=== PREÇOS ATUAIS DOS MODELOS DE LENTES (LensModel) ===")
        for m in models:
            print(f"- {m['brand']}: sale_price={m.get('sale_price')}, sale_price_over_threshold={m.get('sale_price_over_threshold')}, degree_threshold={m.get('degree_threshold')}")

        prods_res = await client.get("/catalog/products/", headers=headers)
        prods = prods_res.json()
        print("\n=== PREÇOS ATUAIS DOS PRODUTOS DO CATÁLOGO (Product) ===")
        for p in prods:
            print(f"- {p['name']}: sale_price={p.get('sale_price')}, cost_price={p.get('cost_price')}")

if __name__ == "__main__":
    asyncio.run(check_prices())
