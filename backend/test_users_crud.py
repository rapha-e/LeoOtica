import unittest
import sys
import os
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar pacotes do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.user import User, Role
from backend.app.schemas.user import UserCreate, UserUpdate
from backend.app.crud import user as crud_user
from backend.app.core.security import verify_password

class TestUsersCrud(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        # Cria banco de dados SQLite em memória para testes isolados
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)
        
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with self.async_session() as session:
            # Cadastra as roles padrão do sistema
            self.role_admin = Role(name="Administrador", description="Administrador de Fábrica")
            self.role_operador = Role(name="Operador", description="Operador de Fábrica")
            session.add(self.role_admin)
            session.add(self.role_operador)
            await session.commit()
            
            # Atualiza referências locais
            await session.refresh(self.role_admin)
            await session.refresh(self.role_operador)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_create_user_success(self):
        """Valida que um novo usuário é criado com a senha criptografada via bcrypt."""
        async with self.async_session() as session:
            user_in = UserCreate(
                name="João da Silva",
                email="joao@optimind.com.br",
                password="minhasenha123",
                role_id=self.role_operador.id,
                is_active=True
            )
            db_user = await crud_user.create_user(session, user_in)
            self.assertIsNotNone(db_user)
            self.assertEqual(db_user.name, "João da Silva")
            self.assertEqual(db_user.email, "joao@optimind.com.br")
            self.assertEqual(db_user.role_id, self.role_operador.id)
            self.assertTrue(db_user.is_active)
            
            # Valida que o hash da senha foi criado e que a senha em texto plano bate com o hash
            self.assertNotEqual(db_user.hashed_password, "minhasenha123")
            self.assertTrue(verify_password("minhasenha123", db_user.hashed_password))

    async def test_get_user_by_email(self):
        """Valida a busca de um usuário cadastrado pelo e-mail."""
        async with self.async_session() as session:
            user_in = UserCreate(
                name="Maria Administradora",
                email="maria@optimind.com.br",
                password="adminpassword",
                role_id=self.role_admin.id,
                is_active=True
            )
            await crud_user.create_user(session, user_in)
            
            # Busca pelo e-mail
            fetched_user = await crud_user.get_user_by_email(session, "maria@optimind.com.br")
            self.assertIsNotNone(fetched_user)
            self.assertEqual(fetched_user.name, "Maria Administradora")
            self.assertEqual(fetched_user.role.name, "Administrador")

    async def test_update_user_password(self):
        """Valida que a senha do usuário só é re-criptografada e modificada se for fornecida no update."""
        async with self.async_session() as session:
            user_in = UserCreate(
                name="Operador Teste",
                email="teste.op@optimind.com.br",
                password="senhaoriginal",
                role_id=self.role_operador.id,
                is_active=True
            )
            db_user = await crud_user.create_user(session, user_in)
            original_hash = db_user.hashed_password
            
            # Update de nome e status, deixando senha como None
            update_in_1 = UserUpdate(
                name="Operador Nome Alterado",
                is_active=False
            )
            updated_user_1 = await crud_user.update_user(session, db_user, update_in_1)
            self.assertEqual(updated_user_1.name, "Operador Nome Alterado")
            self.assertFalse(updated_user_1.is_active)
            self.assertEqual(updated_user_1.hashed_password, original_hash) # Deve manter o mesmo hash
            self.assertTrue(verify_password("senhaoriginal", updated_user_1.hashed_password))
            
            # Update de senha
            update_in_2 = UserUpdate(
                password="novasenha123"
            )
            updated_user_2 = await crud_user.update_user(session, updated_user_1, update_in_2)
            self.assertNotEqual(updated_user_2.hashed_password, original_hash) # Deve ter gerado um novo hash
            self.assertTrue(verify_password("novasenha123", updated_user_2.hashed_password))
            self.assertFalse(verify_password("senhaoriginal", updated_user_2.hashed_password))

    async def test_delete_user(self):
        """Valida a exclusão de um usuário do banco de dados."""
        async with self.async_session() as session:
            user_in = UserCreate(
                name="Usuario Temporario",
                email="temp@optimind.com.br",
                password="temppassword",
                role_id=self.role_operador.id,
                is_active=True
            )
            db_user = await crud_user.create_user(session, user_in)
            user_id = db_user.id
            
            # Exclui o usuário
            success = await crud_user.delete_user(session, user_id)
            self.assertTrue(success)
            
            # Valida que não existe mais
            fetched_user = await crud_user.get_user(session, user_id)
            self.assertIsNone(fetched_user)

if __name__ == "__main__":
    unittest.main()
