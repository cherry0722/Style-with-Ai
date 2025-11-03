# ai/embeddings.py
from typing import List
from sentence_transformers import SentenceTransformer

# e5-small-v2 is a good small embedding model
_EMBED_MODEL_NAME = "intfloat/e5-small-v2"
_embedder = SentenceTransformer(_EMBED_MODEL_NAME)


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of document texts (wardrobe descriptions, style rules).
    Uses 'passage:' prefix as recommended for e5.
    """
    texts_proc = [f"passage: {t.strip()}" for t in texts]
    vecs = _embedder.encode(texts_proc, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


def embed_query(text: str) -> List[float]:
    """
    Embed a query text (user question).
    Uses 'query:' prefix for e5.
    """
    q = f"query: {text.strip()}"
    vec = _embedder.encode([q], normalize_embeddings=True)[0]
    return vec.tolist()
