"""企业级 API 密钥库 —— 使用 Fernet 加密的静态存储。

密钥在落库前用 AES-128-CBC + HMAC-SHA256（Fernet）加密。
主加密密钥通过 KEY_VAULT_SECRET 环境变量设置，必须：

  - 至少 32 字节高熵随机数据
  - 通过密钥轮换协议轮换（支持多密钥）
  - 绝不记录日志、绝不通过 API 暴露

架构：
  用户一次性配置密钥 → 服务端加密并存储 → 之后永不出服务端。
  后续 LLM 调用按 ID 引用密钥；服务端即时解密。
"""

import base64
import hashlib
import os
import platform
import uuid

from cryptography.fernet import Fernet, MultiFernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from core.infra.logging_config import get_logger

logger = get_logger(__name__)


def _derive_fernet_key(secret: str) -> bytes:
    """通过 PBKDF2 从任意长度密钥派生 32 字节 Fernet 密钥。"""
    salt = b"agent-studio-key-vault-v2"  # 静态盐 —— 熵由密钥本身提供
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return key


def _get_fernet() -> Fernet | MultiFernet:
    """获取当前主密钥的 Fernet 实例。

    若设置了 KEY_VAULT_SECRET_ROTATED，返回 MultiFernet：
    用新密钥加密，同时支持用旧密钥解密，实现零停机密钥轮换。
    """
    primary_secret = os.environ.get("KEY_VAULT_SECRET", "")
    rotated_secret = os.environ.get("KEY_VAULT_SECRET_ROTATED", "")

    if not primary_secret:
        # 兜底：从机器指纹派生（不适用于多实例部署）
        logger.warning(
            "KEY_VAULT_SECRET not set — using machine-local derivation. "
            "Keys will be unreadable on other instances."
        )
        primary_secret = _machine_fingerprint()

    primary_key = _derive_fernet_key(primary_secret)

    if rotated_secret:
        rotated_key = _derive_fernet_key(rotated_secret)
        return MultiFernet([Fernet(primary_key), Fernet(rotated_key)])

    return Fernet(primary_key)


def _machine_fingerprint() -> str:
    """从机器身份派生确定性密钥。

    使用主机名 + 文件系统 UUID 作为熵源。
    这是最后的兜底 —— 生产环境必须设置 KEY_VAULT_SECRET。
    """

    fingerprint = f"{platform.node()}-{uuid.getnode()}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()


def encrypt_api_key(plaintext: str) -> str:
    """加密 API 密钥用于数据库存储。

    返回 Fernet token（base64 编码密文 + HMAC）。
    明文密钥绝不记录日志。
    """
    if not plaintext:
        raise ValueError("API key must not be empty")
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """从数据库存储解密 API 密钥。

    若密文被篡改或加密密钥已变更，抛出 cryptography.fernet.InvalidToken。
    """
    if not ciphertext:
        raise ValueError("Ciphertext must not be empty")
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()


def mask_api_key(plaintext: str) -> str:
    """返回人可读的脱敏版本：'sk-...xyz'。

    仅显示前 3 与后 4 个字符。用于前端密钥列表与审计日志的展示。
    """
    if len(plaintext) <= 8:
        return plaintext[:2] + "***"
    return plaintext[:3] + "..." + plaintext[-4:]
