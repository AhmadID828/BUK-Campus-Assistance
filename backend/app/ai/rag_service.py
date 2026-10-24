import logging
from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.ai.llm_service import get_embedding, semantic_embeddings_enabled


CHROMA_PATH = Path(__file__).resolve().parents[2] / "chroma_db"
logger = logging.getLogger(__name__)


class OllamaEmbeddings:
    """LangChain-compatible embeddings backed by the local Ollama model."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [get_embedding(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return get_embedding(text)


class RAGService:
    """Store and retrieve chunks from a student's uploaded study materials."""

    def __init__(self) -> None:
        self._embeddings = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=400,
            chunk_overlap=30,
        )

    @property
    def embeddings(self) -> OllamaEmbeddings:
        if self._embeddings is None:
            self._embeddings = OllamaEmbeddings()
        return self._embeddings

    def get_user_vectorstore(self, user_id: int) -> Chroma:
        user_path = CHROMA_PATH / f"user_{user_id}"
        user_path.mkdir(parents=True, exist_ok=True)

        return Chroma(
            collection_name=f"study_materials_user_{user_id}_nomic",
            persist_directory=str(user_path),
            embedding_function=self.embeddings,
        )

    def add_material(
        self,
        user_id: int,
        material_id: int,
        title: str,
        content: str,
        subject: str = "",
    ) -> None:
        """Split and index one StudyMaterial for its owner."""
        if not content or not content.strip():
            return

        vectorstore = self.get_user_vectorstore(user_id)
        chunks = self.text_splitter.split_text(content)
        documents = [
            Document(
                page_content=chunk,
                metadata={
                    "material_id": material_id,
                    "title": title,
                    "subject": subject,
                    "chunk": index,
                },
            )
            for index, chunk in enumerate(chunks)
            if chunk.strip()
        ]

        if documents:
            ids = [f"material-{material_id}-chunk-{index}" for index in range(len(documents))]
            vectorstore.add_documents(documents, ids=ids)

    def search(self, user_id: int, query: str, k: int = 4) -> str:
        """Return relevant study-material chunks as prompt-ready context."""
        context, _ = self.search_with_sources(user_id, query, k)
        return context

    def search_with_sources(
        self,
        user_id: int,
        query: str,
        k: int = 4,
    ) -> tuple[str, list[dict[str, str]]]:
        """Return retrieved context and compact source metadata."""
        if not query or not query.strip():
            return "No relevant study materials found.", []
        if not semantic_embeddings_enabled():
            return "No semantic study-material matches are available.", []

        try:
            results = self.get_user_vectorstore(user_id).similarity_search(query, k=k)
        except Exception as exc:
            logger.warning(
                "Semantic study-material retrieval is unavailable for user %s: %s",
                user_id,
                exc,
            )
            return (
                "No semantic study-material matches are available.",
                [],
            )

        if not results:
            return "No relevant study materials found.", []

        context_parts = []
        sources = []
        for document in results:
            title = document.metadata.get("title") or "Unknown material"
            subject = document.metadata.get("subject") or ""
            label = f"{title} ({subject})" if subject else title
            excerpt = document.page_content.strip()
            excerpt = excerpt.replace("<b>", "").replace("</b>", "")
            context_parts.append(f"From: {label}\n{excerpt}")
            sources.append({
                "type": "study_material",
                "title": str(title),
                "subject": str(subject),
                "excerpt": excerpt[:320],
            })

        return "\n\n".join(context_parts), sources

    def delete_material(self, user_id: int, material_id: int) -> None:
        """Remove all indexed chunks for one student's material."""
        vectorstore = self.get_user_vectorstore(user_id)
        vectorstore.delete(where={"material_id": material_id})


rag_service = RAGService()
