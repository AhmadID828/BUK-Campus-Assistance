import html
import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()
OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    os.getenv("OLLAMA_BASE", "http://localhost:11434"),
).rstrip("/")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
GROQ_EMBED_MODEL = ""
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")
OLLAMA_QUIZ_MODEL = os.getenv("OLLAMA_QUIZ_MODEL", OLLAMA_MODEL)
OLLAMA_EMBED_MODEL = os.getenv(
    "OLLAMA_EMBED_MODEL",
    os.getenv("EMBED_MODEL", "nomic-embed-text"),
).strip()
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")


def get_embedding_provider() -> str:
    return (os.getenv("LLM_PROVIDER", LLM_PROVIDER) or LLM_PROVIDER).strip().lower()


def semantic_embeddings_enabled() -> bool:
    return get_embedding_provider() == "ollama"


def _post_json(
    url: str,
    payload: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 240.0,
) -> dict[str, Any]:
    response = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    if (
        response.status_code == 400
        and url == "https://api.groq.com/openai/v1/chat/completions"
        and payload.get("response_format") == {"type": "json_object"}
    ):
        try:
            error_payload = response.json().get("error")
            provider_message = (
                error_payload.get("message") if isinstance(error_payload, dict) else error_payload
            )
        except (ValueError, AttributeError):
            provider_message = None

        if isinstance(provider_message, str) and "failed to generate json" in provider_message.lower():
            fallback_payload = dict(payload)
            fallback_payload.pop("response_format", None)
            messages = fallback_payload.get("messages")
            if isinstance(messages, list) and messages and isinstance(messages[0], dict):
                fallback_payload["messages"] = [
                    {
                        **messages[0],
                        "content": (
                            f"{messages[0].get('content', '')}\n\n"
                            "Return syntactically valid JSON only. Do not include Markdown "
                            "or any text before or after the JSON object."
                        ),
                    },
                    *messages[1:],
                ]
            response = httpx.post(
                url,
                headers=headers,
                json=fallback_payload,
                timeout=timeout,
            )

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            error_payload = response.json().get("error")
        except (ValueError, AttributeError):
            error_payload = None

        if isinstance(error_payload, dict):
            provider_message = error_payload.get("message")
        elif isinstance(error_payload, str):
            provider_message = error_payload
        else:
            provider_message = None
        if not isinstance(provider_message, str) or not provider_message.strip():
            provider_message = response.reason_phrase
        raise RuntimeError(
            f"AI provider request failed (HTTP {response.status_code}): "
            f"{provider_message[:300]}"
        ) from exc

    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("LLM provider returned an invalid response")
    return data


def get_embedding(text: str) -> list[float]:
    """Return an embedding from the configured provider or fail with a clear message."""
    selected_provider = (os.getenv("LLM_PROVIDER", LLM_PROVIDER) or LLM_PROVIDER).strip().lower()

    if selected_provider == "groq":
        if not GROQ_EMBED_MODEL:
            raise RuntimeError(
                "Semantic embeddings are disabled for Groq. Use PostgreSQL full-text search."
            )
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is required to generate embeddings in this environment.")

        data = _post_json(
            "https://api.groq.com/openai/v1/embeddings",
            {"model": GROQ_EMBED_MODEL, "input": text},
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=45.0,
        )
        embedding = data.get("data")
        if isinstance(embedding, list) and embedding:
            first = embedding[0]
            if isinstance(first, dict):
                values = first.get("embedding")
                if isinstance(values, list):
                    return [float(value) for value in values]
        raise RuntimeError("Groq returned an invalid embedding payload")

    if not OLLAMA_BASE_URL:
        raise RuntimeError(
            "No embedding provider is configured. Set LLM_PROVIDER=groq with GROQ_API_KEY or run Ollama locally."
        )

    data = _post_json(
        f"{OLLAMA_BASE_URL}/api/embeddings",
        {"model": OLLAMA_EMBED_MODEL, "prompt": text},
        timeout=45.0,
    )
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or not all(
        isinstance(value, (int, float)) for value in embedding
    ):
        raise RuntimeError("Ollama returned an invalid embedding")
    return [float(value) for value in embedding]


def clean_model_response(content: str) -> str:
    """Remove reasoning blocks that some local models include in their output."""
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<think>.*$", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = cleaned.replace("</think>", "")
    return cleaned.strip()


def extract_final_answer(content: str) -> str:
    """Extract the final answer from model output that includes reasoning labels."""
    cleaned = clean_model_response(content)
    match = re.search(r"(?is)(?:final answer|answer)\s*[:\-]\s*(.+)", cleaned)
    if match:
        return match.group(1).strip()
    return cleaned


def clean_chat_response(content: str) -> str:
    """Render occasional HTML-like model output as readable plain text."""
    cleaned = re.sub(
        r"(?i)<br\s*/?\s*>",
        "\n",
        content,
    )
    cleaned = re.sub(
        r"(?i)</(?:p|div|li|h[1-6])\s*>",
        "\n\n",
        cleaned,
    )
    cleaned = re.sub(
        r"(?i)<(?:p|div|li|h[1-6])(?:\s[^<>]*)?>",
        "",
        cleaned,
    )
    cleaned = re.sub(r"</?[a-z][a-z0-9]*(?:\s[^<>]*)?/?>", "", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", cleaned)
    return cleaned.strip()


def generate_answer(
    prompt: str,
    max_tokens: int = 160,
    *,
    model: str | None = None,
    timeout: float = 240.0,
    response_format: str | None = None,
    provider: str | None = None,
    num_ctx: int = 2048,
) -> str:
    """Generate a completion using the configured LLM provider."""
    selected_provider = (provider or LLM_PROVIDER).strip().lower()
    if selected_provider == "groq":
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is required when LLM_PROVIDER=groq")

        groq_payload: dict[str, Any] = {
            "model": model or GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_completion_tokens": max(max_tokens, 512),
            "temperature": 0.3,
            "reasoning_effort": "low",
            "reasoning_format": "hidden",
        }
        if response_format == "json":
            groq_payload["response_format"] = {"type": "json_object"}

        data = _post_json(
            "https://api.groq.com/openai/v1/chat/completions",
            groq_payload,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        choices = data.get("choices")
        first_choice = choices[0] if isinstance(choices, list) and choices else None
        message_data = first_choice.get("message") if isinstance(first_choice, dict) else None
        content = message_data.get("content") if isinstance(message_data, dict) else None
        finish_reason = first_choice.get("finish_reason") if isinstance(first_choice, dict) else None
    else:
        ollama_model = model or OLLAMA_MODEL
        ollama_prompt = prompt
        if ollama_model.lower().startswith("qwen3") and not response_format:
            ollama_prompt = f"/no_think\n{prompt}"
        data = _post_json(
            f"{OLLAMA_BASE_URL}/api/generate",
            {
                "model": ollama_model,
                "prompt": ollama_prompt,
                "stream": False,
                "keep_alive": OLLAMA_KEEP_ALIVE,
                "think": False,
                **({"format": response_format} if response_format else {}),
                "options": {
                    "temperature": 0.2,
                    "num_predict": min(max_tokens, 1200),
                    "num_ctx": num_ctx,
                    "num_thread": 4,
                    "top_k": 20,
                    "top_p": 0.9,
                },
            },
            timeout=timeout,
        )
        content = data.get("response")
        finish_reason = None

    if not isinstance(content, str) or not content.strip():
        if selected_provider == "groq" and isinstance(finish_reason, str):
            raise RuntimeError(
                f"Groq returned no answer text (finish reason: {finish_reason})"
            )
        raise RuntimeError("LLM provider returned an empty response")
    cleaned_content = clean_model_response(content)
    if selected_provider == "ollama" and response_format is None:
        cleaned_content = extract_final_answer(cleaned_content) #type:ignore
    if not cleaned_content:
        raise RuntimeError("LLM provider returned only internal reasoning")
    return cleaned_content


class LLMService:
    def __init__(self) -> None:
        self.conversations: dict[str, list[dict[str, str]]] = {}

    def get_response(
        self,
        user_id: str,
        message: str,
        temperature: float = 0.7,
        provider: str | None = None,
        model: str | None = None,
        max_tokens: int = 256,
    ) -> str:
        del temperature
        history = self.conversations.get(user_id, [])[-2:]
        history = [
            {"role": item["role"], "content": item["content"][-200:]}
            for item in history
        ]

        system_prompt = """You are the BUK Campus Assistant System. Answer accurately, follow the request's scope and style, and keep answers concise unless asked for detail. If unsure about current BUK-specific information, advise checking the official portal. Return a plain-text answer without JSON or Markdown formatting."""
        current_message = {"role": "user", "content": message}
        conversation = "\n\n".join(
            f"{item['role'].title()}: {item['content']}"
            for item in [*history, current_message]
        )

        response = generate_answer(
            f"{system_prompt}\n\n{conversation}",
            max_tokens=max_tokens,
            provider=provider,
            model=model,
            timeout=240.0,
            num_ctx=1024,
        )

        answer = response
        try:
            response_data = json.loads(response)
        except json.JSONDecodeError:
            response_data = None
        if isinstance(response_data, dict) and isinstance(response_data.get("answer"), str):
            answer = response_data["answer"]
        if not isinstance(answer, str) or not answer.strip():
            raise RuntimeError("AI provider returned an empty chat answer")
        answer = clean_chat_response(answer)
        if not answer:
            raise RuntimeError("AI provider returned no readable chat answer")

        self.conversations[user_id] = [*history, current_message, {
            "role": "assistant",
            "content": answer.strip(),
        }][-3:]
        return answer.strip()


llm_service = LLMService()
