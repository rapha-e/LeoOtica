import unittest
import sys
import os
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Permite importar do backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import Base
from backend.app.models.partner import PartnerShop, FaceVisagismSession
from backend.app.api.endpoints.partner import generate_face_embedding
from backend.app.schemas.partner import VisagismDetectResponse

class TestAILogic(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        # Banco de dados em memória SQLite
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        self.async_session = async_sessionmaker(bind=self.engine, expire_on_commit=False)
        
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with self.async_session() as session:
            # Convenia ótica de teste
            self.partner = PartnerShop(
                corporate_name="Otica Teste Ltda",
                trade_name="Otica Teste",
                cnpj="12.345.678/0001-99"
            )
            session.add(self.partner)
            await session.flush()
            
            # Cria embeddings mockados consistentes
            # Vetor 1: Rosto Redondo A
            self.emb_redondo_a = generate_face_embedding(b"rosto_redondo_a_imagem_raw_data")
            # Vetor 2: Rosto Redondo B (similar ao A)
            self.emb_redondo_b = generate_face_embedding(b"rosto_redondo_b_imagem_raw_data_diferente")
            # Vetor 3: Rosto Quadrado A (muito diferente)
            self.emb_quadrado_a = generate_face_embedding(b"rosto_quadrado_imagem_totalmente_distinta")
            
            # Insere sessões no banco
            self.session_redondo_a = FaceVisagismSession(
                partner_shop_id=self.partner.id,
                face_shape_detected="ROUND",
                recommended_frame_types="Armacoes retangulares",
                face_embedding=self.emb_redondo_a
            )
            self.session_quadrado_a = FaceVisagismSession(
                partner_shop_id=self.partner.id,
                face_shape_detected="SQUARE",
                recommended_frame_types="Armacoes redondas",
                face_embedding=self.emb_quadrado_a
            )
            session.add(self.session_redondo_a)
            session.add(self.session_quadrado_a)
            await session.commit()
            
            await session.refresh(self.partner)
            await session.refresh(self.session_redondo_a)
            await session.refresh(self.session_quadrado_a)

    async def asyncTearDown(self):
        await self.engine.dispose()

    def test_generate_face_embedding_consistency(self):
        """Valida que o gerador de embeddings facial gera vetores consistentes e normalizados."""
        img_bytes = b"foto_do_paciente_xyz"
        vec1 = generate_face_embedding(img_bytes)
        vec2 = generate_face_embedding(img_bytes)
        
        # 1. Determinização: mesma imagem -> mesmo vetor
        self.assertEqual(vec1, vec2)
        self.assertEqual(len(vec1), 512)
        
        # 2. Normalização: norma do vetor deve ser igual a 1.0 (ou muito próxima)
        norm = sum(x * x for x in vec1) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=5)

    async def test_visagism_similarity_sqlite_fallback(self):
        """Valida a busca vetorial por similaridade de cosseno (produto escalar no SQLite)."""
        async with self.async_session() as session:
            # Buscaremos rostos semelhantes ao Vetor A
            query_all = (
                select(FaceVisagismSession)
                .where(FaceVisagismSession.face_embedding.isnot(None))
            )
            res = await session.execute(query_all)
            all_sessions = res.scalars().all()
            
            # Executa o cálculo manual de similaridade (produto escalar)
            scored = []
            for s in all_sessions:
                sim = sum(x * y for x, y in zip(s.face_embedding, self.emb_redondo_b))
                scored.append((sim, s))
                
            scored.sort(key=lambda x: x[0], reverse=True)
            
            # O mais próximo do Rosto Redondo B deve ser o Rosto Redondo A
            self.assertTrue(len(scored) >= 2)
            self.assertEqual(scored[0][1].face_shape_detected, "ROUND")

if __name__ == "__main__":
    unittest.main()
