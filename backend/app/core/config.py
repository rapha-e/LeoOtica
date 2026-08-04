import os
from dotenv import load_dotenv

# Encontra o caminho do .env localizado em backend/.env e carrega no os.environ
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
load_dotenv(dotenv_path)

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nova Lab - Módulo de Estoque e Grade de Lentes"
    API_V1_STR: str = "/api/v1"
    
    # URL do banco de dados (usando driver assíncrono asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://leouser:leopassword@localhost:5432/leootica"
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Se estiver rodando como executável compilado (PyInstaller), força o uso do SQLite local
import sys
if getattr(sys, 'frozen', False):
    import os
    # Diretório onde o executável .exe está rodando
    base_dir = os.path.dirname(sys.executable)
    db_path = os.path.join(base_dir, "leootica.db")
    # Formata o caminho para usar barras normais no SQLAlchemy
    db_url = f"sqlite+aiosqlite:///{db_path.replace(os.sep, '/')}"
    settings.DATABASE_URL = db_url

