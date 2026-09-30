import os
import sys

# Adiciona o diretório pai (raiz do projeto) ao PYTHONPATH para resolver as importações do pacote 'backend'
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import uvicorn
from backend.app.main import app

if __name__ == "__main__":
    is_frozen = getattr(sys, "frozen", False)
    if is_frozen:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
