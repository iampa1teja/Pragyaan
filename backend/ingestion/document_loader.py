import os
from pathlib import Path
from docx import Document
from pypdf import PdfReader
from ingestion.text_cleaner import clean_text
from ingestion.chunker import chunk_text
from rag.vector_store import add_chunks

def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == ".docx":
        doc = Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    elif suffix == ".pdf":
        reader = PdfReader(file_path)
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        return "\n".join(pages_text)
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

def process_and_index_document(file_path: str, collection_name: str = "story"):
    text = extract_text_from_file(file_path)
    cleaned = clean_text(text)
    chunks = chunk_text(cleaned)
    if chunks:
        add_chunks(chunks, collection_name=collection_name)
    return cleaned, chunks