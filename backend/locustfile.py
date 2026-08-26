import random
from locust import HttpUser, task, between


class LeoOticaUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Autentica o usuário simulado obtendo o Bearer Token JWT do FastAPI."""
        login_res = self.client.post(
            "/api/v1/auth/login",
            json={"email": "suporte", "password": "Dio@sup.2203"},
            name="/api/v1/auth/login [POST]"
        )
        if login_res.status_code == 200:
            token = login_res.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {token}"})

    @task(4)
    def list_service_orders(self):
        """Simula consulta e busca de OSs no sistema."""
        self.client.get("/api/v1/os/", name="/api/v1/os/ [GET]")

    @task(3)
    def view_tv_production(self):
        """Simula atualização do Dashboard TV de Produção."""
        self.client.get("/api/v1/tv/producao", name="/api/v1/tv/producao [GET]")

    @task(2)
    def query_blocks_models(self):
        """Simula consulta da grade de blocos e dioptrias."""
        self.client.get("/api/v1/blocks/models", name="/api/v1/blocks/models [GET]")

    @task(2)
    def view_analytics_dashboard(self):
        """Simula acesso ao painel de inteligência de dados e gráficos."""
        self.client.get("/api/v1/analytics/dashboard", name="/api/v1/analytics/dashboard [GET]")

    @task(1)
    def register_factory_os(self):
        """Simula criação de nova OS fabril com alocação e baixa no estoque."""
        payload = {
            "optical_store_id": "9973f5b2-55de-45c8-94ea-0a9462784e40",
            "lens_model_id": "9ac34f6f-7e0d-41e8-975e-a0b615714469",
            "client_order_number": f"PED-LOCUST-{random.randint(1000, 9999)}",
            "tray_number": f"TRAY-{random.randint(1, 50)}",
            "priority": random.choice(["NORMAL", "URGENTE", "REFAZIMENTO"]),
            "os_type": "PADRAO",
            "od_prescription": {
                "spherical": -2.00,
                "cylindrical": -1.00,
                "axis": 90,
                "dnp": 31.5,
                "height": 18.0
            },
            "oe_prescription": {
                "spherical": -2.00,
                "cylindrical": -1.00,
                "axis": 90,
                "dnp": 31.5,
                "height": 18.0
            },
            "frame_geometry": {
                "frame_a": 54.0,
                "frame_b": 36.0,
                "frame_bridge": 17.0,
                "frame_ed": 56.0,
                "frame_type": "METAL"
            }
        }
        self.client.post("/api/v1/os/factory/register", json=payload, name="/api/v1/os/factory/register [POST]")
