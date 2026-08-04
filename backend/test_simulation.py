import unittest
import sys
import os
from decimal import Decimal

# Permite importar do backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.api.endpoints.partner import calcular_sagita_espessura

class TestSimulationPhysics(unittest.TestCase):
    
    def test_calculate_negative_lens_miopia(self):
        """Valida que para lentes negativas (miopia) a borda é mais espessa que o centro."""
        res = calcular_sagita_espessura(
            sph=Decimal("-4.00"),
            cyl=Decimal("0.00"),
            dnp=Decimal("30.00"),
            frame_a=Decimal("50.00"),
            frame_bridge=Decimal("18.00"),
            frame_ed=Decimal("54.00"),
            index=Decimal("1.50")
        )
        
        self.assertEqual(res["thickness_center"], Decimal("1.50"))
        self.assertTrue(res["thickness_edge"] > res["thickness_center"])
        self.assertTrue("profile_points" in res)
        self.assertEqual(len(res["profile_points"]), 42) # 21 pontos da frente + 21 de trás
        
        # O polígono deve fechar (primeiro ponto e último ponto)
        first_point = res["profile_points"][0]
        last_point = res["profile_points"][-1]
        self.assertAlmostEqual(first_point["x"], last_point["x"], places=2)
        
    def test_calculate_positive_lens_hipermetropia(self):
        """Valida que para lentes positivas (hipermetropia) o centro é mais espesso que a borda."""
        res = calcular_sagita_espessura(
            sph=Decimal("3.00"),
            cyl=Decimal("0.00"),
            dnp=Decimal("32.00"),
            frame_a=Decimal("52.00"),
            frame_bridge=Decimal("16.00"),
            frame_ed=Decimal("50.00"),
            index=Decimal("1.67")
        )
        
        self.assertEqual(res["thickness_edge"], Decimal("1.00"))
        self.assertTrue(res["thickness_center"] > res["thickness_edge"])
        self.assertTrue("profile_points" in res)
        self.assertEqual(len(res["profile_points"]), 42)
        
        # O polígono deve fechar
        first_point = res["profile_points"][0]
        last_point = res["profile_points"][-1]
        self.assertAlmostEqual(first_point["x"], last_point["x"], places=2)

if __name__ == "__main__":
    unittest.main()
