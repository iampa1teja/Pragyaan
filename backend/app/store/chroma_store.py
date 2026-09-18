import chromadb 
from ..core.config import get_settings 

class ChromaStore: 

    def __init__(self, path: str | None = None): 
        settings = get_settings() 
        self.path = path or settings.chroma_path
        self.client = chromadb.PersistentClient(path=self.path) 

    def collection(self, story_id: str):
        name = f"story_{story_id}"
        return self.client.get_or_create_collection(name=name)

    def add_chunks(self, story_id: str, ids: list[str], docs: list[str], metadatas: list[dict], embeddings: list[list[float]],):
        collection = self.collection(story_id)

        collection.add(
            ids=ids,
            documents=docs,
            metadatas=metadatas,
            embeddings=embeddings,
        )

    def query(self, story_id: str, query_embedding: list[float], k: int = 5):
        collection = self.collection(story_id)
        result = collection.query(query_embeddings = [query_embedding], n_results = k)

        output = []
        for i, chunk_id in enumerate(result["ids"][0]):
            output.append({
                "id": chunk_id,
                "document": result["documents"][0][i],
                "metadata": result["metadatas"][0][i],
                "distance": result["distances"][0][i],
            })

        return output

    def delete(self, story_id: str):
        name = f"story_{story_id}"
        try: 
            self.client.delete_collection(name=name)
        except Exception:
            pass 
    