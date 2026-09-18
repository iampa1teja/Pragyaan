import re


def clean_text(raw_text):
    """
    Cleans raw extracted document text.

    Args:
        raw_text (str): Raw text extracted from a document.

    Returns:
        str: Cleaned text.
    """

    text = re.sub(r"-\s*\n\s*", "", raw_text)

    text = re.sub(r"\n+", " ", text)

    text = re.sub(r"[ \t]+", " ", text)

    text = re.sub(r"\bPage\s+\d+\b", "", text, flags=re.IGNORECASE)

    text = re.sub(r"(?<!\w)\d{1,4}(?!\w)", "", text)

    text = re.sub(r"\s+", " ", text)

    text = text.strip()

    return text