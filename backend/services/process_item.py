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


VISION_SCHEMA_SPEC = '''
{
  "type": "string or empty",
  "category": "one of: top, bottom, shoes, outerwear, accessory, dress, traditional_set",
  "primaryColor": "string or empty",
  "secondaryColor": "string or empty",
  "colorUndertone": "warm | cool | neutral",
  "pattern": "string or empty",
  "material": "string or empty",
  "fit": "string or empty",
  "formality": 0-10 number,
  "season": "one of: spring, summer, fall, winter, all",
  "styleTags": ["string"],
  "keyDetails": ["string"],
  "pairingHints": ["string"],
  "confidence": 0-100 number
}
'''


def generate_item_profile_from_vision(clean_url: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Call OpenAI Vision to generate ItemProfile. Returns (profile_dict, error_msg).
    Uses response_format=json_object for strict JSON. Non-clothing images get low confidence + safe defaults.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None, "openai package not installed"

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY not set"

    client = OpenAI(api_key=api_key)

    system_prompt = """You are a fashion metadata extractor. Return ONLY a JSON object. No markdown, no explanations, no prose.
If the image is not a clothing item, use category "top", type "unknown", confidence 10, and empty strings for colors.
Use empty string "" or null for unknown fields. Arrays use [] when empty.
Schema (exact keys):
""" + VISION_SCHEMA_SPEC.strip()

    user_prompt = "Return a JSON object with the exact schema above for this image:"

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
            max_tokens=500,
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


def process_item(user_id: str, raw_key: str, raw_url: str) -> dict:
    """
    Full pipeline: fetch → rembg → upload clean → vision → return result.
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

    # d) Vision
    profile_dict, err = generate_item_profile_from_vision(clean_url)
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
