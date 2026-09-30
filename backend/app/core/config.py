import os
from typing import Optional
from dotenv import load_dotenv

# Encontra o caminho do .env localizado em backend/.env e carrega no os.environ
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
load_dotenv(dotenv_path)

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nova Lab - Módulo de Estoque e Grade de Lentes"
    API_V1_STR: str = "/api/v1"
    
    # URL do banco de dados (usando driver assíncrono asyncpg)
    DATABASE_URL: str = "postgresql+asyncpg://leouser:leopassword@localhost:5432/Nova Lab"
    
    # Configurações da Integração com a Focus NFe
    FOCUS_NFE_TOKEN: Optional[str] = None
    FOCUS_NFE_TOKEN_HOMOLOGACAO: Optional[str] = None
    FOCUS_NFE_TOKEN_PRODUCAO: Optional[str] = None
    FOCUS_NFE_ENV: str = "homologacao"  # 'homologacao' ou 'producao'
    FOCUS_NFE_CNPJ_EMITENTE: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Se estiver rodando como executável compilado (PyInstaller), força o uso do SQLite local e carrega o .env do diretório do executável
import sys
if getattr(sys, 'frozen', False):
    import os
    # Diretório onde o executável .exe está rodando
    base_dir = os.path.dirname(sys.executable)
    exe_env = os.path.join(base_dir, ".env")
    if os.path.exists(exe_env):
        load_dotenv(exe_env, override=True)
        for field in ["FOCUS_NFE_TOKEN", "FOCUS_NFE_TOKEN_HOMOLOGACAO", "FOCUS_NFE_TOKEN_PRODUCAO", "FOCUS_NFE_ENV", "FOCUS_NFE_CNPJ_EMITENTE"]:
            val = os.getenv(field)
            if val is not None:
                setattr(settings, field, val)
    db_path = os.path.join(base_dir, "novalab.db")
    # Formata o caminho para usar barras normais no SQLAlchemy
    db_url = f"sqlite+aiosqlite:///{db_path.replace(os.sep, '/')}"
    settings.DATABASE_URL = db_url


