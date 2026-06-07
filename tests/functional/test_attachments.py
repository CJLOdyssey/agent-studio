"""Tests for attachment API routes (pure helper functions)."""
import pytest

from virtual_team.routers.attachments import _extract_text, _validate_upload


class TestValidateUpload:
    def test_accepts_valid_file(self):
        _validate_upload("text/plain", 1024)
        _validate_upload("image/png", 5 * 1024 * 1024)

    def test_rejects_too_large_file(self):
        with pytest.raises(Exception) as exc:
            _validate_upload("text/plain", 20 * 1024 * 1024)
        assert "超过" in str(exc.value)

    def test_rejects_unsupported_content_type(self):
        with pytest.raises(Exception) as exc:
            _validate_upload("application/x-shockwave-flash", 1024)
        assert "不支持" in str(exc.value)


class TestExtractText:
    async def test_extracts_text_file(self, tmp_path):
        file = tmp_path / "test.txt"
        file.write_text("Hello, world!", encoding="utf-8")
        result = await _extract_text(file, "text/plain")
        assert "Hello, world!" in result

    async def test_handles_pdf_placeholder(self, tmp_path):
        file = tmp_path / "test.pdf"
        file.write_bytes(b"%PDF-1.4 fake content")
        result = await _extract_text(file, "application/pdf")
        assert "PDF 文档" in result

    async def test_handles_image_placeholder(self, tmp_path):
        file = tmp_path / "test.png"
        file.write_bytes(b"fake image content")
        result = await _extract_text(file, "image/png")
        assert "图片文件" in result

    async def test_handles_empty_file(self, tmp_path):
        file = tmp_path / "empty.txt"
        file.write_text("", encoding="utf-8")
        result = await _extract_text(file, "text/plain")
        assert result == ""
