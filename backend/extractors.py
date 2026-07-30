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


def extract_text_from_image(file_bytes: bytes) -> str:
    """Extract text from image via OCR.
    Falls back gracefully when Tesseract binary is not installed (e.g. Vercel).
    """
    if not _TESSERACT_AVAILABLE:
        return (
            "[Image uploaded — OCR text extraction is not available in this deployment. "
            "The image has been received but its text content cannot be read automatically. "
            "Please describe the image contents in your message if you need the AI to analyse it.]"
        )
    try:
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image)
        return text.strip()
    except pytesseract.TesseractNotFoundError:
        return (
            "[Image uploaded — Tesseract OCR binary not found on this server. "
            "Please describe the image contents in your message.]"
        )
    except Exception as e:
        print(f"Error extracting Image text: {e}")
        return ""


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
        extracted = extract_text_from_image(file_bytes)
    elif "text" in content_type or ext == "txt":
        extracted = file_bytes.decode("utf-8", errors="ignore")

    # Cap length to avoid massive context
    max_len = 100_000
    if len(extracted) > max_len:
        extracted = extracted[:max_len] + f"\n...[Truncated, showing first {max_len} characters]"

    return extracted
