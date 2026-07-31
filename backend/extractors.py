import os
import io
import pandas as pd
import pdfplumber
from docx import Document
from PIL import Image

# pytesseract requires the tesseract binary which is NOT available on
# Vercel serverless. Import it lazily and catch failures gracefully.
try:
    import pytesseract
    _TESSERACT_AVAILABLE = True
except ImportError:
    _TESSERACT_AVAILABLE = False


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"Error extracting PDF: {e}")
    return text.strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    text = ""
    try:
        doc = Document(io.BytesIO(file_bytes))
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error extracting DOCX: {e}")
    return text.strip()


def extract_data_from_csv(file_bytes: bytes) -> str:
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
        summary = f"CSV Data Summary:\nRows: {len(df)}, Columns: {len(df.columns)}\n"
        summary += f"Columns: {', '.join(df.columns)}\n\nFirst 5 rows:\n"
        summary += df.head().to_string()
        return summary
    except Exception as e:
        print(f"Error extracting CSV: {e}")
        return ""


def extract_data_from_excel(file_bytes: bytes) -> str:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        summary = f"Excel Data Summary:\nRows: {len(df)}, Columns: {len(df.columns)}\n"
        summary += f"Columns: {', '.join(df.columns)}\n\nFirst 5 rows:\n"
        summary += df.head().to_string()
        return summary
    except Exception as e:
        print(f"Error extracting Excel: {e}")
        return ""


def extract_text_from_image(file_bytes: bytes, content_type: str = "image/png") -> str:
    """Extract text from image via OCR, or store as base64 for vision model.
    On Vercel (no Tesseract), the image is base64-encoded so the backend can
    pass it directly to a multimodal vision model.
    """
    import base64

    if _TESSERACT_AVAILABLE:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            if text.strip():
                return text.strip()
        except Exception as e:
            print(f"OCR failed, falling back to base64 vision: {e}")

    # Fallback: encode as base64 so vision models can process it directly
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    return f"__VISION_IMG__{content_type}||{b64}__VISION_END__"


def process_file_upload(filename: str, content_type: str, file_bytes: bytes) -> str:
    """Routes the file to the correct extractor based on content type."""
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    extracted = ""
    if "pdf" in content_type or ext == "pdf":
        extracted = extract_text_from_pdf(file_bytes)
    elif "word" in content_type or ext == "docx":
        extracted = extract_text_from_docx(file_bytes)
    elif "csv" in content_type or ext == "csv":
        extracted = extract_data_from_csv(file_bytes)
    elif "excel" in content_type or "spreadsheet" in content_type or ext in ["xlsx", "xls"]:
        extracted = extract_data_from_excel(file_bytes)
    elif "image" in content_type or ext in ["jpg", "jpeg", "png", "webp"]:
        extracted = extract_text_from_image(file_bytes, content_type)
    elif "text" in content_type or ext == "txt":
        extracted = file_bytes.decode("utf-8", errors="ignore")

    # Cap length to avoid massive context for text documents
    max_len = 100_000
    if len(extracted) > max_len and not extracted.startswith("__VISION_IMG__"):
        extracted = extracted[:max_len] + f"\n...[Truncated, showing first {max_len} characters]"

    return extracted
