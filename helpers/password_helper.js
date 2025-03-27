import crypto from "crypto";

// Secret key for encryption and decryption
const SECRET_KEY =
  process.env.HASHIDS_SALT || "ETdSaiEj16XNo6dMW4aYAf9aQJSIpUeX"; // Use a secure and unique key
const IV = crypto.randomBytes(16); // Initialization vector for AES

// Function to encrypt the password
const encryptPassword = (password) => {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET_KEY, "utf8"),
    IV
  );
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: IV.toString("hex"), encryptedPassword: encrypted };
};

// Function to decrypt the password
const decryptPassword = (encryptedPassword, iv) => {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET_KEY, "utf8"),
    Buffer.from(iv, "hex")
  );
  let decrypted = decipher.update(encryptedPassword, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

export { encryptPassword, decryptPassword };
