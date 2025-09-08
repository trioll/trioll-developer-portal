// Script to decode JWT token and see what's in it

const token = process.argv[2];

if (!token) {
    console.log("Usage: node decode-token.js <JWT_TOKEN>");
    process.exit(1);
}

try {
    // Split the token
    const parts = token.split('.');
    if (parts.length !== 3) {
        console.error("Invalid JWT format");
        process.exit(1);
    }
    
    // Decode header
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    console.log("\n=== JWT Header ===");
    console.log(JSON.stringify(header, null, 2));
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log("\n=== JWT Payload ===");
    console.log(JSON.stringify(payload, null, 2));
    
    // Extract developer info as Lambda would
    console.log("\n=== Developer Info Extraction ===");
    console.log("custom:developer_id:", payload['custom:developer_id'] || "NOT FOUND");
    console.log("preferred_username:", payload.preferred_username || "NOT FOUND");
    console.log("custom:company_name:", payload['custom:company_name'] || "NOT FOUND");
    console.log("website:", payload.website || "NOT FOUND");
    
    console.log("\n=== What Lambda Would Extract ===");
    const developerId = payload['custom:developer_id'] || payload.preferred_username || null;
    console.log("Developer ID:", developerId);
    
} catch (error) {
    console.error("Error decoding token:", error.message);
}