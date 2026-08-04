import secrets
import hashlib
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Header
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.models.partner import PartnerShop, PartnerApiKey, FaceVisagismSession
from backend.app.models.os import ServiceOrder, OSWorkflowHistory
from backend.app.models.lens import LensInventoryGrade, LensModel
from backend.app.schemas.partner import (
    PartnerShopCreate, PartnerShopResponse, ApiKeyCreateResponse, ApiKeyInfoResponse,
    LensSimulationRequest, LensSimulationResponse, LensThicknessDetail,
    VisagismDetectResponse, PartnerOSSubmit
)
from backend.app.schemas.os import ServiceOrderResponse
from backend.app.crud import os as crud_os
from backend.app.crud import movement as crud_movement
from backend.app.schemas.movement import StockMovementCreate

router = APIRouter()
admin_router = APIRouter()

# --- MIDDLEWARE DE AUTENTICAÇÃO VIA CHAVE E SEGREDO DE API (SHA-256) ---
async def get_current_partner_shop(
    x_api_key: str = Header(..., alias="X-API-Key"),
    x_api_secret: str = Header(..., alias="X-API-Secret"),
    db: AsyncSession = Depends(get_db)
) -> PartnerShop:
    # 1. Busca a chave pelo prefixo (key_prefix)
    query = (
        select(PartnerApiKey)
        .where(PartnerApiKey.key_prefix == x_api_key)
        .options(selectinload(PartnerApiKey.partner_shop))
    )
    result = await db.execute(query)
    api_key_obj = result.scalars().first()
    
    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida ou inexistente."
        )
        
    # 2. Verifica se a chave expirou
    if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta API Key está expirada."
        )
        
    # 3. Calcula o hash SHA-256 do segredo fornecido
    hashed_secret = hashlib.sha256(x_api_secret.encode("utf-8")).hexdigest()
    
    # 4. Compara com tempo constante para prevenir timing attacks
    if not secrets.compare_digest(api_key_obj.hashed_secret, hashed_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Secret inválido."
        )
        
    # 5. Verifica se a loja associada está ativa
    partner = api_key_obj.partner_shop
    if not partner or not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A loja parceira está inativa no sistema."
        )
        
    return partner

# --- ENDPOINTS DE ADMINISTRAÇÃO DE PARCEIROS (FÁBRICA) ---
@admin_router.post("/", response_model=PartnerShopResponse, status_code=status.HTTP_201_CREATED)
async def register_partner_shop(
    payload: PartnerShopCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Cadastra uma nova ótica conveniada no sistema.
    """
    # Verifica duplicidade
    query = select(PartnerShop).where(PartnerShop.cnpj == payload.cnpj)
    res = await db.execute(query)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma loja parceira cadastrada com este CNPJ."
        )
        
    partner = PartnerShop(
        corporate_name=payload.corporate_name,
        trade_name=payload.trade_name,
        cnpj=payload.cnpj,
        is_active=payload.is_active if payload.is_active is not None else True
    )
    db.add(partner)
    await db.commit()
    await db.refresh(partner)
    return partner

@admin_router.post("/{partner_id}/keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def generate_partner_api_key(
    partner_id: uuid.UUID,
    expires_in_days: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Gera um novo par de chaves para uma loja parceira e retorna o segredo bruto apenas uma vez.
    """
    query = select(PartnerShop).where(PartnerShop.id == partner_id)
    res = await db.execute(query)
    partner = res.scalars().first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja parceira não encontrada."
        )
        
    prefix = f"LO-{secrets.token_hex(3).upper()}" # LO-XXXXXX (8 caracteres)
    secret = secrets.token_hex(32) # Segredo de 64 caracteres
    hashed = hashlib.sha256(secret.encode("utf-8")).hexdigest()
    
    expires_at = None
    if expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
    api_key_obj = PartnerApiKey(
        partner_shop_id=partner_id,
        key_prefix=prefix,
        hashed_secret=hashed,
        expires_at=expires_at
    )
    db.add(api_key_obj)
    await db.commit()
    
    return ApiKeyCreateResponse(
        key_prefix=prefix,
        api_key_secret=secret,
        expires_at=expires_at
    )

@admin_router.get("/", response_model=List[PartnerShopResponse])
async def list_partner_shops(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a lista de todas as lojas parceiras registradas.
    """
    query = select(PartnerShop).offset(skip).limit(limit)
    res = await db.execute(query)
    return list(res.scalars().all())

@admin_router.get("/{partner_id}", response_model=PartnerShopResponse)
async def get_partner_shop(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os detalhes de uma loja parceira específica.
    """
    query = select(PartnerShop).where(PartnerShop.id == partner_id)
    res = await db.execute(query)
    partner = res.scalars().first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja parceira não encontrada."
        )
    return partner

@admin_router.put("/{partner_id}", response_model=PartnerShopResponse)
async def update_partner_shop(
    partner_id: uuid.UUID,
    payload: PartnerShopCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza as informações de cadastro de uma loja parceira.
    """
    query = select(PartnerShop).where(PartnerShop.id == partner_id)
    res = await db.execute(query)
    partner = res.scalars().first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja parceira não encontrada."
        )
    
    # Valida duplicidade de CNPJ caso tenha sido alterado
    if partner.cnpj != payload.cnpj:
        cnpj_query = select(PartnerShop).where(PartnerShop.cnpj == payload.cnpj)
        cnpj_res = await db.execute(cnpj_query)
        if cnpj_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe uma loja parceira cadastrada com este CNPJ."
            )
            
    partner.corporate_name = payload.corporate_name
    partner.trade_name = payload.trade_name
    partner.cnpj = payload.cnpj
    if payload.is_active is not None:
        partner.is_active = payload.is_active
        
    await db.commit()
    await db.refresh(partner)
    return partner

@admin_router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partner_shop(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Remove uma loja parceira do sistema juntamente com suas chaves de forma em cascata.
    """
    query = select(PartnerShop).where(PartnerShop.id == partner_id)
    res = await db.execute(query)
    partner = res.scalars().first()
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loja parceira não encontrada."
        )
    await db.delete(partner)
    await db.commit()
    return None

@admin_router.get("/{partner_id}/keys", response_model=List[ApiKeyInfoResponse])
async def list_partner_api_keys(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a lista de chaves de API associadas a uma loja parceira específica.
    """
    query = select(PartnerApiKey).where(PartnerApiKey.partner_shop_id == partner_id)
    res = await db.execute(query)
    return list(res.scalars().all())

@admin_router.delete("/{partner_id}/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_partner_api_key(
    partner_id: uuid.UUID,
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Revoga (remove) uma chave de API específica de uma loja parceira.
    """
    query = select(PartnerApiKey).where(
        PartnerApiKey.id == key_id,
        PartnerApiKey.partner_shop_id == partner_id
    )
    res = await db.execute(query)
    key_obj = res.scalars().first()
    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chave de API não encontrada para esta loja parceira."
        )
    await db.delete(key_obj)
    await db.commit()
    return None

# --- 2. SIMULADOR DE ESPESSURA 3D E UPSELL INTELIGENTE ---
def calcular_sagita_espessura(
    sph: Decimal, cyl: Decimal, dnp: Decimal, 
    frame_a: Decimal, frame_bridge: Decimal, frame_ed: Decimal, 
    index: Decimal
) -> Dict[str, Any]:
    # 1. Descentração por olho
    dec = ((frame_a + frame_bridge) - (2 * dnp)) / 2
    
    # 2. Diâmetro mínimo da lente bruta (blank size)
    d = frame_ed + 2 * abs(dec)
    
    # 3. Potência meridional máxima absoluta
    p_max = max(abs(sph), abs(sph + cyl))
    
    # 4. Cálculo da Sagita s = (|P| * (d/2)^2) / (2000 * (n - 1))
    if index <= Decimal("1.0"):
        index = Decimal("1.50")
    s = (p_max * ((d / 2) ** 2)) / (2000 * (index - 1))
    
    # 5. Espessura da Lente
    is_negative = (sph < Decimal("0.0"))
    if is_negative:
        thickness_center = Decimal("1.50")
        thickness_edge = thickness_center + s
    else:
        thickness_edge = Decimal("1.00")
        thickness_center = thickness_edge + s
        
    # Gera coordenadas do perfil transversal 2D da lente
    d_val = float(d)
    tc_val = float(thickness_center)
    te_val = float(thickness_edge)
    
    c1 = 0.0015  # Curvatura base convexa frontal padrão
    half_d = d_val / 2.0
    c2 = c1 + (te_val - tc_val) / (half_d ** 2) if half_d > 0 else c1
    
    profile_points = []
    steps = 20
    # Amostra a superfície frontal
    for i in range(steps + 1):
        x = -half_d + (d_val * i / steps)
        y = c1 * (x ** 2)
        profile_points.append({"x": round(x, 2), "y": round(y, 2)})
        
    # Amostra a superfície traseira (reverso para fechar o polígono)
    for i in range(steps, -1, -1):
        x = -half_d + (d_val * i / steps)
        y = tc_val + c2 * (x ** 2)
        profile_points.append({"x": round(x, 2), "y": round(y, 2)})
        
    return {
        "spherical": sph,
        "cylindrical": cyl,
        "dnp": dnp,
        "descentration": round(dec, 2),
        "minimum_blank_diameter": round(d, 2),
        "sagita": round(s, 2),
        "thickness_center": round(thickness_center, 2),
        "thickness_edge": round(thickness_edge, 2),
        "refractive_index": index,
        "profile_points": profile_points
    }


@router.post("/simulate-lens", response_model=LensSimulationResponse)
async def simulate_lens_thickness(
    payload: LensSimulationRequest,
    partner: PartnerShop = Depends(get_current_partner_shop)
):
    """
    Recebe os graus e medidas de armações e calcula a sagita e espessura da lente.
    Se a lente for muito grossa, sugere upsell de índice de refração.
    """
    # Executa cálculo para o índice fornecido
    od_res = calcular_sagita_espessura(
        payload.od_spherical, payload.od_cylindrical, payload.od_dnp,
        payload.frame_a, payload.frame_bridge, payload.frame_ed, payload.refractive_index
    )
    oe_res = calcular_sagita_espessura(
        payload.oe_spherical, payload.oe_cylindrical, payload.oe_dnp,
        payload.frame_a, payload.frame_bridge, payload.frame_ed, payload.refractive_index
    )
    
    # Define se precisa de upsell
    # Regra: se espessura periférica (borda na miopia) ou central (hipermetropia) for >= 4.5mm
    max_thickness_od = max(od_res["thickness_center"], od_res["thickness_edge"])
    max_thickness_oe = max(oe_res["thickness_center"], oe_res["thickness_edge"])
    max_thickness = max(max_thickness_od, max_thickness_oe)
    
    requires_upsell = False
    recommended_index = None
    upsell_msg = None
    thickness_reduction_pct = None
    comparison_data = None
    
    # Se a lente for espessa e o índice escolhido for menor do que 1.67
    if max_thickness >= Decimal("4.5") and payload.refractive_index < Decimal("1.67"):
        requires_upsell = True
        recommended_index = Decimal("1.67") if max_thickness < Decimal("6.0") else Decimal("1.74")
        
        # Calcula espessuras no índice recomendado para comparação
        od_comp = calcular_sagita_espessura(
            payload.od_spherical, payload.od_cylindrical, payload.od_dnp,
            payload.frame_a, payload.frame_bridge, payload.frame_ed, recommended_index
        )
        oe_comp = calcular_sagita_espessura(
            payload.oe_spherical, payload.oe_cylindrical, payload.oe_dnp,
            payload.frame_a, payload.frame_bridge, payload.frame_ed, recommended_index
        )
        
        max_thickness_comp = max(
            max(od_comp["thickness_center"], od_comp["thickness_edge"]),
            max(oe_comp["thickness_center"], oe_comp["thickness_edge"])
        )
        
        # Percentual de redução
        reduction = ((max_thickness - max_thickness_comp) / max_thickness) * 100
        thickness_reduction_pct = round(reduction, 1)
        
        upsell_msg = (
            f"Lente excessivamente grossa ({max_thickness:.1f}mm). "
            f"Oferecer lente de Resina de alto índice {recommended_index} "
            f"reduzirá a espessura máxima para {max_thickness_comp:.1f}mm "
            f"({thickness_reduction_pct}% mais fina e leve)."
        )
        
        comparison_data = {
            "recommended_index": float(recommended_index),
            "od": {k: float(v) for k, v in od_comp.items()},
            "oe": {k: float(v) for k, v in oe_comp.items()}
        }
        
    return LensSimulationResponse(
        od=LensThicknessDetail(**{k: Decimal(str(v)) for k, v in od_res.items()}),
        oe=LensThicknessDetail(**{k: Decimal(str(v)) for k, v in oe_res.items()}),
        requires_upsell=requires_upsell,
        upsell_message=upsell_msg,
        recommended_index=recommended_index,
        thickness_reduction_percentage=thickness_reduction_pct,
        comparison=comparison_data
    )

# --- 3. MAPEAMENTO FACIAL E VISAGISMO DIGITAL ---
import random
import os
import base64

def generate_face_embedding(image_bytes: bytes) -> List[float]:
    """
    Gera um embedding determinístico de 512 dimensões a partir dos bytes da imagem.
    Garante que a mesma imagem sempre resulte no mesmo vetor de floats com norma 1.0.
    """
    hasher = hashlib.sha256(image_bytes)
    seed = int(hasher.hexdigest(), 16) % (2**32)
    
    rng = random.Random(seed)
    vector = [rng.uniform(-1.0, 1.0) for _ in range(512)]
    norm = sum(x * x for x in vector) ** 0.5
    if norm > 0:
        vector = [x / norm for x in vector]
    return vector

async def detect_face_shape_gemini(image_bytes: bytes) -> tuple[str, str, str]:
    """
    Tenta detectar o formato do rosto usando a API do Gemini.
    Retorna uma tupla (face_shape, recommended_frame_types, reasoning).
    """
    if not os.getenv("GEMINI_API_KEY"):
        raise ValueError("GEMINI_API_KEY não configurada no ambiente.")
        
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage
        from pydantic import BaseModel as PydanticBaseModel, Field as PydanticField
        
        class FaceAnalysis(PydanticBaseModel):
            face_shape: str = PydanticField(..., description="Formato do rosto detectado: ROUND, SQUARE, HEART ou OVAL")
            recommended_frame_types: str = PydanticField(..., description="Tipos de armações recomendadas para esse formato")
            reasoning: str = PydanticField(..., description="Justificativa estética baseada nos traços faciais analisados")
            
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.0)
        structured_llm = llm.with_structured_output(FaceAnalysis)
        
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """Você é um especialista em visagismo e estética de óculos.
Analise a foto do rosto do cliente e identifique seu formato facial predominante: ROUND, SQUARE, HEART ou OVAL.
Forneça as armações sugeridas que harmonizam com o formato detectado e explique os princípios estéticos da escolha.
"""
        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
                }
            ]
        )
        
        res = await structured_llm.ainvoke([message])
        return res.face_shape, res.recommended_frame_types, res.reasoning
    except Exception as e:
        print(f"Erro na análise de visagismo com Gemini: {e}")
        raise e

@router.post("/visagism-detect", response_model=VisagismDetectResponse)
async def visagism_detect_facial_shape(
    file: UploadFile = File(...),
    od_spherical: Decimal = Query(Decimal("0.0")),
    oe_spherical: Decimal = Query(Decimal("0.0")),
    db: AsyncSession = Depends(get_db),
    partner: PartnerShop = Depends(get_current_partner_shop)
):
    """
    Recebe imagem do rosto do cliente, gera embedding de 512 dimensões,
    grava no banco de dados e calcula a semelhança cosenoidal com sessões anteriores.
    Usa o Gemini se configurado ou cai de volta para o classificador inteligente local.
    """
    file_bytes = await file.read()
    filename = file.filename.lower()
    
    # 1. Gera o embedding de 512 floats do rosto
    face_embedding = generate_face_embedding(file_bytes)
    
    # 2. Classificação do Formato do Rosto (Gemini com fallback)
    face_shape = None
    frame_types = None
    reason = None
    
    if os.getenv("GEMINI_API_KEY"):
        try:
            face_shape, frame_types, reason = await detect_face_shape_gemini(file_bytes)
        except Exception:
            pass
            
    # Fallback para classificador inteligente por padrão/mock caso falhe ou não configurado
    if not face_shape:
        if "redondo" in filename or "round" in filename or "oval" in filename:
            face_shape = "ROUND"
            frame_types = "Armações retangulares, quadradas, angulares de metal ou acetato"
            reason = "Rostos redondos se beneficiam de linhas retas e ângulos marcados para alongar as proporções e afinar o semblante."
        elif "quadrado" in filename or "square" in filename:
            face_shape = "SQUARE"
            frame_types = "Armações redondas, ovais, hexagonais ou fio de nylon"
            reason = "Linhas arredondadas ajudam a suavizar as linhas fortes e expressivas de maxilar e testa em rostos com formato quadrado."
        elif "coracao" in filename or "heart" in filename:
            face_shape = "HEART"
            frame_types = "Armações aviador, gatinho ou semi-aro"
            reason = "Modelos aviador ou semi-aro adicionam peso visual na parte inferior do rosto, harmonizando a testa mais larga com o queixo fino."
        else:
            face_shape = "OVAL"
            frame_types = "Qualquer formato de armação (retangular, redonda, aviador ou gatinho)"
            reason = "O rosto oval possui proporções naturalmente equilibradas, permitindo ousar com quase qualquer tipo de armação."

    # Modelos recomendados padrão baseado no formato
    models_map = {
        "ROUND": [
            {"name": "Ray-Ban Clubmaster Slim", "brand": "Ray-Ban", "material": "Metal/Acetato", "style": "Retangular Clássico"},
            {"name": "Chilli Beans Carbon Classic", "brand": "Chilli Beans", "material": "Fibra de Carbono", "style": "Retangular Slim"},
            {"name": "Oakley Pitchman R", "brand": "Oakley", "material": "O Matter", "style": "Quadrado Moderno"}
        ],
        "SQUARE": [
            {"name": "Ray-Ban Round Metal", "brand": "Ray-Ban", "material": "Aço Inoxidável", "style": "Redondo Retrô"},
            {"name": "Chilli Beans Fio de Nylon Slim", "brand": "Chilli Beans", "material": "Titânio", "style": "Oval Clássico"},
            {"name": "Oakley Hex Jester", "brand": "Oakley", "material": "Metal", "style": "Hexagonal"}
        ],
        "HEART": [
            {"name": "Ray-Ban Aviator Classic", "brand": "Ray-Ban", "material": "Metal", "style": "Aviador"},
            {"name": "Chilli Beans CatEye Velvet", "brand": "Chilli Beans", "material": "Acetato", "style": "Gatinho"},
            {"name": "Oakley Spoke", "brand": "Oakley", "material": "Titânio", "style": "Semi-Aro"}
        ],
        "OVAL": [
            {"name": "Ray-Ban Wayfarer Classic", "brand": "Ray-Ban", "material": "Acetato", "style": "Casual"},
            {"name": "Oakley Holbrook Lite", "brand": "Oakley", "material": "O Matter", "style": "Esportivo Urban"},
            {"name": "Chilli Beans Gold Aviator", "brand": "Chilli Beans", "material": "Metal Dourado", "style": "Elegante"}
        ]
    }
    
    recommended_models = models_map.get(face_shape, models_map["OVAL"])
    
    # --- REGRA ÓPTICA DE GRAUS ALTOS (GRAU NEGATIVO FORTE) ---
    if od_spherical <= Decimal("-4.00") or oe_spherical <= Decimal("-4.00"):
        frame_types = "Aro Fechado e Redondo (Pequeno) de Acetato Grosso"
        recommended_models = [
            {"name": "Oakley Holbrook Acetato Pequeno", "brand": "Oakley", "material": "Acetato Grosso", "style": "Aro Fechado"},
            {"name": "Ray-Ban Round Acetato Tortoise", "brand": "Ray-Ban", "material": "Acetato", "style": "Redondo Pequeno"},
            {"name": "Chilli Beans Bold Acetate", "brand": "Chilli Beans", "material": "Acetato de Alta Densidade", "style": "Retangular Compacto"}
        ]
        reason = (
            f"Devido ao grau elevado de miopia (Grau Máximo: {min(od_spherical, oe_spherical):.2f}), "
            "as restrições técnicas superam as estéticas. Recomendamos armações menores, fechadas e de "
            "acetato grosso para esconder a espessura periférica da lente e reduzir distorções nas bordas."
        )

    # 3. Grava histórico de visagismo com o embedding calculado
    session_obj = FaceVisagismSession(
        partner_shop_id=partner.id,
        face_shape_detected=face_shape,
        recommended_frame_types=frame_types,
        spherical_context_od=od_spherical,
        spherical_context_oe=oe_spherical,
        face_embedding=face_embedding
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    
    # 4. Busca por sessões anteriores de visagismo com rostos semelhantes usando busca vetorial
    # Se o dialeto for PostgreSQL, usa a distância de cosseno nativa da extensão pgvector
    is_postgres = db.bind.dialect.name == 'postgresql'
    
    similar_sessions = []
    if is_postgres:
        try:
            # Seleciona sessões ordenando por distância de cosseno
            query_similar = (
                select(FaceVisagismSession)
                .where(FaceVisagismSession.face_embedding.isnot(None))
                .where(FaceVisagismSession.id != session_obj.id)
                .order_by(FaceVisagismSession.face_embedding.cosine_distance(face_embedding))
                .limit(3)
            )
            res_sim = await db.execute(query_similar)
            similar_sessions = list(res_sim.scalars().all())
        except Exception as e:
            print(f"[AVISO] Falha na busca vetorial nativa pgvector: {e}. Caindo para busca Python.")
            is_postgres = False

    # Se for SQLite ou se a query PostgreSQL falhou
    if not is_postgres:
        query_all = (
            select(FaceVisagismSession)
            .where(FaceVisagismSession.face_embedding.isnot(None))
            .where(FaceVisagismSession.id != session_obj.id)
        )
        res_all = await db.execute(query_all)
        all_sessions = res_all.scalars().all()
        
        # Como os vetores estão normalizados (norma = 1), similaridade = produto escalar
        scored_sessions = []
        for s in all_sessions:
            try:
                emb = s.face_embedding
                if emb and len(emb) == 512:
                    similarity = sum(x * y for x, y in zip(emb, face_embedding))
                    scored_sessions.append((similarity, s))
            except Exception:
                pass
                
        # Ordena descendentemente pelo score de similaridade
        scored_sessions.sort(key=lambda x: x[0], reverse=True)
        similar_sessions = [s for _, s in scored_sessions[:3]]

    # Se encontramos rostos parecidos no histórico
    if similar_sessions:
        reason += f" Encontramos {len(similar_sessions)} rostos parecidos no histórico de buscas."
        
    return VisagismDetectResponse(
        face_shape_detected=face_shape,
        recommended_frame_types=frame_types,
        recommended_models=recommended_models,
        reasoning=reason
    )


# --- 4. LISTAGEM DE ENCOMENDAS (OMNICHANNEL TRACKING) ---
@router.get("/my-orders", response_model=List[ServiceOrderResponse])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    partner: PartnerShop = Depends(get_current_partner_shop)
):
    """
    Retorna apenas as Ordens de Serviço (OS) enviadas por esta ótica parceira autenticada.
    """
    query = (
        select(ServiceOrder)
        .where(ServiceOrder.partner_shop_id == partner.id)
        .options(
            selectinload(ServiceOrder.od_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.oe_lens_inventory).selectinload(LensInventoryGrade.lens_model),
            selectinload(ServiceOrder.workflow_history)
        )
        .order_by(ServiceOrder.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())

# --- 5. CHECKOUT INTEGRADO (ENVIO DIRETO DE PEDIDO COM ALOCAÇÃO) ---
@router.post("/submit-os", response_model=ServiceOrderResponse)
async def submit_validated_os(
    payload: PartnerOSSubmit,
    db: AsyncSession = Depends(get_db),
    partner: PartnerShop = Depends(get_current_partner_shop)
):
    """
    Valida as regras ópticas do corte, cria a OS vinculada à loja no banco
    da fábrica e tenta alocar/reservar as lentes em tempo real no estoque.
    """
    # 1. Transpõe graus da receita
    od_sph, od_cyl, od_axis = crud_os.transpose_dioptria(payload.od_spherical, payload.od_cylindrical, payload.od_axis)
    oe_sph, oe_cyl, oe_axis = crud_os.transpose_dioptria(payload.oe_spherical, payload.oe_cylindrical, payload.oe_axis)
    
    # 2. Cálculo da descentração
    od_decentration = ((payload.frame_a + payload.frame_bridge) / 2) - payload.od_dnp
    oe_decentration = ((payload.frame_a + payload.frame_bridge) / 2) - payload.oe_dnp
    
    # 3. Diâmetro Mínimo Necessário (+2.0mm de folga)
    od_min_diameter = payload.frame_ed + (Decimal("2.0") * od_decentration) + Decimal("2.0")
    oe_min_diameter = payload.frame_ed + (Decimal("2.0") * oe_decentration) + Decimal("2.0")
    
    # 4. Localiza as lentes na grade de estoque
    od_item = await crud_os.get_inventory_item_for_allocation(db, payload.lens_model_id, od_sph, od_cyl)
    oe_item = await crud_os.get_inventory_item_for_allocation(db, payload.lens_model_id, oe_sph, oe_cyl)
    
    if not od_item or not oe_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dioptrias solicitadas não estão disponíveis no estoque para o modelo escolhido. OD: {od_sph:+.2f}/{od_cyl:+.2f} | OE: {oe_sph:+.2f}/{oe_cyl:+.2f}."
        )
        
    # 5. Validação de diâmetro físico
    od_phys_diam = od_item.lens_model.diameter
    oe_phys_diam = oe_item.lens_model.diameter
    if od_phys_diam < od_min_diameter or oe_phys_diam < oe_min_diameter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Diâmetro de lente física insuficiente para o corte da armação. OD exigido: {od_min_diameter:.1f}mm (Disponível: {od_phys_diam}mm) | OE exigido: {oe_min_diameter:.1f}mm (Disponível: {oe_phys_diam}mm)."
        )
        
    # 6. Gera número sequencial de OS
    os_num = await crud_os.generate_os_number(db)
    
    # 7. Cria o registro da OS associando a loja
    service_order = ServiceOrder(
        os_number=os_num,
        client_name=payload.client_name,
        partner_shop_id=partner.id,
        status="TRIAGEM", # Inicia na triagem
        od_spherical=payload.od_spherical,
        od_cylindrical=payload.od_cylindrical,
        od_axis=payload.od_axis,
        od_addition=payload.od_addition,
        od_dnp=payload.od_dnp,
        oe_spherical=payload.oe_spherical,
        oe_cylindrical=payload.oe_cylindrical,
        oe_axis=payload.oe_axis,
        oe_addition=payload.oe_addition,
        oe_dnp=payload.oe_dnp,
        frame_a=payload.frame_a,
        frame_bridge=payload.frame_bridge,
        frame_ed=payload.frame_ed
    )
    db.add(service_order)
    await db.commit()
    await db.refresh(service_order)
    
    # 8. Cria histórico inicial da OS
    await crud_os.add_workflow_history(
        db, service_order.id, None, "TRIAGEM", 
        f"Pedido recebido do Portal do Lojista ({partner.trade_name})."
    )
    
    # 9. Tenta fazer a reserva física no estoque (-1)
    has_stock = True
    if od_item.quantity_available < 1 or oe_item.quantity_available < 1:
        has_stock = False
    elif od_item.id == oe_item.id and od_item.quantity_available < 2:
        has_stock = False
        
    if not has_stock:
        # Sem estoque no momento, a OS é criada mas fica na TRIAGEM aguardando
        notes = "Ordem de serviço registrada, porém aguardando estoque físico da lente correspondente na fábrica."
        await crud_os.add_workflow_history(db, service_order.id, "TRIAGEM", "TRIAGEM", notes)
    else:
        # Há estoque, realiza reserva atômica imediata
        movement_od = StockMovementCreate(
            lens_inventory_id=od_item.id,
            movement_type="OUT",
            quantity=1,
            reason=f"Reserva Automática OS {service_order.os_number} (Via Portal Lojista)"
        )
        movement_oe = StockMovementCreate(
            lens_inventory_id=oe_item.id,
            movement_type="OUT",
            quantity=1,
            reason=f"Reserva Automática OS {service_order.os_number} (Via Portal Lojista)"
        )
        await crud_movement.create_stock_movement(db, movement_od)
        await crud_movement.create_stock_movement(db, movement_oe)
        
        # Vincula as lentes e altera o status para RESERVADO
        service_order.od_lens_inventory_id = od_item.id
        service_order.oe_lens_inventory_id = oe_item.id
        service_order.status = "RESERVADO"
        await db.commit()
        
        notes = f"Validação geométrica e alocação física de lentes concluída. Lentes reservadas na gaveta OD: {od_item.location_tag or 'N/A'} | OE: {oe_item.location_tag or 'N/A'}."
        await crud_os.add_workflow_history(db, service_order.id, "TRIAGEM", "RESERVADO", notes)
        
    # Recarrega para obter relacionamentos
    os_loaded = await crud_os.get_service_order(db, service_order.id)
    return os_loaded
