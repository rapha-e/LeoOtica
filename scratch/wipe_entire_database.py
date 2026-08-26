import os
import sys
import sqlite3
from decimal import Decimal

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.app.core.database import Base
from backend.app.core.security import get_password_hash
from backend.app.models.user import User, Role
from backend.app.models.laboratory import Laboratory
from backend.app.models.degree_policy import DegreePricingPolicy
from backend.app.crud.crud_system_parameters import seed_default_parameters

db_paths = [
    os.path.join(project_root, "backend", "leootica.db"),
    os.path.join(project_root, "backend", "sql_app.db"),
    os.path.join(project_root, "backend", "app.db"),
    os.path.join(project_root, "leootica.db")
]

async def wipe_database_file(db_file_path):
    if not os.path.exists(db_file_path):
        return

    print(f"\n==================================================")
    print(f"[RESET COMPLETO] Recriando banco limpo: {db_file_path}")
    print(f"==================================================")

    url = f"sqlite+aiosqlite:///{db_file_path.replace('\\', '/')}"
    engine = create_async_engine(url, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with engine.begin() as conn:
        print("1. Removendo todas as tabelas e recriando esquema limpo...")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        print("2. Criando Perfis de Acesso (Administrador / Operador)...")
        role_admin = Role(name="Administrador", description="Acesso total ao sistema")
        role_op = Role(name="Operador", description="Acesso operacional")
        session.add_all([role_admin, role_op])
        await session.flush()

        print("3. Criando Usuário Administrador (Login: admin | Senha: admin)...")
        admin_hash = get_password_hash("admin")
        
        user_admin = User(
            name="Administrador do Sistema",
            email="admin",
            hashed_password=admin_hash,
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )

        user_admin_email = User(
            name="Administrador do Sistema",
            email="admin@leootica.com.br",
            hashed_password=admin_hash,
            role_id=role_admin.id,
            is_active=True,
            must_change_password=False
        )

        session.add_all([user_admin, user_admin_email])
        await session.flush()

        print("4. Inicializando Perfil do Laboratório Nova LAB e Política de Precificação Inicial...")
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

        print("5. Semeando parâmetros de sistema padrões...")
        await seed_default_parameters(session)
        await session.commit()

    await engine.dispose()

    # Executa VACUUM via sqlite3 síncrono para garantir zeramento de arquivos auxiliares WAL/SHM
    print("6. Executando VACUUM para eliminar espaço fragmentado e arquivos temporários...")
    conn = sqlite3.connect(db_file_path)
    cursor = conn.cursor()
    cursor.execute("VACUUM;")
    conn.commit()
    conn.close()
    print("DONE: Banco zerado com sucesso!")

async def main():
    for db_path in db_paths:
        try:
            await wipe_database_file(db_path)
        except Exception as e:
            print(f"Erro ao zerar banco {db_path}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
