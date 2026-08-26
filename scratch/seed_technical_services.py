import asyncio
import httpx
import json

SERVICES_TO_SEED = [
    {
        "name": "Montagem Balgriff / Três Peças (Bucha/Parafuso)",
        "description": "Furação e montagem técnica de alta precisão para armações balgriff sem aro.",
        "price": 45.0
    },
    {
        "name": "Coloração / Tinta Solar (G15, Fumê, Castanho)",
        "description": "Banho de coloração em lentes de resina com tonalidade degradê ou total.",
        "price": 35.0
    },
    {
        "name": "Facetamento CNC / Montagem Especial",
        "description": "Recorte e corte automatizado em facetadora CNC de alta precisão.",
        "price": 25.0
    },
    {
        "name": "Solda em Armação de Metal / Titânio",
        "description": "Reparo de solda e restauração em charneiras e hastes metálicas.",
        "price": 40.0
    },
    {
        "name": "Troca de Plaquetas, Parafusos e Ajuste Estrutural",
        "description": "Manutenção preventiva, substituição de plaquetas de silicone e parafusos de aço.",
        "price": 15.0
    },
    {
        "name": "Polimento de Bordas e Bisel Fino / Rebaixo",
        "description": "Polimento brilhante de bordas em lentes de alto índice e frisos para fio de nylon.",
        "price": 20.0
    },
    {
        "name": "Surfaçagem Digital Personalizada (Freeform)",
        "description": "Usinagem de ponto a ponto no gerador digital para lentes multifocais.",
        "price": 60.0
    },
    {
        "name": "Recorte de Lente e Reprocesso de Montagem",
        "description": "Ajuste de diâmetro e transferência de aro em armações do cliente.",
        "price": 30.0
    },
    {
        "name": "Tratamento Antirreflexo Especial / Filtro Azul",
        "description": "Aplicação de camada protetora contra luz azul de telas e reflexos.",
        "price": 50.0
    },
    {
        "name": "Conferência de Grau & Laudo Técnico",
        "description": "Leitura em lensômetro digital de alta precisão com emissão de relatório técnico.",
        "price": 10.0
    }
]

async def seed_services():
    async with httpx.AsyncClient(base_url="http://localhost:8000/api/v1") as client:
        login_res = await client.post("/auth/login", json={"email": "suporte", "password": "Dio@sup.2203"})
        token_info = login_res.json()
        token = token_info.get("access_token")
        if not token:
            print("Erro ao autenticar!")
            return
            
        headers = {"Authorization": f"Bearer {token}"}
        
        existing_res = await client.get("/catalog/technical-services/", headers=headers)
        existing_services = existing_res.json() if existing_res.status_code == 200 else []
        existing_names = {s.get("name") for s in existing_services if isinstance(s, dict)}
        
        print(f"Servicos ja existentes no banco: {len(existing_names)}")
        
        added_count = 0
        for serv in SERVICES_TO_SEED:
            if serv["name"] not in existing_names:
                res = await client.post("/catalog/technical-services/", json=serv, headers=headers)
                if res.status_code == 201:
                    added_count += 1
                    print(f"-> Servico cadastrado com sucesso: {serv['name']} | R$ {serv['price']:.2f}")
                else:
                    print(f"Erro ao cadastrar {serv['name']}: {res.status_code} - {res.text}")
            else:
                print(f"Servico ja cadastrado: {serv['name']}")
                
        print(f"\nFinalizado! {added_count} novos servicos adicionados.")

if __name__ == "__main__":
    asyncio.run(seed_services())
