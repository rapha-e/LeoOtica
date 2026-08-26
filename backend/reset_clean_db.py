import asyncio
import os
import sys
from decimal import Decimal

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
from backend.app.models.laboratory import Laboratory
from backend.app.models.degree_policy import DegreePricingPolicy
from backend.app.crud.crud_system_parameters import seed_default_parameters

DATABASE_URL = settings.DATABASE_URL

async def reset_clean_db():
    print("========================================================================")
    print("ZERING ALL DATABASE RECORDS - KEEPING ONLY SUPORTE USER")
    print("========================================================================")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        print("Recriando estrutura limpa de todas as tabelas...")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as session:
        print("1/4. Criando perfis de acesso...")
        role_admin = Role(name="Administrador", description="Acesso total ao sistema")
        role_op = Role(name="Operador", description="Acesso operacional")
        session.add_all([role_admin, role_op])
        await session.flush()

        print("2/4. Criando Usuário Administrador (admin / admin)...")
        admin_hash = get_password_hash("admin")
        user_admin = User(
            name="Administrador do Sistema",
            email="admin",
            hashed_password=admin_hash,
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )
        session.add(user_admin)
        await session.flush()

        print("3/4. Configurando Perfil do Laboratório Nova LAB e Política por Grau...")
        lab = Laboratory(
            name="Nova LAB",
            address="Avenida transversal quadra 23 conjunto B lote 27 apartamento 201",
            cep="71572-302",
            telephone="61 99266-7281",
            cnpj="58.032.958/0001-44"
        )
        default_policy = DegreePricingPolicy(
            degree_threshold=Decimal("2.00"),
            default_sale_price_le=Decimal("75.00"),
            default_sale_price_gt=Decimal("95.00"),
            is_active=True
        )
        session.add_all([lab, default_policy])

        print("4/4. Inicializando parâmetros padrões do sistema...")
        await seed_default_parameters(session)

        await session.commit()

    print("\n========================================================================")
    print("BANCO DE DADOS ZERADO COM SUCESSO!")
    print("Usuário Mantido:")
    print("   Login: admin")
    print("   Senha: admin")
    print("========================================================================\n")

if __name__ == "__main__":
    asyncio.run(reset_clean_db())

