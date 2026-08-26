import asyncio
import httpx

async def inspect_grade():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        models = (await client.get("/lens-models/", headers=headers)).json()
        print("Modelos disponíveis:", [(m["id"], m["brand"], m.get("name")) for m in models])
        
        grid_res = await client.get("/inventory/grid", headers=headers)
        if grid_res.status_code == 200:
            grid = grid_res.json()
            print("Grid items sample count:", len(grid) if isinstance(grid, list) else "not list")
            if isinstance(grid, list) and len(grid) > 0:
                print("Exemplo de item da grade:", grid[0])

if __name__ == "__main__":
    asyncio.run(inspect_grade())
