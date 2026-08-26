import asyncio
import sys
import os

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.app.schemas.lens import RegisterFallbackRequest, ScanRequest
from backend.app.core.database import AsyncSessionLocal
from backend.app.crud import lens as crud_lens

def test_pydantic_schema():
    print("--- Testando Pydantic RegisterFallbackRequest Schema ---")
    req1 = RegisterFallbackRequest(barcode="2279710000000", quantity=16)
    print(f"req1 (quantity=16) -> quantity: {req1.quantity}, quantity_available: {req1.quantity_available}")
    assert req1.quantity == 16 and req1.quantity_available == 16, "FAILED req1!"

    req2 = RegisterFallbackRequest(barcode="2279710000000", quantity_available=10)
    print(f"req2 (quantity_available=10) -> quantity: {req2.quantity}, quantity_available: {req2.quantity_available}")
    assert req2.quantity == 10 and req2.quantity_available == 10, "FAILED req2!"

    print("✅ Pydantic Schema de quantidade sincroniza 100% perfeitamente!")

if __name__ == "__main__":
    test_pydantic_schema()
