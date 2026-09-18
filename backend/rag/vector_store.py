import chromadb

from rag.embeddings import get_embedding_function


CHROMA_PATH = "chroma_db"

# Create persistent ChromaDB client
client = chromadb.PersistentClient(
    path=CHROMA_PATH
)

# Get embedding function
embedding_function = get_embedding_function()


def get_collection(collection_name="story"):
    """
    Create or retrieve a ChromaDB collection.
    """

    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_function
    )

    return collection


def add_chunks(chunks, collection_name="story"):
    """
    Store text chunks in ChromaDB.
    """

    collection = get_collection(collection_name)

    ids = [
        f"chunk_{i}"
        for i in range(len(chunks))
    ]

    collection.upsert(
        documents=chunks,
        ids=ids
    )

    print(f"Stored {len(chunks)} chunks in ChromaDB.")

    return collection


def search_chunks(query, collection_name="story", n_results=3):
    """
    Search for chunks semantically related to the query.
    """

    collection = get_collection(collection_name)

    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )

    return results["documents"][0]