import sys
import os
import unittest
from decimal import Decimal
from pydantic import ValidationError

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.services.os_factory_service import OSFactoryService
from backend.app.schemas.os_factory import EyePrescriptionSchema, FrameGeometrySchema


class TestOpticalBoundary(unittest.IsolatedAsyncioTestCase):

    def test_transposition_positive_cylinder(self):
        """Valida a transposição canônica para cilíndrico negativo em prescrições com cilindro positivo."""
        # Esférico: +2.00, Cilíndrico: +1.50, Eixo: 45° -> Esférico: +3.50, Cilíndrico: -1.50, Eixo: 135°
        sph, cyl, axis = OSFactoryService._transpose_dioptria(2.00, 1.50, 45)
        self.assertEqual(sph, 3.50)
        self.assertEqual(cyl, -1.50)
        self.assertEqual(axis, 135)

    def test_transposition_negative_cylinder_unchanged(self):
        """Garante que prescrição já em cilíndrico negativo não seja alterada."""
        sph, cyl, axis = OSFactoryService._transpose_dioptria(-2.50, -1.25, 90)
        self.assertEqual(sph, -2.50)
        self.assertEqual(cyl, -1.25)
        self.assertEqual(axis, 90)

    def test_transposition_axis_boundary_90(self):
        """Testa o limite de eixo em 90° ao transpor cilindro positivo."""
        sph, cyl, axis = OSFactoryService._transpose_dioptria(+1.00, +2.00, 90)
        self.assertEqual(sph, 3.00)
        self.assertEqual(cyl, -2.00)
        self.assertEqual(axis, 180)

    def test_transposition_axis_boundary_above_90(self):
        """Testa o limite de eixo > 90° ao transpor cilindro positivo."""
        sph, cyl, axis = OSFactoryService._transpose_dioptria(0.00, +1.00, 120)
        self.assertEqual(sph, 1.00)
        self.assertEqual(cyl, -1.00)
        self.assertEqual(axis, 30)

    def test_min_diameter_boundary_calculation(self):
        """Valida o cálculo exato do diâmetro mínimo do bloco (ED + 2 * |Descentração| + 2.0mm)."""
        # Frame A: 54.0, Bridge: 18.0, DNP: 31.0, ED: 56.0
        # Descentração = ((54 + 18)/2) - 31 = 36 - 31 = 5.0mm
        # Min Diameter = 56.0 + (2 * 5.0) + 2.0 = 68.0mm
        decentration, min_dia = OSFactoryService._calculate_decentration_and_min_diameter(
            frame_a=54.0, frame_bridge=18.0, dnp=31.0, ed=56.0
        )
        self.assertAlmostEqual(decentration, 5.0, places=2)
        self.assertAlmostEqual(min_dia, 68.0, places=2)

    def test_extreme_decentration_min_diameter(self):
        """Valida limites de armações hiper-dimensionadas com alta descentração."""
        # Frame A: 64.0, Bridge: 20.0, DNP: 27.0, ED: 68.0
        # Descentração = ((64 + 20)/2) - 27 = 42 - 27 = 15.0mm
        # Min Diameter = 68.0 + (2 * 15.0) + 2.0 = 100.0mm
        decentration, min_dia = OSFactoryService._calculate_decentration_and_min_diameter(
            frame_a=64.0, frame_bridge=20.0, dnp=27.0, ed=68.0
        )
        self.assertEqual(decentration, 15.0)
        self.assertEqual(min_dia, 100.0)

    def test_invalid_axis_validation(self):
        """Garante erro de validação para eixo fora da faixa [0, 180] ou eixo nulo com cilindro negativo."""
        with self.assertRaises(ValidationError):
            EyePrescriptionSchema(
                spherical=-2.00,
                cylindrical=-1.00,
                axis=0,  # Inválido para cilíndrico < 0
                dnp=30.0,
                height=20.0
            )


if __name__ == "__main__":
    unittest.main()
