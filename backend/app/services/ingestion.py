from pathlib import Path
from dataclasses import dataclass
from pypdf import PdfReader

from .embeddings import embed_texts
from ..store.chroma_store import ChromaStore
from ..store.mongo import stories

#--------Parser--------
def parse_text(path: Path) -> str: 
    return path.read_text(encoding = "utf-8")

def parse_pdf(path: Path) -> str: 
    reader = PdfReader(str(path)) 
    pages = [] 

    for page in reader.pages: 
        text = page.extract_text() 
        if text: 
            pages.append(text) 
    return  "\n\n".join(pages) 

def parse_file(path: Path) -> str:
    suffix = path.suffix.lower()

    if suffix in {".txt", ".md"}:
        return parse_text(path)
    if suffix == ".pdf":
        return parse_pdf(path)
    raise ValueError(f"Unsupported file type: {suffix}")
#-----------------------

#-------Chunking--------
@dataclass
class Chunk:
    id: str
    text: str
    char_start: int
    char_end: int

def chunk_text(text: str, size: int = 1000, overlap: int = 150, ) -> list[Chunk]:
    if size <= 0:
        raise ValueError("size must be greater than 0")

    if overlap < 0:
        raise ValueError("overlap cannot be negative")

    if overlap >= size:
        raise ValueError("overlap must be smaller than size")

    chunks = []
    step = size - overlap
    for start in range(0, len(text), step):
        end = min(start + size, len(text))
        chunk = Chunk(
            id=f"chunk_{len(chunks)}",
            text=text[start:end],
            char_start=start,
            char_end=end,
        )
        chunks.append(chunk)
        if end == len(text):
            break
    return chunks

#-----------------------


async def ingest_story(story_id: str, file_path: Path,) -> None:
    text = parse_file(file_path)
    if not text.strip():
        raise ValueError("File contains no extractable text")
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No chunks generated from file")

    documents = [chunk.text for chunk in chunks]
    embeddings = await embed_texts(documents)

    ids = [chunk.id for chunk in chunks]

    metadatas = [
        {
            "story_id": story_id,
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
        }
        for chunk in chunks
    ]

    store = ChromaStore()
    store.add_chunks(
        story_id=story_id,
        ids=ids,
        docs=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )

    await stories().update_one(
        {"_id": story_id},
        {"$set": {"status": "ingested", "n_chunks": len(chunks)}},
    )