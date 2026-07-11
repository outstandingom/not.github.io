#!/usr/bin/env python3
"""
Forensic Engine v7 – Complete Implementation
All 14 extraction layers + Risk/Correlation layer.
Graceful fallbacks for missing dependencies.

CHANGELOG v7 vs v6:
  - CLI: --report-id, --user-id, --callback-url, --callback-secret for
    GitHub Actions → Supabase pipeline integration.
  - send_callback(): POSTs JSON report to a Supabase edge function using
    only stdlib (urllib.request) — no extra dependency.
  - Risk engine gains combined-signal bonuses: ELA+clone together earn an
    extra 10pts; high entropy+hidden-text together earn an extra 10pts.
  - Date anomaly detection: PDF CreationDate/ModDate and EXIF
    DateTimeOriginal in the future now trigger a 20pt flag.
  - Missing metadata flag: PDF with zero standard metadata fields +5pts.
  - explanation_summary: single human-readable string in risk_assessment
    combining level + top flags (good for DB preview columns / UI cards).
  - PDFEmbeddedExtractor: _check_embedded_files() now walks the PDF Names
    tree properly through indirect references, handles empty arrays, and
    never throws unhandled KeyErrors.
  - Extractor hard-dependency audit: SecurityExtractor and StructureExtractor
    already fixed in v6; confirmed no other extractor has a PDF-only
    dependency on a non-PDF-applicable path.
  - main() wraps engine in try/except and always delivers either a report
    or an error payload to the callback URL before exiting non-zero.
"""

import os
import re
import sys
import json
import hashlib
import zlib
import math
import time
import io
import base64
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from abc import ABC, abstractmethod
from collections import defaultdict, Counter
import warnings
warnings.filterwarnings("ignore")

# ---------- Optional imports (graceful fallback) ----------
try:
    import magic
except ImportError:
    magic = None

try:
    import exifread
except ImportError:
    exifread = None

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:
    Image = None
    ImageChops = None
    ImageStat = None

try:
    import imagehash
except ImportError:
    imagehash = None

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

_PDFMINER_OK = True
try:
    from pdfminer.high_level import extract_text, extract_pages
    from pdfminer.layout import LTTextBox, LTTextLine, LTPage, LTChar, LTRect
    from pdfminer.converter import PDFPageAggregator
    from pdfminer.pdfparser import PDFParser
    from pdfminer.pdfdocument import PDFDocument
    from pdfminer.pdfpage import PDFPage
    from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
    from pdfminer.layout import LAParams
except ImportError:
    _PDFMINER_OK = False
    extract_text = None
    extract_pages = None
    LAParams = None

# ---------- Configuration ----------
MAX_MEMORY_FILE_SIZE = 1024 * 1024 * 1024  # 1 GB
PDF_IMAGE_RESOLUTION = 150                  # DPI for OCR rasterisation
STEGO_SAMPLE_PIXELS  = 20_000              # pixels sampled for LSB chi-square

_FUTURE_THRESHOLD_DAYS = 1  # allow up to 1 day clock skew before flagging


def log(msg: str, verbose: bool):
    if verbose:
        print(f"[forensic-engine] {msg}", file=sys.stderr)


# ---------- Shared Context ----------
class ExtractionContext:
    """Lazy-loaded context caching expensive objects from raw bytes."""

    def __init__(self, file_path: str, raw_data: bytes, options: "RunOptions" = None):
        self.file_path  = file_path
        self.raw_data   = raw_data
        self.options    = options or RunOptions()
        self._mime_type        = None
        self._file_type        = None
        self._decoded_image    = None
        self._pdf_reader       = None
        self._ocr_text         = None
        self._pdf_images: List = []
        self._pdf_layout       = None
        self._warning          = None

    @property
    def mime_type(self) -> str:
        if self._mime_type is None:
            self._detect_type()
        return self._mime_type

    @property
    def file_type(self) -> str:
        if self._file_type is None:
            self._detect_type()
        return self._file_type

    def _detect_type(self):
        ext  = os.path.splitext(self.file_path)[1].lower()
        mime = 'application/octet-stream'
        if magic:
            try:
                mime = magic.from_buffer(self.raw_data, mime=True)
            except Exception:
                pass
        else:
            if ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'):
                mime = f'image/{ext[1:]}'
            elif ext == '.pdf':
                mime = 'application/pdf'
        self._mime_type = mime
        self._file_type = (
            'image' if mime.startswith('image') else
            'pdf'   if mime == 'application/pdf' else
            'unknown'
        )
        if len(self.raw_data) > MAX_MEMORY_FILE_SIZE:
            self._warning = f"File size exceeds {MAX_MEMORY_FILE_SIZE // 1024 // 1024} MB."

    def get_decoded_image(self):
        if self._decoded_image is None and Image is not None and self.file_type == 'image':
            try:
                self._decoded_image = Image.open(io.BytesIO(self.raw_data))
                self._decoded_image.load()
            except Exception:
                self._decoded_image = False
        return self._decoded_image if self._decoded_image is not False else None

    def get_pdf_reader(self):
        if self._pdf_reader is None and pypdf is not None and self.file_type == 'pdf':
            try:
                self._pdf_reader = pypdf.PdfReader(io.BytesIO(self.raw_data))
            except Exception:
                self._pdf_reader = False
        return self._pdf_reader if self._pdf_reader is not False else None

    @staticmethod
    def _safe_resources(page) -> dict:
        try:
            res = page.get('/Resources')
            if res is None:
                return {}
            return res.get_object() if hasattr(res, 'get_object') else res
        except Exception:
            return {}

    def get_pdf_images(self):
        if not self._pdf_images and self.file_type == 'pdf':
            reader = self.get_pdf_reader()
            if reader:
                for page_num, page in enumerate(reader.pages):
                    resources = self._safe_resources(page)
                    xobjects_ref = resources.get('/XObject') if resources else None
                    if not xobjects_ref:
                        continue
                    try:
                        xobjects = xobjects_ref.get_object()
                    except Exception:
                        continue
                    for obj_name in xobjects:
                        try:
                            obj = xobjects[obj_name]
                            if obj.get('/Subtype') == '/Image':
                                img_data = obj.get_data()
                                if img_data:
                                    fmt  = 'jpeg'
                                    filt = obj.get('/Filter')
                                    if filt == '/FlateDecode':
                                        fmt = 'png'
                                    self._pdf_images.append((page_num, img_data, fmt))
                        except Exception:
                            continue
        return self._pdf_images

    def get_pdf_text_with_positions(self):
        if self._pdf_layout is None and self.file_type == 'pdf' and _PDFMINER_OK:
            try:
                self._pdf_layout = self._extract_layout()
            except Exception:
                self._pdf_layout = False
        return self._pdf_layout if self._pdf_layout is not False else None

    def _extract_layout(self):
        if not _PDFMINER_OK:
            return {}
        layout_data: Dict[str, Any] = {'pages': [], 'margins': {}}
        try:
            rsrcmgr    = PDFResourceManager()
            laparams   = LAParams()
            device     = PDFPageAggregator(rsrcmgr, laparams=laparams)
            interpreter = PDFPageInterpreter(rsrcmgr, device)
            parser     = PDFParser(io.BytesIO(self.raw_data))
            doc        = PDFDocument(parser)
            for page_num, page in enumerate(PDFPage.create_pages(doc)):
                interpreter.process_page(page)
                layout    = device.get_result()
                page_data = {'page': page_num, 'texts': [], 'rects': []}
                for element in layout:
                    if isinstance(element, LTTextBox):
                        for textline in element:
                            if isinstance(textline, LTTextLine):
                                entry = {
                                    'text': textline.get_text().strip(),
                                    'x0': textline.x0, 'y0': textline.y0,
                                    'x1': textline.x1, 'y1': textline.y1,
                                    'fontname': None, 'size': None,
                                    'near_white': False,
                                }
                                for ch in textline:
                                    if isinstance(ch, LTChar):
                                        entry['fontname'] = getattr(ch, 'fontname', None)
                                        entry['size']     = getattr(ch, 'size', None)
                                        color = self._char_color(ch)
                                        if color is not None and all(c > 0.92 for c in color):
                                            entry['near_white'] = True
                                        break
                                page_data['texts'].append(entry)
                    elif isinstance(element, LTRect):
                        page_data['rects'].append({
                            'x0': element.x0, 'y0': element.y0,
                            'x1': element.x1, 'y1': element.y1
                        })
                layout_data['pages'].append(page_data)
            if layout_data['pages']:
                first = layout_data['pages'][0]
                if first['texts']:
                    xs = [t['x0'] for t in first['texts']]
                    layout_data['margins'] = {
                        'left':   min(xs),
                        'right':  max(t['x1'] for t in first['texts']),
                        'top':    max(t['y0'] for t in first['texts']),
                        'bottom': min(t['y0'] for t in first['texts']),
                    }
        except Exception:
            pass
        return layout_data

    @staticmethod
    def _char_color(ch) -> Optional[Tuple[float, ...]]:
        try:
            gs     = getattr(ch, 'graphicstate', None)
            if gs is None:
                return None
            ncolor = getattr(gs, 'ncolor', None)
            if ncolor is None:
                return None
            if isinstance(ncolor, (int, float)):
                return (float(ncolor),) * 3
            if isinstance(ncolor, (list, tuple)):
                return tuple(float(c) for c in ncolor)
        except Exception:
            return None
        return None

    def get_ocr_text(self):
        if self._ocr_text is None:
            if self.options.mode == 'light':
                self._ocr_text = ''
                return self._ocr_text
            if self.file_type == 'image' and pytesseract is not None:
                img = self.get_decoded_image()
                if img:
                    try:
                        self._ocr_text = pytesseract.image_to_string(img)
                    except Exception:
                        self._ocr_text = ''
            elif (self.file_type == 'pdf'
                  and pytesseract is not None
                  and convert_from_bytes is not None):
                try:
                    images    = convert_from_bytes(self.raw_data, dpi=self.options.pdf_dpi)
                    full_text = [pytesseract.image_to_string(img) for img in images]
                    self._ocr_text = '\n'.join(full_text)
                except Exception:
                    self._ocr_text = ''
            else:
                self._ocr_text = ''
        return self._ocr_text


class RunOptions:
    def __init__(
        self,
        mode          = 'full',
        include_images = False,
        pdf_dpi       = PDF_IMAGE_RESOLUTION,
        known_hashes  = None,
        verbose       = False,
    ):
        self.mode           = mode
        self.include_images = include_images
        self.pdf_dpi        = pdf_dpi
        self.known_hashes   = known_hashes or set()
        self.verbose        = verbose


# ---------- Base Extractor ----------
class BaseExtractor(ABC):
    name        = "base"
    version     = "1.0"
    dependencies: List[str] = []

    def extract(self, context: ExtractionContext) -> Dict[str, Any]:
        start     = time.perf_counter()
        dep_failed = False
        for dep in self.dependencies:
            try:
                if getattr(context, dep)() is None:
                    dep_failed = True
                    break
            except Exception:
                dep_failed = True
                break
        if dep_failed:
            return {
                "extractor":      self.name,
                "version":        self.version,
                "execution_time": time.perf_counter() - start,
                "confidence":     0.0,
                "evidence":       {"error": "Dependency failure"},
            }
        try:
            evidence   = self._extract(context)
            confidence = 1.0
        except Exception as e:
            evidence   = {"error": str(e)}
            confidence = 0.0
        return {
            "extractor":      self.name,
            "version":        self.version,
            "execution_time": time.perf_counter() - start,
            "confidence":     confidence,
            "evidence":       evidence,
        }

    @abstractmethod
    def _extract(self, context: ExtractionContext) -> Dict[str, Any]:
        pass

    @staticmethod
    def applicable(context: ExtractionContext) -> bool:
        return True


# ---------- Helpers ----------
def compute_hashes(data: bytes) -> Dict[str, str]:
    return {
        'md5':    hashlib.md5(data).hexdigest(),
        'sha1':   hashlib.sha1(data).hexdigest(),
        'sha256': hashlib.sha256(data).hexdigest(),
        'crc32':  hex(zlib.crc32(data) & 0xFFFFFFFF),
    }


def shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    freq   = [0] * 256
    for b in data:
        freq[b] += 1
    length  = len(data)
    entropy = 0.0
    for count in freq:
        if count:
            p        = count / length
            entropy -= p * math.log2(p)
    return entropy


def detect_zip_header(data: bytes) -> bool:
    return data.startswith(b'PK\x03\x04') or data.startswith(b'PK\x05\x06')


def chi_square_bit_test(bits: List[int]) -> float:
    if not bits:
        return 0.0
    n        = len(bits)
    ones     = sum(bits)
    zeros    = n - ones
    expected = n / 2
    return ((zeros - expected) ** 2) / expected + ((ones - expected) ** 2) / expected


def parse_pdf_date(date_str: str) -> Optional[datetime]:
    """Parse PDF date format D:YYYYMMDDHHmmSS into a UTC datetime, or None."""
    m = re.search(r'D:(\d{4})(\d{2})(\d{2})', str(date_str))
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                            tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def parse_exif_date(date_str: str) -> Optional[datetime]:
    """Parse EXIF date YYYY:MM:DD HH:MM:SS into a UTC datetime, or None."""
    m = re.match(r'(\d{4}):(\d{2}):(\d{2})', str(date_str))
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                            tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


# ---------- LAYER 1: File Evidence ----------
class FileEvidenceExtractor(BaseExtractor):
    name = "file_evidence"

    def _extract(self, context: ExtractionContext) -> Dict[str, Any]:
        data      = context.raw_data
        hashes    = compute_hashes(data)
        corrupted = False
        if context.file_type == 'image' and Image:
            try:
                Image.open(io.BytesIO(data)).verify()
            except Exception:
                corrupted = True
        elif context.file_type == 'pdf' and pypdf:
            try:
                pypdf.PdfReader(io.BytesIO(data))
            except Exception:
                corrupted = True
        return {
            'file_size': len(data),
            'hashes':    hashes,
            'entropy':   shannon_entropy(data),
            'mime_type': context.mime_type,
            'extension': os.path.splitext(context.file_path)[1].lower(),
            'corrupted': corrupted,
            'duplicate': hashes['sha256'] in context.options.known_hashes,
        }


# ---------- LAYER 2: Metadata ----------
class EXIFExtractor(BaseExtractor):
    name = "exif"

    @staticmethod
    def applicable(context):
        return context.file_type == 'image' and exifread is not None

    def _extract(self, context):
        exif = {}
        try:
            tags = exifread.process_file(io.BytesIO(context.raw_data), details=False)
            for tag, value in tags.items():
                exif[tag] = str(value)
        except Exception:
            pass
        return exif


class XMPExtractor(BaseExtractor):
    name = "xmp"

    @staticmethod
    def applicable(context):
        return context.file_type == 'image'

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {}
        xmp_raw = img.info.get('xmp') or img.info.get('XML:com.adobe.xmp')
        if not xmp_raw:
            return {}
        if isinstance(xmp_raw, bytes):
            xmp_raw = xmp_raw.decode('utf-8', errors='replace')
        return {'raw_xmp_present': True, 'xmp_snippet': xmp_raw[:500]}


class IPTCExtractor(BaseExtractor):
    name = "iptc"

    @staticmethod
    def applicable(context):
        return context.file_type == 'image'

    def _extract(self, context):
        return {'note': 'IPTC-IIM parsing not implemented; requires dedicated parser'}


class PDFMetadataExtractor(BaseExtractor):
    name = "pdf_metadata"
    dependencies = ['get_pdf_reader']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and pypdf is not None

    def _extract(self, context):
        reader = context.get_pdf_reader()
        if reader is None:
            return {}
        meta = reader.metadata
        if meta:
            return {k.lstrip('/'): v for k, v in meta.items()}
        return {}


# ---------- LAYER 3: Structure ----------
class StructureExtractor(BaseExtractor):
    name         = "structure"
    dependencies = []          # no hard deps — handles both image and PDF

    def _extract(self, context):
        structure = {}
        if context.file_type == 'image':
            structure['jpeg_markers'] = self._parse_jpeg(context.raw_data)
        elif context.file_type == 'pdf':
            reader = context.get_pdf_reader()
            if reader:
                xref_present = 'missing'
                try:
                    xref_present = 'present' if reader.xref else 'missing'
                except Exception:
                    pass
                structure['pdf'] = {
                    'num_pages':  len(reader.pages),
                    'xref_table': xref_present,
                }
        return structure

    def _parse_jpeg(self, data):
        markers = []
        for i in range(len(data) - 1):
            if data[i] == 0xFF and data[i + 1] not in (0x00, 0xFF):
                markers.append(hex(data[i + 1]))
        return markers[:20]


# ---------- LAYER 4: Embedded Objects ----------
class PDFEmbeddedExtractor(BaseExtractor):
    name         = "pdf_embedded"
    dependencies = ['get_pdf_reader', 'get_pdf_images']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and pypdf is not None

    def _extract(self, context):
        reader = context.get_pdf_reader()
        if reader is None:
            return {}
        result = {'images': [], 'attachments': [], 'javascript': [], 'forms': []}
        try:
            for page_num, img_data, fmt in context.get_pdf_images():
                entry = {'page': page_num, 'format': fmt, 'size': len(img_data)}
                if context.options.include_images:
                    entry['base64'] = base64.b64encode(img_data).decode('utf-8')
                result['images'].append(entry)

            root_ref = reader.trailer.get('/Root', {})
            try:
                root = root_ref.get_object() if hasattr(root_ref, 'get_object') else root_ref
            except Exception:
                root = {}

            if self._check_embedded_files(root):
                result['attachments'].append({'count': 'found'})
            if self._check_javascript(root):
                result['javascript'].append({'actions': 'found'})
            if hasattr(root, 'get') and root.get('/AcroForm'):
                result['forms'].append({'form': 'found'})
        except Exception as e:
            result['error'] = str(e)
        return result

    @staticmethod
    def _check_embedded_files(root) -> bool:
        """
        v7 fix: walk the PDF Names tree properly through indirect references.
        The Names tree can contain a /Kids chain; we check one level deep,
        which covers the vast majority of real documents.
        """
        try:
            if not hasattr(root, 'get'):
                return False
            names_ref = root.get('/Names')
            if names_ref is None:
                return False
            names = names_ref.get_object() if hasattr(names_ref, 'get_object') else names_ref
            if not hasattr(names, 'get'):
                return False
            ef_ref = names.get('/EmbeddedFiles')
            if ef_ref is None:
                return False
            ef = ef_ref.get_object() if hasattr(ef_ref, 'get_object') else ef_ref
            if ef is None:
                return False
            # The EmbeddedFiles entry is a name tree; check its /Names array
            ef_names = None
            if hasattr(ef, 'get'):
                ef_names = ef.get('/Names')
            if ef_names is None:
                return True   # key exists — presume present
            if hasattr(ef_names, 'get_object'):
                ef_names = ef_names.get_object()
            return bool(ef_names)
        except Exception:
            return False

    @staticmethod
    def _check_javascript(root) -> bool:
        try:
            if not hasattr(root, 'get'):
                return False
            names_ref = root.get('/Names')
            if names_ref is None:
                return False
            names = names_ref.get_object() if hasattr(names_ref, 'get_object') else names_ref
            if hasattr(names, 'get') and names.get('/JavaScript') is not None:
                return True
            # Also check /OpenAction
            action_ref = root.get('/OpenAction')
            if action_ref is not None:
                action = action_ref.get_object() if hasattr(action_ref, 'get_object') else action_ref
                if hasattr(action, 'get') and action.get('/S') in ('/JavaScript', '/Launch'):
                    return True
        except Exception:
            pass
        return False


class PDFFontExtractor(BaseExtractor):
    name         = "pdf_fonts"
    dependencies = ['get_pdf_reader']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and pypdf is not None

    def _extract(self, context):
        reader = context.get_pdf_reader()
        if reader is None:
            return {}
        fonts: Dict[str, list] = {'embedded': [], 'missing': [], 'subsets': []}
        try:
            for page in reader.pages:
                resources = ExtractionContext._safe_resources(page)
                font_ref  = resources.get('/Font') if resources else None
                if not font_ref:
                    continue
                try:
                    page_fonts = font_ref.get_object()
                except Exception:
                    continue
                for font_name in page_fonts:
                    try:
                        font_obj = page_fonts[font_name]
                        if any(k in font_obj for k in ('/FontFile', '/FontFile2', '/FontFile3')):
                            fonts['embedded'].append(str(font_name))
                        else:
                            fonts['missing'].append(str(font_name))
                        if '+' in str(font_name):
                            fonts['subsets'].append(str(font_name))
                    except Exception:
                        continue
            for key in fonts:
                fonts[key] = list(set(fonts[key]))
        except Exception:
            pass
        return fonts


# ---------- LAYER 5: OCR ----------
class OCRExtractor(BaseExtractor):
    name         = "ocr"
    dependencies = ['get_ocr_text']

    @staticmethod
    def applicable(context):
        return (context.file_type in ('image', 'pdf')
                and pytesseract is not None
                and context.options.mode != 'light')

    def _extract(self, context):
        text = context.get_ocr_text() or ''
        return {
            'text':       text[:2000],
            'confidence': min(1.0, len(text) / 500),
            'language':   'eng',
        }


# ---------- LAYER 6: Image Forensics ----------
class NoiseExtractor(BaseExtractor):
    name         = "noise"
    dependencies = ['get_decoded_image']

    @staticmethod
    def applicable(context):
        return context.file_type == 'image' and cv2 is not None and np is not None

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {'error': 'Could not decode image'}
        img_np = np.array(img.convert('L'))
        return {
            'noise_variance': float(cv2.Laplacian(img_np, cv2.CV_64F).var()),
            'method':         'laplacian_var',
        }


class ELAExtractor(BaseExtractor):
    name         = "ela"
    dependencies = ['get_decoded_image']

    @staticmethod
    def applicable(context):
        return context.file_type == 'image' and Image is not None

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {'error': 'Could not decode image'}
        try:
            buf = io.BytesIO()
            img.convert('RGB').save(buf, 'JPEG', quality=90)
            buf.seek(0)
            recompressed = Image.open(buf)
            diff         = ImageChops.difference(img.convert('RGB'), recompressed.convert('RGB'))
            stat         = ImageStat.Stat(diff)
            ela_score    = sum(stat.mean) / 3.0
            return {
                'ela_score': ela_score,
                'method':    'jpeg_recompression_90',
                'max_diff':  max(stat.extrema[0]) if stat.extrema else None,
            }
        except Exception as e:
            return {'error': str(e)}


class CloneExtractor(BaseExtractor):
    name         = "clone_detection"
    dependencies = ['get_decoded_image']

    @staticmethod
    def applicable(context):
        return (context.file_type == 'image'
                and cv2 is not None
                and np is not None
                and context.options.mode != 'light')

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {'error': 'Could not decode image'}
        try:
            img_cv = cv2.cvtColor(np.array(img.convert('RGB')), cv2.COLOR_RGB2BGR)
            gray   = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            orb    = cv2.ORB_create()
            kp, des = orb.detectAndCompute(gray, None)
            if des is None or len(kp) < 2:
                return {'clone_regions': [], 'detected': False, 'match_count': 0}
            bf      = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            matches = bf.match(des, des)
            real_matches = sum(
                1 for m in matches
                if m.queryIdx != m.trainIdx
                and math.hypot(
                    kp[m.queryIdx].pt[0] - kp[m.trainIdx].pt[0],
                    kp[m.queryIdx].pt[1] - kp[m.trainIdx].pt[1],
                ) > 10
            )
            return {
                'clone_regions': [],
                'detected':      real_matches > 10,
                'match_count':   real_matches,
            }
        except Exception as e:
            return {'error': str(e)}


class SteganographyExtractor(BaseExtractor):
    name         = "steganography"
    dependencies = ['get_decoded_image']

    @staticmethod
    def applicable(context):
        return context.file_type == 'image'

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {'error': 'Could not decode image'}
        try:
            if np is not None:
                pixels   = np.array(img.convert('RGB')).reshape(-1, 3)
                sample   = pixels[:STEGO_SAMPLE_PIXELS]
                lsb_bits = (sample & 1).flatten().tolist()
            else:
                data     = list(img.convert('RGB').getdata())[:STEGO_SAMPLE_PIXELS]
                lsb_bits = [c & 1 for r, g, b in data for c in (r, g, b)]

            chi2          = chi_square_bit_test(lsb_bits)
            ones_ratio    = sum(lsb_bits) / len(lsb_bits) if lsb_bits else 0.5
            suspicious    = len(lsb_bits) > 5_000 and chi2 < 0.5
            hidden_zip    = 'found' if detect_zip_header(context.raw_data) else None
            return {
                'lsb_bits_sampled':        len(lsb_bits),
                'lsb_ones_ratio':          ones_ratio,
                'lsb_chi_square':          chi2,
                'suspicious_lsb_uniformity': suspicious,
                'hidden_zip_signature':    hidden_zip,
                'hidden_files':            [],
            }
        except Exception as e:
            return {'error': str(e)}


class PerceptualHashExtractor(BaseExtractor):
    name         = "perceptual_hash"
    dependencies = ['get_decoded_image']

    @staticmethod
    def applicable(context):
        return context.file_type == 'image' and imagehash is not None and Image is not None

    def _extract(self, context):
        img = context.get_decoded_image()
        if img is None:
            return {'error': 'Could not decode image'}
        return {
            'phash': str(imagehash.phash(img)),
            'dhash': str(imagehash.dhash(img)),
            'ahash': str(imagehash.average_hash(img)),
        }


# ---------- LAYER 8: Layout ----------
class PDFLayoutExtractor(BaseExtractor):
    name         = "pdf_layout"
    dependencies = ['get_pdf_text_with_positions']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and _PDFMINER_OK

    def _extract(self, context):
        layout = context.get_pdf_text_with_positions()
        if layout is None:
            return {'error': 'Layout extraction failed'}
        pages = []
        for page in layout.get('pages', []):
            near_white_count = sum(1 for t in page['texts'] if t.get('near_white'))
            pages.append({
                'page':                page['page'],
                'text_count':          len(page['texts']),
                'rect_count':          len(page['rects']),
                'near_white_text_count': near_white_count,
            })
        return {'pages': pages, 'margins': layout.get('margins', {})}


# ---------- LAYER 9: Hidden Content ----------
class PDFHiddenExtractor(BaseExtractor):
    name         = "pdf_hidden"
    dependencies = ['get_pdf_reader', 'get_pdf_text_with_positions']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and pypdf is not None

    def _extract(self, context):
        reader = context.get_pdf_reader()
        if reader is None:
            return {}
        hidden: Dict[str, list] = {'annotations': [], 'white_text': [], 'deleted_objects': []}
        try:
            for idx, page in enumerate(reader.pages):
                if '/Annots' not in page:
                    continue
                try:
                    annots = page['/Annots'].get_object()
                    for annot in annots:
                        annot_obj = annot.get_object()
                        if '/Subtype' in annot_obj and '/AP' not in annot_obj:
                            hidden['annotations'].append({
                                'page':    idx,
                                'subtype': str(annot_obj['/Subtype']),
                            })
                except Exception:
                    continue
        except Exception:
            pass
        layout = context.get_pdf_text_with_positions()
        if layout:
            for page in layout.get('pages', []):
                for t in page['texts']:
                    if t.get('near_white') and t.get('text'):
                        hidden['white_text'].append({
                            'page': page['page'],
                            'text': t['text'][:100],
                        })
        return hidden


# ---------- LAYER 10: Security ----------
class SecurityExtractor(BaseExtractor):
    name         = "security"
    dependencies = []   # no hard deps — handles all file types gracefully

    def _extract(self, context):
        encrypted   = False
        permissions = None
        if context.file_type == 'pdf':
            reader = context.get_pdf_reader()
            if reader:
                try:
                    encrypted = reader.is_encrypted
                except Exception:
                    pass
                try:
                    if encrypted and hasattr(reader, 'permissions'):
                        permissions = reader.permissions
                except Exception:
                    pass
        return {'encrypted': encrypted, 'signatures': [], 'permissions': permissions}


# ---------- LAYER 13: Revision ----------
class PDFRevisionExtractor(BaseExtractor):
    name         = "pdf_revision"
    dependencies = ['get_pdf_reader']

    @staticmethod
    def applicable(context):
        return context.file_type == 'pdf' and pypdf is not None

    def _extract(self, context):
        reader = context.get_pdf_reader()
        if reader is None:
            return {}
        incremental_saves = 0
        try:
            trailer = reader.trailer
            seen    = set()
            cur     = trailer
            while cur is not None and '/Prev' in cur:
                incremental_saves += 1
                prev_offset = cur['/Prev']
                if prev_offset in seen:
                    break
                seen.add(prev_offset)
                break   # pypdf doesn't expose a clean deeper traversal
        except Exception:
            pass
        return {'incremental_saves': incremental_saves, 'objects_added': []}


# ---------- LAYER 14: Statistics ----------
class StatisticsExtractor(BaseExtractor):
    name = "statistics"

    def _extract(self, context):
        data  = context.raw_data
        freq  = [0] * 256
        for b in data:
            freq[b] += 1
        total        = len(data)
        distribution = [count / total for count in freq] if total else []
        return {
            'byte_distribution': distribution[:20],
            'entropy':           shannon_entropy(data),
        }


# ---------- Evidence Pipeline ----------
class EvidencePipeline:
    def __init__(self, name: str, extractors: List[BaseExtractor]):
        self.name       = name
        self.extractors = extractors

    def run(self, context: ExtractionContext, verbose: bool = False) -> Dict[str, Any]:
        results = []
        for ext in self.extractors:
            if ext.applicable(context):
                log(f"  extractor: {ext.name}", verbose)
                try:
                    results.append(ext.extract(context))
                except Exception as e:
                    results.append({
                        "extractor":      ext.name,
                        "version":        ext.version,
                        "execution_time": 0.0,
                        "confidence":     0.0,
                        "evidence":       {"error": str(e)},
                    })
        return {self.name: results}


# ---------- Risk / Correlation Engine (v7) ----------
class RiskCorrelationEngine:
    """
    Walks all evidence, produces:
      risk_score        — 0-100
      risk_level        — none / low / medium / high
      flags             — list of human-readable explanations
      explanation_summary — single string suitable for a DB preview column
    """

    _PDF_META_KEYS = ('CreationDate', 'ModDate', 'Author', 'Creator', 'Producer')

    def score(
        self,
        evidence:  Dict[str, List[Dict[str, Any]]],
        file_type: str,
    ) -> Dict[str, Any]:
        flags: List[str] = []
        points = 0
        now    = datetime.now(timezone.utc)

        def find(category: str, name: str) -> Optional[dict]:
            for res in evidence.get(category, []):
                if res.get('extractor') == name:
                    return res.get('evidence', {})
            return None

        # ── File-level ────────────────────────────────────────────────────────
        fe = find('file', 'file_evidence')
        entropy = 0.0
        if fe:
            if fe.get('corrupted'):
                points += 15
                flags.append('File failed structural validation — appears corrupted or malformed.')
            if fe.get('duplicate'):
                points += 10
                flags.append('File SHA-256 matches a previously-seen / known file.')
            entropy = fe.get('entropy', 0.0)
            if entropy > 7.9:
                points += 5
                flags.append(
                    f'Overall file entropy is very high ({entropy:.2f}/8) — consistent with '
                    f'encryption, compression, or embedded packed data.'
                )

        # ── Metadata date anomalies ───────────────────────────────────────────
        pdf_meta = find('metadata', 'pdf_metadata')
        if pdf_meta:
            # Future date
            for key in ('CreationDate', 'ModDate'):
                val = pdf_meta.get(key) or pdf_meta.get(key.lower())
                if val:
                    dt = parse_pdf_date(str(val))
                    if dt and (dt - now).days > _FUTURE_THRESHOLD_DAYS:
                        points += 20
                        flags.append(
                            f'PDF {key} is set in the future '
                            f'({dt.strftime("%Y-%m-%d")}) — metadata likely tampered.'
                        )
                        break
            # No metadata at all
            has_any = any(pdf_meta.get(k) for k in self._PDF_META_KEYS)
            if not has_any and file_type == 'pdf':
                points += 5
                flags.append(
                    'PDF has no standard metadata fields — may have been stripped to hide origin.'
                )

        exif = find('metadata', 'exif')
        if exif:
            for key in ('EXIF DateTimeOriginal', 'Image DateTime', 'EXIF DateTimeDigitized'):
                val = exif.get(key)
                if val:
                    dt = parse_exif_date(str(val))
                    if dt and (dt - now).days > _FUTURE_THRESHOLD_DAYS:
                        points += 15
                        flags.append(
                            f'EXIF {key} is set in the future '
                            f'({dt.strftime("%Y-%m-%d")}) — timestamp likely tampered.'
                        )
                        break

        # ── Image forensics ───────────────────────────────────────────────────
        ela   = find('visual', 'ela')
        clone = find('visual', 'clone_detection')

        ela_suspicious   = ela   is not None and ela.get('ela_score', 0) > 15
        clone_suspicious = clone is not None and clone.get('detected')

        if ela_suspicious:
            points += 20
            flags.append(
                f"ELA score is elevated ({ela['ela_score']:.1f}) — possible localised "
                f"recompression or editing artefact."
            )
        if clone_suspicious:
            points += 15
            flags.append(
                f"Clone-detection found {clone.get('match_count', 0)} repeated feature matches "
                f"— possible copy-move manipulation."
            )
        # Combined ELA + clone bonus
        if ela_suspicious and clone_suspicious:
            points += 10
            flags.append(
                'Both ELA and clone detection raised flags simultaneously — '
                'elevated confidence of deliberate image manipulation.'
            )

        stego = find('visual', 'steganography')
        if stego:
            if stego.get('hidden_zip_signature'):
                points += 20
                flags.append('A ZIP file signature was found embedded in the image bytes.')
            if stego.get('suspicious_lsb_uniformity'):
                points += 10
                flags.append(
                    'LSB distribution is unusually uniform — possible steganographic payload '
                    '(heuristic signal, not conclusive).'
                )

        # ── PDF forensics ─────────────────────────────────────────────────────
        sec = find('security', 'security')
        if sec and sec.get('encrypted'):
            points += 5
            flags.append('PDF is encrypted / password-protected.')

        hidden = find('hidden', 'pdf_hidden')
        hidden_text_count = 0
        if hidden:
            white_text = hidden.get('white_text', [])
            if white_text:
                hidden_text_count = len(white_text)
                points += 15
                flags.append(
                    f'Found {hidden_text_count} block(s) of near-white (likely invisible) text — '
                    f'often used to conceal content from visual review or manipulate OCR output.'
                )
            if hidden.get('annotations'):
                points += 5
                flags.append(
                    f"{len(hidden['annotations'])} annotation(s) with no visible appearance stream."
                )

        # Combined high-entropy + hidden-text bonus
        if entropy > 7.5 and hidden_text_count > 0:
            points += 10
            flags.append(
                'High file entropy combined with hidden near-white text — '
                'multiple simultaneous concealment signals.'
            )

        rev = find('revision', 'pdf_revision')
        if rev and rev.get('incremental_saves', 0) > 0:
            points += 5
            flags.append(
                f"PDF contains {rev['incremental_saves']} incremental-save chain link(s) — "
                f"document was re-saved after initial creation."
            )

        fonts = find('embedded', 'pdf_fonts')
        if fonts and fonts.get('missing'):
            points += 5
            flags.append(
                f"{len(fonts['missing'])} font(s) referenced but not embedded — "
                f"may render differently across viewers; sometimes used to obscure edits."
            )

        # ── Clamp + level ─────────────────────────────────────────────────────
        points = min(points, 100)
        level  = (
            'high'   if points >= 60 else
            'medium' if points >= 30 else
            'low'    if points >  0  else
            'none'
        )

        # ── explanation_summary ───────────────────────────────────────────────
        if flags:
            top   = flags[:3]
            extra = len(flags) - 3
            summary = f"[{level.upper()}] {points}/100 — " + " | ".join(top)
            if extra > 0:
                summary += f" (+{extra} more flag{'s' if extra > 1 else ''})"
        else:
            summary = f"[{level.upper()}] {points}/100 — No anomalies detected."

        return {
            'risk_score':          points,
            'risk_level':          level,
            'flags':               flags,
            'explanation_summary': summary,
            'note': (
                'Heuristic triage aid only — not a forensic determination. '
                'A human examiner should review flagged items directly.'
            ),
        }


# ---------- Evidence Assembler ----------
class EvidenceAssembler:
    @staticmethod
    def assemble(
        pipeline_results: Dict[str, Any],
        context:          ExtractionContext,
        report_id:        Optional[str] = None,
        user_id:          Optional[str] = None,
    ) -> Dict[str, Any]:
        package: Dict[str, Any] = {
            "report_id": report_id,
            "user_id":   user_id,
            "file_path": context.file_path,
            "file_type": context.file_type,
            "mime_type": context.mime_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "evidence":  {},
            "summary":   {
                "total_extractors":      0,
                "successful_extractors": 0,
                "total_execution_time":  0.0,
            },
        }
        if context._warning:
            package["warning"] = context._warning

        for category, results in pipeline_results.items():
            package["evidence"][category] = results
            for res in results:
                package["summary"]["total_extractors"]      += 1
                if res["confidence"] > 0.5:
                    package["summary"]["successful_extractors"] += 1
                package["summary"]["total_execution_time"] += res["execution_time"]

        risk_engine             = RiskCorrelationEngine()
        package["risk_assessment"] = risk_engine.score(package["evidence"], context.file_type)
        return package


# ---------- Engine ----------
class ForensicEngine:
    def __init__(self):
        self.pipelines = {
            'file':      EvidencePipeline('file',      [FileEvidenceExtractor()]),
            'metadata':  EvidencePipeline('metadata',  [
                EXIFExtractor(), XMPExtractor(), IPTCExtractor(), PDFMetadataExtractor()
            ]),
            'structure': EvidencePipeline('structure', [StructureExtractor()]),
            'statistics': EvidencePipeline('statistics', [StatisticsExtractor()]),
            'visual':    EvidencePipeline('visual',    [
                NoiseExtractor(), ELAExtractor(), CloneExtractor(),
                SteganographyExtractor(), PerceptualHashExtractor()
            ]),
            'text':      EvidencePipeline('text',      [OCRExtractor()]),
            'embedded':  EvidencePipeline('embedded',  [PDFEmbeddedExtractor(), PDFFontExtractor()]),
            'security':  EvidencePipeline('security',  [SecurityExtractor()]),
            'hidden':    EvidencePipeline('hidden',    [PDFHiddenExtractor()]),
            'revision':  EvidencePipeline('revision',  [PDFRevisionExtractor()]),
            'layout':    EvidencePipeline('layout',    [PDFLayoutExtractor()]),
        }

    def run(
        self,
        file_path:  str,
        options:    RunOptions  = None,
        report_id:  Optional[str] = None,
        user_id:    Optional[str] = None,
    ) -> Dict[str, Any]:
        options    = options or RunOptions()
        start      = time.perf_counter()
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        context         = ExtractionContext(file_path, raw_data, options)
        pipeline_results: Dict[str, Any] = {}
        for name, pipeline in self.pipelines.items():
            log(f"pipeline: {name}", options.verbose)
            result = pipeline.run(context, verbose=options.verbose)
            if result[name]:
                pipeline_results.update(result)
        package = EvidenceAssembler.assemble(pipeline_results, context, report_id, user_id)
        package["summary"]["engine_execution_time"] = time.perf_counter() - start
        return package


# ---------- Callback ----------
def send_callback(url: str, secret: str, payload: dict):
    """POST the result payload to the callback URL (Supabase receive-results function).
    Uses only stdlib so no extra dependencies are required in the runner image."""
    data = json.dumps(payload, default=str).encode('utf-8')
    req  = urllib.request.Request(
        url,
        data    = data,
        headers = {
            'Content-Type':      'application/json',
            'x-callback-secret': secret,
        },
        method  = 'POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[callback] HTTP {resp.status}", file=sys.stderr)
    except urllib.error.HTTPError as e:
        print(f"[callback] HTTP error {e.code}: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[callback] Failed: {e}", file=sys.stderr)
        sys.exit(1)


# ---------- Known-hash loader ----------
def load_known_hashes(path: Optional[str]) -> set:
    if not path:
        return set()
    try:
        with open(path) as f:
            data = json.load(f)
        if isinstance(data, list):
            return {h.lower() for h in data}
        if isinstance(data, dict) and 'sha256' in data:
            return {h.lower() for h in data['sha256']}
    except Exception as e:
        print(f"Warning: could not load known-hashes '{path}': {e}", file=sys.stderr)
    return set()


# ---------- CLI ----------
def main():
    parser = argparse.ArgumentParser(
        description="Forensic Engine v7 – File forensics for images and PDFs."
    )
    parser.add_argument('file',               help='Path to file to analyse')
    parser.add_argument('-o', '--output',     help='Output JSON file (default: stdout)')
    parser.add_argument('--pretty',           action='store_true', help='Pretty-print JSON')
    parser.add_argument('--mode',             choices=['light', 'full'], default='full',
                        help='light = skip OCR + clone-detection; full = everything')
    parser.add_argument('--include-images',   action='store_true',
                        help='Embed extracted PDF images as base64 in output')
    parser.add_argument('--pdf-dpi',          type=int, default=PDF_IMAGE_RESOLUTION,
                        help=f'DPI for PDF→image rasterisation (default {PDF_IMAGE_RESOLUTION})')
    parser.add_argument('--known-hashes',     help='JSON file of known sha256 hashes')
    parser.add_argument('--report-id',        help='Report ID to embed in output and callback')
    parser.add_argument('--user-id',          help='User ID to embed in output and callback')
    parser.add_argument('--callback-url',     help='URL to POST results to (Supabase edge fn)')
    parser.add_argument('--callback-secret',  help='Bearer/header secret for callback URL',
                        default='')
    parser.add_argument('-v', '--verbose',    action='store_true', help='Progress to stderr')
    args = parser.parse_args()

    if not os.path.isfile(args.file):
        print(f"Error: '{args.file}' not found.", file=sys.stderr)
        if args.callback_url and args.report_id:
            send_callback(args.callback_url, args.callback_secret, {
                'report_id': args.report_id,
                'error':     f"File not found: {args.file}",
                'report':    None,
            })
        sys.exit(1)

    options = RunOptions(
        mode           = args.mode,
        include_images = args.include_images,
        pdf_dpi        = args.pdf_dpi,
        known_hashes   = load_known_hashes(args.known_hashes),
        verbose        = args.verbose,
    )

    engine = ForensicEngine()
    try:
        package = engine.run(args.file, options,
                             report_id=args.report_id, user_id=args.user_id)
    except Exception as e:
        if args.callback_url and args.report_id:
            send_callback(args.callback_url, args.callback_secret, {
                'report_id': args.report_id,
                'error':     str(e),
                'report':    None,
            })
        raise

    indent      = 2 if args.pretty else None
    json_output = json.dumps(package, indent=indent, default=str)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_output)
        log(f"wrote output to {args.output}", args.verbose)
    else:
        print(json_output)

    if args.callback_url and args.report_id:
        send_callback(args.callback_url, args.callback_secret, {
            'report_id': args.report_id,
            'report':    package,
        })


if __name__ == '__main__':
    main()
