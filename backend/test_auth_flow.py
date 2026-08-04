import unittest
import sys
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.user import User, Role
from backend.app.schemas.user import UserCreate, LoginPayload, ChangePasswordPayload
from backend.app.core.security import get_password_hash
from backend.app.api.endpoints.auth import login, change_password
from backend.app.crud import user as crud_user

# Configuração de banco de dados SQLite em memória para o teste
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

class TestAuthFlow(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with AsyncSessionLocal() as session:
            # Cadastra as roles padrão
            self.role_admin = Role(name="Administrador", description="Administrador de Fábrica")
            self.role_operador = Role(name="Operador", description="Operador de Fábrica")
            session.add(self.role_admin)
            session.add(self.role_operador)
            await session.commit()
            
            await session.refresh(self.role_admin)
            await session.refresh(self.role_operador)
            
            # Cria administrador de teste (login alfanumérico)
            self.admin_user = User(
                name="Admin Teste",
                email="admin",
                hashed_password=get_password_hash("admin"),
                is_active=True,
                must_change_password=False,
                role_id=self.role_admin.id
            )
            session.add(self.admin_user)
            await session.commit()

    async def asyncTearDown(self):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    async def test_login_alphanumeric_success(self):
        """Valida login com usuário alfanumérico padrão via endpoint direto."""
        async with AsyncSessionLocal() as session:
            payload = LoginPayload(email="admin", password="admin")
            token_response = await login(payload=payload, db=session)
            
            self.assertIsNotNone(token_response)
            self.assertIsNotNone(token_response.access_token)
            self.assertEqual(token_response.role, "Administrador")
            self.assertFalse(token_response.must_change_password)

    async def test_first_access_forced_reset(self):
        """Valida que um usuário criado com must_change_password=True é forçado a resetar a senha no primeiro acesso."""
        async with AsyncSessionLocal() as session:
            # 1. Cria operador novo com must_change_password=True
            user_in = UserCreate(
                name="Operador Novo",
                email="opnovo",
                password="senha_temp_123",
                role_id=self.role_operador.id,
                is_active=True,
                must_change_password=True
            )
            db_user = await crud_user.create_user(session, user_in)
            self.assertIsNotNone(db_user)
            self.assertTrue(db_user.must_change_password)

            # 2. Executa login e valida flag True no Token retornado
            login_payload = LoginPayload(email="opnovo", password="senha_temp_123")
            token_response = await login(payload=login_payload, db=session)
            self.assertTrue(token_response.must_change_password)

            # 3. Chama redefinição de senha
            change_payload = ChangePasswordPayload(new_password="minha_nova_senha")
            updated_user = await change_password(payload=change_payload, current_user=db_user, db=session)
            self.assertFalse(updated_user.must_change_password)

            # 4. Executa login novamente com a nova senha e valida flag False no Token
            login_payload_2 = LoginPayload(email="opnovo", password="minha_nova_senha")
            token_response_2 = await login(payload=login_payload_2, db=session)
            self.assertFalse(token_response_2.must_change_password)

if __name__ == "__main__":
    unittest.main()
