import asyncio
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple

def parse_nfe_xml_sync(xml_content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Parseia síncronamente o XML da NF-e.
    """
    root = ET.fromstring(xml_content)
    
    # Namespaces comuns da NF-e
    ns = {"ns": "http://www.portalfiscal.inf.br/nfe"}
    
    # 1. Obtém o número da NF-e
    nfe_number = "DESCONHECIDO"
    nnf_elem = root.find(".//ns:ide/ns:nNF", ns)
    if nnf_elem is not None:
        nfe_number = nnf_elem.text
        
    # 2. Varre os itens da nota
    products = []
    det_elems = root.findall(".//ns:det", ns)
    for det in det_elems:
        prod = det.find("ns:prod", ns)
        if prod is not None:
            # Obtém EAN (código de barras)
            cean_elem = prod.find("ns:cEAN", ns)
            barcode = cean_elem.text if cean_elem is not None else ""
            
            # Limpa código de barras se for "SEM GTIN" ou vazio
            if not barcode or barcode.strip().upper() in ["SEM GTIN", "SEM EAN"]:
                barcode = ""
            else:
                barcode = barcode.strip()
                
            # Descrição do item
            xprod_elem = prod.find("ns:xProd", ns)
            description = xprod_elem.text if xprod_elem is not None else "Produto sem descrição"
            
            # Quantidade
            qcom_elem = prod.find("ns:qCom", ns)
            try:
                quantity = int(float(qcom_elem.text)) if qcom_elem is not None else 0
            except ValueError:
                quantity = 0
                
            products.append({
                "barcode": barcode,
                "quantity": quantity,
                "description": description.strip()
            })
            
    return nfe_number, products

async def parse_nfe_xml(xml_content: bytes) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Parseia assincronamente o XML de uma NF-e, executando a computação pesada em uma thread separada.
    """
    return await asyncio.to_thread(parse_nfe_xml_sync, xml_content)
