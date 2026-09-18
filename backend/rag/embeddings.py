import chromadb.utils.embedding_functions as embedding_functions

def get_embedding_function():
    """
    Returns the embedding function used by ChromaDB.

    ChromaDB will use its default embedding model.
    """

    embedding_function = embedding_functions.DefaultEmbeddingFunction()
    return embedding_function