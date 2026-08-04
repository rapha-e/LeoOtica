import asyncio
import os
import sys

# Adiciona o diretório pai (raiz do projeto) ao PYTHONPATH
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.app.core.database import Base
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.models import *
from backend.app.models.user import User, Role

DATABASE_URL = settings.DATABASE_URL

async def reset_clean_db():
    print("Limpando todos os registros do banco de dados...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        # Remove todas as tabelas e recria a estrutura zerada
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        print("Criando perfis de acesso...")
        role_admin = Role(name="Administrador", description="Acesso total ao sistema")
        role_op = Role(name="Operador", description="Acesso operacional")
        session.add_all([role_admin, role_op])
        await session.flush()

        print("Criando Usuario Administrador de Suporte...")
        # Permite login com 'suporte' ou 'suporte@novalab.com.br'
        user_suporte_1 = User(
            name="Suporte Técnico",
            email="suporte",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        user_suporte_2 = User(
            name="Suporte Técnico",
            email="suporte@novalab.com.br",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        # Mantém também admin padrão por compatibilidade se necessário
        user_admin = User(
            name="Administrador Master",
            email="admin@novalab.com.br",
            hashed_password=get_password_hash("Dio@sup.2203"),
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        
        session.add_all([user_suporte_1, user_suporte_2])
        await session.commit()

        print("Inicializando parametros padroes do sistema...")
        from backend.app.crud.crud_system_parameters import seed_default_parameters
        await seed_default_parameters(session)

        print("Inicializando modelos padroes de blocos semiacabados...")
        from backend.app.crud import crud_block
        from backend.app.schemas.block import BlockModelCreate
        await crud_block.create_block_model(session, BlockModelCreate(brand="Essilor", name="Bloco Freeform 1.56", material="CR-39", refractive_index=1.56))
        await crud_block.create_block_model(session, BlockModelCreate(brand="Hoya", name="Bloco Surfaçado 1.50", material="CR-39", refractive_index=1.50))

    print("\nBANCO DE DADOS LIMPO E REINICIALIZADO COM SUCESSO!")
    print("Usuario Administrador Criado:")
    print("   Login: suporte  (ou suporte@novalab.com.br)")
    print("   Senha: Dio@sup.2203")


if __name__ == "__main__":
    asyncio.run(reset_clean_db())
