import crypto from "crypto";
const algorithm = "aes-256-cbc";
const secretKey = crypto.randomBytes(32); // Generate a secure random key or use a fixed one (generate secretKey)
const iv = crypto.randomBytes(16);

function encrypt(text) {
  let cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

function decrypt(text) {
  let iv = Buffer.from(text.iv, "hex");
  let encryptedText = Buffer.from(text.encryptedData, "hex");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(secretKey),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const environment = (type, text) => {
  switch (type) {
    case "node_encryption":
      const encryptedData = encrypt(text);
      return encryptedData;
      break;
    case "node_decryption":
      const decryptedData = decrypt(text);
      return decryptedData;
      break;
    case "angular":
      const decryptedInfo = decrypt({
        iv: "your_iv_here",
        encryptedData: "your_enc",
      });
      return response.send(decryptedInfo);
      break;
    default:
      throw new Error("Invalid type provided");
  }
};

export default environment;
