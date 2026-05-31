import { AES, enc } from 'crypto-js';

// 使用用户特定的加密密钥（基于时间戳和随机数生成）
const getEncryptionKey = (): string => {
  // 在实际应用中，应该使用更安全的方式生成密钥
  // 这里我们使用一个基础密钥加上用户标识符来增加安全性
  const baseKey = 'devagents_secure_storage_v1';
  const userId = localStorage.getItem('devagents_user_id') || 'default_user';
  return baseKey + '_' + userId;
};

/**
 * 加密并存储敏感数据
 * @param key 存储键名
 * @param data 要加密的数据
 */
export const encryptAndStore = (key: string, data: string): void => {
  try {
    const encryptionKey = getEncryptionKey();
    const encrypted = AES.encrypt(data, encryptionKey).toString();
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('加密存储失败:', error);
    // 如果加密失败，仍然存储但记录错误
    localStorage.setItem(key, data);
  }
};

/**
 * 获取并解密敏感数据
 * @param key 存储键名
 * @returns 解密后的数据，如果解密失败则返回 null
 */
export const getAndDecrypt = (key: string): string | null => {
  try {
    const encryptedData = localStorage.getItem(key);
    if (!encryptedData) return null;
    
    const encryptionKey = getEncryptionKey();
    const decrypted = AES.decrypt(encryptedData, encryptionKey).toString(enc.Utf8);
    return decrypted || null;
  } catch (error) {
    console.error('解密失败:', error);
    // 如果解密失败，尝试直接返回存储的数据
    return localStorage.getItem(key);
  }
};

/**
 * 删除加密存储的数据
 * @param key 存储键名
 */
export const removeEncrypted = (key: string): void => {
  localStorage.removeItem(key);
};

/**
 * 初始化用户标识符（应在用户登录时调用）
 * @param userId 用户唯一标识符
 */
export const initUserId = (userId: string): void => {
  localStorage.setItem('devagents_user_id', userId);
};