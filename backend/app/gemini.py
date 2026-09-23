import logging
import os

import httpx
from groq import Groq

logger = logging.getLogger(__name__)

# httpx client with SSL verification disabled — required on Windows where the
# system CA bundle is incomplete and blocks HTTPS to api.groq.com
_http_client = httpx.Client(verify=False)


class GeminiService:
    """AI generation service backed by Groq (llama-3.3-70b-versatile)."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model_name = model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self._client: Groq | None = (
            Groq(api_key=self.api_key, http_client=_http_client)
            if self.api_key else None
        )

    @property
    def available(self) -> bool:
        return self._client is not None

    async def generate(self, prompt: str) -> str | None:
        if not self._client:
            return None
        try:
            response = self._client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1024,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("Groq generation error: %s", e)
            return None
