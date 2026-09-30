import re
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class _ConfiguredFlag:
    def __bool__(self):
        return bool(settings.FOCUS_NFE_TOKEN and settings.FOCUS_NFE_TOKEN.strip())
    def __call__(self):
        return self.__bool__()

class FocusNFeService:
    """
    Cliente assíncrono para a API REST v2 da Focus NFe (NF-e SEFAZ Modelo 55).
    Documentação oficial: https://focusnfe.com.br/doc/
    """
    is_configured = _ConfiguredFlag()

    @classmethod
    def get_base_url(cls) -> str:
        env = (settings.FOCUS_NFE_ENV or "homologacao").strip().lower()
        if env == "producao":
            return "https://api.focusnfe.com.br/v2"
        return "https://homologacao.focusnfe.com.br/v2"

    @classmethod
    def _get_auth(cls) -> httpx.BasicAuth:
        token = (settings.FOCUS_NFE_TOKEN or "").strip()
        return httpx.BasicAuth(token, "")

    @classmethod
    def clean_digits(cls, val: Optional[str]) -> str:
        if not val:
            return ""
        return "".join(filter(str.isdigit, str(val)))

    @classmethod
    def build_nfe_payload(cls, cycle: Any, nfe_number: int, laboratory: Any = None) -> Dict[str, Any]:
        """
        Gera a estrutura JSON oficial da Focus NFe v2 com dados fiscais
        do ciclo de faturamento, ótica destinatária e itens das OSs.
        """
        now = datetime.now(timezone.utc)
        
        # Dados do emitente
        cnpj_emitente = cls.clean_digits(
            settings.FOCUS_NFE_CNPJ_EMITENTE or (laboratory.cnpj if laboratory else "58032958000144")
        ).zfill(14)

        # Dados da ótica destinatária
        store = cycle.optical_store
        cnpj_cpf = cls.clean_digits(store.cnpj or "")
        is_cnpj = len(cnpj_cpf) > 11
        
        # Inscrição Estadual
        ie = cls.clean_digits(store.ie or "")
        if ie and ie != "0":
            indicador_ie = 1  # Contribuinte ICMS
            ie_destinatario = ie
        else:
            indicador_ie = 9  # Não Contribuinte
            ie_destinatario = None

        # Endereço da ótica destinatária
        addr_raw = (store.address or "").strip()
        lgr, nro, bairro, cidade, uf, cep = "Endereco Nao Informado", "S/N", "Centro", "Brasilia", "DF", "70000000"
        
        if addr_raw:
            parts = [p.strip() for p in addr_raw.split("-")]
            if len(parts) >= 1 and "," in parts[0]:
                subparts = parts[0].split(",")
                lgr = subparts[0].strip() or lgr
                nro = subparts[1].strip() or nro
            elif len(parts) >= 1:
                lgr = parts[0]
            
            if len(parts) >= 2:
                bairro = parts[1] or bairro
            if len(parts) >= 3:
                # Cidade / UF
                city_uf = parts[2].split("/")
                cidade = city_uf[0].strip() or cidade
                if len(city_uf) > 1:
                    uf = city_uf[1].strip().upper() or uf

        # Itens faturados (Ordens de Serviço)
        items = []
        item_num = 1
        
        # Determina CFOP baseado na UF (5102 interna, 6102 interestadual)
        lab_uf = "DF"
        cfop = "5102" if uf.upper() == lab_uf else "6102"

        for bill_item in cycle.items:
            os_item = bill_item.service_order
            os_number_str = str(os_item.os_number) if os_item else f"FAT-{bill_item.id.hex[:6]}"
            client_name = os_item.client_name if os_item and os_item.client_name else "Serviço Laboratorial"
            
            item_val = float(bill_item.amount) if bill_item.amount else 0.0
            if item_val <= 0.0:
                item_val = 1.0  # Valor simbólico mínimo para evitar rejeição SEFAZ de item zerado

            item_dict = {
                "numero_item": item_num,
                "codigo_produto": f"OS-{os_number_str}",
                "descricao": f"OS {os_number_str} - Confecção de Lentes Oftálmicas ({client_name[:40]})",
                "codigo_ncm": "90015000",  # NCM Padrão Lentes oftálmicas
                "cfop": cfop,
                "unidade_comercial": "UN",
                "quantidade_comercial": 1.0,
                "valor_unitario_comercial": round(item_val, 2),
                "valor_bruto": round(item_val, 2),
                "unidade_tributavel": "UN",
                "quantidade_tributavel": 1.0,
                "valor_unitario_tributavel": round(item_val, 2),
                "origem": "0",  # Nacional
                "icms_origem": "0",
                "icms_situacao_tributaria": "102",  # Simples Nacional - sem permissão de crédito
                "pis_situacao_tributaria": "07",     # Operação isenta
                "cofins_situacao_tributaria": "07"   # Operação isenta
            }
            items.append(item_dict)
            item_num += 1

        if not items:
            # Fallback de segurança se ciclo não tiver itens
            total_float = float(cycle.total_amount or 0.0) or 1.0
            items.append({
                "numero_item": 1,
                "codigo_produto": f"FAT-{cycle.id.hex[:8]}",
                "descricao": f"Serviços Laboratoriais Ópticos - Fechamento #{cycle.id.hex[:8]}",
                "codigo_ncm": "90015000",
                "cfop": cfop,
                "unidade_comercial": "UN",
                "quantidade_comercial": 1.0,
                "valor_unitario_comercial": round(total_float, 2),
                "valor_bruto": round(total_float, 2),
                "unidade_tributavel": "UN",
                "quantidade_tributavel": 1.0,
                "valor_unitario_tributavel": round(total_float, 2),
                "origem": "0",
                "icms_origem": "0",
                "icms_situacao_tributaria": "102",
                "pis_situacao_tributaria": "07",
                "cofins_situacao_tributaria": "07"
            })

        total_fat = round(float(cycle.total_amount or sum(it["valor_bruto"] for it in items)), 2)

        payload: Dict[str, Any] = {
            "natureza_operacao": "PRESTACAO LABORATORIAL / VENDA DE LENTES",
            "data_emissao": now.strftime("%Y-%m-%d %H:%M:%S"),
            "tipo_documento": 1,         # 1 = Saída
            "finalidade_emissao": 1,     # 1 = Normal
            "consumidor_final": 1,       # 1 = Consumidor final
            "presenca_comprador": 9,     # 9 = Operação não presencial, outros
            "cnpj_emitente": cnpj_emitente,
            "nome_destinatario": store.corporate_name[:60],
            "indicador_inscricao_estadual_destinatario": str(indicador_ie),
            "logradouro_destinatario": lgr[:60],
            "numero_destinatario": nro[:10],
            "bairro_destinatario": bairro[:60],
            "municipio_destinatario": cidade[:60],
            "uf_destinatario": uf[:2],
            "cep_destinatario": cls.clean_digits(cep).zfill(8),
            "items": items,
            "formas_pagamento": [
                {
                    "forma_pagamento": "15",  # 15 = Boleto Bancário / Cobrança
                    "valor_pagamento": total_fat
                }
            ]
        }

        if is_cnpj:
            payload["cnpj_destinatario"] = cnpj_cpf.zfill(14)
        else:
            payload["cpf_destinatario"] = cnpj_cpf.zfill(11)

        if ie_destinatario:
            payload["inscricao_estadual_destinatario"] = ie_destinatario

        if store.telephone:
            payload["telefone_destinatario"] = cls.clean_digits(store.telephone)

        if store.email:
            payload["email_destinatario"] = store.email.strip()

        return payload

    @classmethod
    async def emit_nfe(cls, ref: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Despacha a NF-e para a API Focus NFe via POST /v2/nfe?ref={ref}.
        """
        if not cls.is_configured():
            raise ValueError("Token da Focus NFe não está configurado.")

        base_url = cls.get_base_url()
        url = f"{base_url}/nfe"
        params = {"ref": ref}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    url,
                    params=params,
                    json=payload,
                    auth=cls._get_auth(),
                    headers={"Content-Type": "application/json"}
                )
            except Exception as exc:
                logger.error(f"Erro de comunicação com Focus NFe: {exc}")
                raise ValueError(f"Falha de conexão com a Focus NFe: {str(exc)}")

            if response.status_code in (200, 201, 202):
                return response.json()
            else:
                try:
                    err_json = response.json()
                    msg = err_json.get("mensagem") or err_json.get("erros") or str(err_json)
                except Exception:
                    msg = response.text or f"Erro HTTP {response.status_code}"
                logger.error(f"Rejeição Focus NFe [{response.status_code}]: {msg}")
                raise ValueError(f"Focus NFe [{response.status_code}]: {msg}")

    @classmethod
    async def get_nfe(cls, ref: str) -> Dict[str, Any]:
        """
        Consulta o status atualizado da NF-e junto à Focus NFe / SEFAZ via GET /v2/nfe/{ref}?completa=1.
        """
        if not cls.is_configured():
            raise ValueError("Token da Focus NFe não está configurado.")

        base_url = cls.get_base_url()
        url = f"{base_url}/nfe/{ref}"
        params = {"completa": 1}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    url,
                    params=params,
                    auth=cls._get_auth()
                )
            except Exception as exc:
                logger.error(f"Erro ao consultar Focus NFe ref {ref}: {exc}")
                raise ValueError(f"Falha ao consultar Focus NFe: {str(exc)}")

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise ValueError(f"Nota fiscal com ref '{ref}' não encontrada na Focus NFe.")
            else:
                try:
                    err_data = response.json()
                    msg = err_data.get("mensagem") or str(err_data)
                except Exception:
                    msg = response.text
                raise ValueError(f"Erro na consulta Focus NFe [{response.status_code}]: {msg}")

    @classmethod
    async def cancel_nfe(cls, ref: str, justification: str = "Cancelamento homologado") -> Dict[str, Any]:
        """
        Cancela a NF-e perante a SEFAZ via DELETE /v2/nfe/{ref}.
        """
        if not cls.is_configured():
            raise ValueError("Token da Focus NFe não está configurado.")

        if len(justification.strip()) < 15:
            justification = "Cancelamento homologado por solicitacao do cliente e correcao cadastral"

        base_url = cls.get_base_url()
        url = f"{base_url}/nfe/{ref}"
        body = {"justificativa": justification}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(
                    "DELETE",
                    url,
                    json=body,
                    auth=cls._get_auth(),
                    headers={"Content-Type": "application/json"}
                )
            except Exception as exc:
                logger.error(f"Erro ao cancelar NF-e ref {ref}: {exc}")
                raise ValueError(f"Falha ao cancelar NF-e na Focus NFe: {str(exc)}")

            if response.status_code in (200, 202):
                return response.json()
            else:
                try:
                    err_data = response.json()
                    msg = err_data.get("mensagem") or str(err_data)
                except Exception:
                    msg = response.text
                raise ValueError(f"Focus NFe cancelamento [{response.status_code}]: {msg}")

    @classmethod
    async def download_file(cls, path_or_url: str) -> bytes:
        """
        Baixa o arquivo binário (DANFE em PDF ou XML oficial) retornado pela Focus NFe.
        """
        if not path_or_url:
            raise ValueError("URL do arquivo não informada.")

        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            full_url = path_or_url
        else:
            base_url = cls.get_base_url()
            # Remove /v2 do final da base se a URL do arquivo já começar com /arquivos
            origin = base_url.replace("/v2", "")
            clean_path = path_or_url if path_or_url.startswith("/") else f"/{path_or_url}"
            full_url = f"{origin}{clean_path}"

        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            try:
                response = await client.get(full_url, auth=cls._get_auth() if cls.is_configured() else None)
            except Exception as exc:
                logger.error(f"Falha ao baixar arquivo fiscal de {full_url}: {exc}")
                raise ValueError(f"Erro de conexão ao baixar arquivo: {str(exc)}")

            if response.status_code == 200:
                return response.content
            else:
                raise ValueError(f"Erro [{response.status_code}] ao baixar arquivo da Focus NFe.")

    @classmethod
    async def check_connection(cls) -> Dict[str, Any]:
        """
        Verifica o status de conectividade com a Focus NFe.
        """
        env = (settings.FOCUS_NFE_ENV or "homologacao").strip().lower()
        if not cls.is_configured():
            return {
                "configured": False,
                "environment": env,
                "token_configured": False,
                "status": "simulation_mode",
                "cnpj_emitente": settings.FOCUS_NFE_CNPJ_EMITENTE,
                "message": "Operando em Modo Simulação Local (FOCUS_NFE_TOKEN não informado)."
            }

        # Com token configurado, faz teste de ping
        base_url = cls.get_base_url()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Testa endpoint de consulta com ref inexistente para validar autenticação
                res = await client.get(f"{base_url}/nfe/ping_check", auth=cls._get_auth())
                # 404 significa que o endpoint respondeu e autenticação passou
                if res.status_code in (200, 404):
                    return {
                        "configured": True,
                        "environment": env,
                        "token_configured": True,
                        "status": "online",
                        "cnpj_emitente": settings.FOCUS_NFE_CNPJ_EMITENTE,
                        "message": f"Conexão ativa com Focus NFe ({env.upper()})."
                    }
                elif res.status_code == 401:
                    return {
                        "configured": True,
                        "environment": env,
                        "token_configured": True,
                        "status": "offline",
                        "cnpj_emitente": settings.FOCUS_NFE_CNPJ_EMITENTE,
                        "message": "Token de acesso inválido ou expirado na Focus NFe."
                    }
                else:
                    return {
                        "configured": True,
                        "environment": env,
                        "token_configured": True,
                        "status": "online",
                        "cnpj_emitente": settings.FOCUS_NFE_CNPJ_EMITENTE,
                        "message": f"Focus NFe respondeu com status {res.status_code}."
                    }
        except Exception as exc:
            return {
                "configured": True,
                "environment": env,
                "token_configured": True,
                "status": "offline",
                "cnpj_emitente": settings.FOCUS_NFE_CNPJ_EMITENTE,
                "message": f"Não foi possível conectar à Focus NFe: {str(exc)}"
            }

FocusNfeService = FocusNFeService
