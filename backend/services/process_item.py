# Python process-item service (Phase 2B)
from __future__ import annotations

import os
import json
import time
import uuid
from io import BytesIO
from typing import Tuple, Optional


class VisionFailedError(Exception):
    """Raised when Vision step fails; caller should return HTTP 502."""

import requests
from PIL import Image

# Lazy imports for heavy deps (rembg, boto3, openai)
_rembg_remove = None
_boto3_client = None


def _get_rembg():
    global _rembg_remove
    if _rembg_remove is None:
        from rembg import remove as _remove
        _rembg_remove = _remove
    return _rembg_remove


MAX_RAW_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = ("image/jpeg", "image/jpg", "image/png", "image/webp")
CLEAN_PREFIX = (os.getenv("CLEAN_R2_PREFIX", "clean/")).rstrip("/") + "/"


def fetch_raw(raw_url: str) -> Tuple[bytes, str, Optional[str]]:
    """
    Fetch raw image from URL. Returns (bytes, content_type, error_msg).
    """
    try:
        resp = requests.get(raw_url, timeout=30, stream=True)
        resp.raise_for_status()

        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            return b"", "", f"Invalid content-type: {content_type}"

        if content_type not in ALLOWED_CONTENT_TYPES:
            return b"", "", f"Unsupported image type: {content_type}"

        data = resp.content
        if len(data) > MAX_RAW_SIZE:
            return b"", "", f"Image exceeds 5MB limit ({len(data)} bytes)"

        return data, content_type, None
    except requests.RequestException as e:
        return b"", "", str(e)


def run_rembg(image_bytes: bytes, content_type: str) -> Tuple[bytes, Optional[str]]:
    """
    Run background removal. Returns (png_bytes, error_msg).
    Output is PNG with transparent background.
    """
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGBA")
        remove_fn = _get_rembg()
        out = remove_fn(img)

        buf = BytesIO()
        out.save(buf, format="PNG")
        return buf.getvalue(), None
    except Exception as e:
        return b"", str(e)


def upload_clean_to_r2(
    png_bytes: bytes,
    user_id: str,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Upload cleaned PNG to R2. Returns (clean_key, error_msg).
    Key format: clean/<userId>/<timestamp>_<random>.png
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        return None, "boto3 not installed"

    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket = os.getenv("R2_BUCKET")
    public_base = (os.getenv("R2_PUBLIC_BASE_URL") or "").rstrip("/")

    if not all([account_id, access_key, secret_key, bucket, public_base]):
        return None, "R2 config missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL"

    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    safe_user = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(user_id)[:64]) or "anon"
    key = f"{CLEAN_PREFIX}{safe_user}/{int(time.time() * 1000)}_{uuid.uuid4().hex[:12]}.png"

    try:
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name="auto",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
        )
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=png_bytes,
            ContentType="image/png",
        )
        clean_url = f"{public_base}/{key}"
        return key, None
    except Exception as e:
        return None, str(e)


VISION_SCHEMA_SPEC = '''{
  "type": "concise clothing name, 1-3 words, e.g. 't-shirt', 'jeans', 'pullover hoodie'",
  "category": "one of: top, bottom, shoes, outerwear, accessory, dress, traditional_set",
  "primaryColor": "standard color name, e.g. 'Black', 'Navy Blue', 'Heather Grey', 'Off White'",
  "secondaryColor": "standard color name or null",
  "colorUndertone": "warm | cool | neutral | null",
  "pattern": "e.g. 'solid', 'striped', 'plaid', 'floral', 'graphic' or null",
  "material": "e.g. 'cotton', 'denim', 'polyester', 'linen', 'fleece' or null",
  "fit": "e.g. 'slim fit', 'regular fit', 'relaxed fit', 'oversized', 'straight leg' or null",
  "formality": "0-10 number (0=athletic, 5=casual, 8=smart-casual, 10=formal)",
  "season": "one of: spring, summer, fall, winter, all",
  "styleTags": ["e.g. 'streetwear', 'minimalist', 'preppy', 'casual'"],
  "keyDetails": ["specific observable details, e.g. 'crew neck', 'long sleeve', 'kangaroo pocket', 'straight leg'"],
  "pairingHints": ["e.g. 'pairs well with chinos', 'wear with white sneakers'"],
  "confidence": "0-100 integer (80-100 for clear clothing, 10 for non-clothing)"
}'''

# Per-type extraction guidance for Phase 1 supported categories
_TYPE_HINTS: dict = {
    "shirt": {
        "category": "top",
        "type_examples": '"dress shirt", "casual shirt", "button-up shirt", "Oxford shirt", "flannel shirt", "linen shirt", "chambray shirt"',
        "key_details_hint": (
            "collar style (e.g. 'spread collar', 'button-down collar', 'mandarin collar'), "
            "sleeve length ('long-sleeve' or 'short-sleeve'), "
            "closure ('button-front'), and notable surface details"
        ),
        "fit_hint": '"slim fit", "regular fit", "relaxed fit", "oversized"',
    },
    "tshirt": {
        "category": "top",
        "type_examples": '"t-shirt", "graphic tee", "polo shirt", "baseball tee", "henley", "pocket tee"',
        "key_details_hint": (
            "neckline ('crew neck', 'v-neck', 'scoop neck', 'polo collar'), "
            "sleeve length ('short-sleeve', 'long-sleeve', 'sleeveless'), "
            "and any visible graphic, logo, or print"
        ),
        "fit_hint": '"slim fit", "regular fit", "oversized", "cropped"',
    },
    "hoodie": {
        "category": "top",
        "type_examples": '"pullover hoodie", "zip-up hoodie", "oversized hoodie", "cropped hoodie"',
        "key_details_hint": (
            "closure style ('pullover' or 'zip-up'), "
            "pocket style ('kangaroo pocket' or 'no pocket'), "
            "drawstring presence, and any visible graphic or embroidery"
        ),
        "fit_hint": '"regular fit", "oversized", "slim fit", "cropped"',
    },
    "pant": {
        "category": "bottom",
        "type_examples": '"jeans", "chinos", "sweatpants", "trousers", "cargo pants", "joggers", "shorts", "leggings"',
        "key_details_hint": (
            "leg fit ('straight leg', 'slim leg', 'wide leg', 'tapered', 'flared'), "
            "rise ('high-rise', 'mid-rise', 'low-rise'), "
            "length ('full-length', 'ankle-length', 'cropped', 'shorts'), "
            "and visible hardware or pockets"
        ),
        "fit_hint": '"straight fit", "slim fit", "relaxed fit", "wide leg", "tapered"',
    },
}


def _build_vision_prompts(clothing_type: Optional[str]) -> Tuple[str, str]:
    """
    Build (system_prompt, user_prompt) for Vision call.
    When clothing_type is provided, injects type-aware guidance so the model
    knows the category up-front and returns concrete, specific field values.
    """
    hint = _TYPE_HINTS.get(clothing_type or "")

    # Base rules applied to every call
    base_rules = (
        "You are a fashion metadata extractor. "
        "Return ONLY a valid JSON object matching the exact schema below. "
        "No markdown, no prose, no explanation.\n\n"
        "Rules:\n"
        "- Use null for unknown or not-visible fields (not empty string).\n"
        "- Arrays use [] when empty.\n"
        '- "type": must be a specific, concise clothing name (1-3 words). Never return "unknown" for a real garment.\n'
        '- "primaryColor": use a standard color name (e.g. "Black", "Navy Blue", "Off White", "Heather Grey"). Never return "unknown".\n'
        '- "confidence": 80-100 for clear clothing; 10 for non-clothing images.\n'
        "- Non-clothing image: set category \"top\", type \"unknown\", confidence 10, null colors.\n"
    )

    if hint:
        type_section = (
            f'\nThis item has been identified by the user as a "{clothing_type}". '
            f'Use these type-specific guidelines:\n'
            f'- "category" MUST be "{hint["category"]}"\n'
            f'- "type" must be one of: {hint["type_examples"]}\n'
            f'- "fit" examples: {hint["fit_hint"]}\n'
            f'- "keyDetails" MUST include: {hint["key_details_hint"]}\n'
        )
        label_map = {"shirt": "shirt", "tshirt": "t-shirt", "hoodie": "hoodie", "pant": "pants"}
        user_label = label_map.get(clothing_type or "", clothing_type or "clothing item")
        user_prompt = f"This is a {user_label}. Return a JSON object with the exact schema for this image:"
    else:
        type_section = ""
        user_prompt = "Return a JSON object with the exact schema above for this image:"

    system_prompt = base_rules + type_section + "\nSchema (exact keys):\n" + VISION_SCHEMA_SPEC
    return system_prompt, user_prompt


def generate_item_profile_from_vision(
    clean_url: str,
    clothing_type: Optional[str] = None,
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Call OpenAI Vision to generate ItemProfile. Returns (profile_dict, error_msg).
    Uses response_format=json_object for strict JSON. Non-clothing images get low confidence + safe defaults.
    clothing_type (optional): user-selected type ("shirt", "tshirt", "hoodie", "pant") used for type-aware prompting.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None, "openai package not installed"

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY not set"

    client = OpenAI(api_key=api_key)

    system_prompt, user_prompt = _build_vision_prompts(clothing_type)

    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": clean_url}},
                    ],
                },
            ],
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return None, "Empty Vision response"

        data = json.loads(text)

        # Ensure arrays exist
        for k in ("styleTags", "keyDetails", "pairingHints"):
            if k not in data or not isinstance(data[k], list):
                data[k] = []

        return data, None
    except json.JSONDecodeError as e:
        try:
            raw = text  # text assigned before json.loads
        except NameError:
            raw = ""
        preview = (raw[:200] + "...") if raw and len(raw) > 200 else (raw or "")
        return None, f"Invalid JSON from Vision: {e}. Preview: {preview!r}"
    except Exception as e:
        return None, str(e)


def process_item(user_id: str, raw_key: str, raw_url: str, clothing_type: Optional[str] = None) -> dict:
    """
    Full pipeline: fetch → rembg → upload clean → vision → return result.
    clothing_type: user-selected type ("shirt", "tshirt", "hoodie", "pant") forwarded to Vision for type-aware prompting.
    """
    # a) Fetch
    raw_bytes, content_type, err = fetch_raw(raw_url)
    if err:
        return {
            "status": "failed",
            "cleanKey": None,
            "cleanUrl": None,
            "profile": None,
            "failReason": f"Fetch failed: {err}",
        }

    # b) rembg
    png_bytes, err = run_rembg(raw_bytes, content_type)
    if err:
        return {
            "status": "failed",
            "cleanKey": None,
            "cleanUrl": None,
            "profile": None,
            "failReason": f"Background removal failed: {err}",
        }

    # c) Upload clean to R2
    clean_key, err = upload_clean_to_r2(png_bytes, user_id)
    if err:
        return {
            "status": "failed",
            "cleanKey": None,
            "cleanUrl": None,
            "profile": None,
            "failReason": f"R2 upload failed: {err}",
        }

    public_base = (os.getenv("R2_PUBLIC_BASE_URL") or "").rstrip("/")
    clean_url = f"{public_base}/{clean_key}"

    # d) Vision (type-aware when clothing_type is provided)
    profile_dict, err = generate_item_profile_from_vision(clean_url, clothing_type=clothing_type)
    if err:
        raise VisionFailedError(f"Vision failed: {err}")

    # e) Validate and return locked ItemProfile (raw schema for Node to store)
    from schemas.models import ItemProfile
    try:
        profile = ItemProfile.model_validate(profile_dict)
        raw_profile = profile.model_dump(exclude_none=False)  # full locked schema
    except Exception as e:
        raise VisionFailedError(f"ItemProfile validation failed: {e}")

    return {
        "status": "ready",
        "cleanKey": clean_key,
        "cleanUrl": clean_url,
        "profile": raw_profile,
        "failReason": None,
    }
