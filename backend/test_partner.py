import unittest
from decimal import Decimal
import sys
import os

# Permite importar pacotes tanto da pasta app quanto do escopo raiz backend.app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api.endpoints.partner import calcular_sagita_espessura
from app.crud.os import transpose_dioptria

class TestPartnerLogic(unittest.TestCase):
    
    def test_transpose_dioptria_negativo(self):
        """Valida que dioptrias com cilindro negativo não sofrem transposição."""
        sph, cyl, axis = transpose_dioptria(Decimal("-2.00"), Decimal("-1.00"), 90)
        self.assertEqual(sph, Decimal("-2.00"))
        self.assertEqual(cyl, Decimal("-1.00"))
        self.assertEqual(axis, 90)

    def test_transpose_dioptria_positivo(self):
        """Valida que dioptrias com cilindro positivo são transpostas corretamente."""
        sph, cyl, axis = transpose_dioptria(Decimal("-2.00"), Decimal("1.00"), 90)
        self.assertEqual(sph, Decimal("-1.00"))
        self.assertEqual(cyl, Decimal("-1.00"))
        self.assertEqual(axis, 180) # 90 + 90 = 180

    def test_calcular_sagita_miopia(self):
        """
        Valida o cálculo físico de sagita e espessuras para lentes de miopia (negativas).
        Grau: -4.00, Cil: 0, DNP: 30, A: 50, Ponte: 18, ED: 54, Indice: 1.50
        Descentração: ((50 + 18) - 2*30)/2 = 8/2 = 4mm
        Diâmetro mínimo de corte: 54 + 2 * 4 = 62mm
        Potência max: 4.00
        Sagita s = (4 * 31^2) / (2000 * 0.5) = (4 * 961) / 1000 = 3.844mm
        Miopia -> Centro fixo em 1.5mm, Borda: 1.5 + 3.844 = 5.34mm
        """
        res = calcular_sagita_espessura(
            sph=Decimal("-4.00"),
            cyl=Decimal("0.00"),
            dnp=Decimal("30.00"),
            frame_a=Decimal("50.00"),
            frame_bridge=Decimal("18.00"),
            frame_ed=Decimal("54.00"),
            index=Decimal("1.50")
        )
        self.assertEqual(res["minimum_blank_diameter"], Decimal("62.00"))
        self.assertEqual(res["descentration"], Decimal("4.00"))
        self.assertEqual(res["thickness_center"], Decimal("1.50"))
        self.assertAlmostEqual(res["thickness_edge"], Decimal("5.34"), places=2)

    def test_calcular_sagita_hipermetropia(self):
        """
        Valida o cálculo físico de sagita e espessuras para lentes de hipermetropia (positivas).
        Grau: +3.00, Cil: 0, DNP: 32, A: 52, Ponte: 16, ED: 50, Indice: 1.67
        Descentração: ((52 + 16) - 2*32)/2 = 4/2 = 2mm
        Diâmetro mínimo de corte: 50 + 2 * 2 = 54mm
        Potência max: 3.00
        Sagita s = (3 * 27^2) / (2000 * 0.67) = (3 * 729) / 1340 = 2187 / 1340 = 1.63mm
        Hipermetropia -> Borda fixa em 1.0mm, Centro: 1.0 + 1.63 = 2.63mm
        """
        res = calcular_sagita_espessura(
            sph=Decimal("3.00"),
            cyl=Decimal("0.00"),
            dnp=Decimal("32.00"),
            frame_a=Decimal("52.00"),
            frame_bridge=Decimal("16.00"),
            frame_ed=Decimal("50.00"),
            index=Decimal("1.67")
        )
        self.assertEqual(res["minimum_blank_diameter"], Decimal("54.00"))
        self.assertEqual(res["thickness_edge"], Decimal("1.00"))
        self.assertAlmostEqual(res["thickness_center"], Decimal("2.63"), places=2)

if __name__ == "__main__":
    unittest.main()
