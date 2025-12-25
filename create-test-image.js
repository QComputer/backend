import fs from "fs";

// Create a proper PNG file from base64
const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Decode base64 to binary
const binaryData = Buffer.from(base64Data, "base64");

// Write to file
fs.writeFileSync("test-image.png", binaryData);

console.log("✅ Created proper PNG test image");