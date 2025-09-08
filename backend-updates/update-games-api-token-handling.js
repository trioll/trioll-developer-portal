// Script to update the getDeveloperFromToken function in games-api-fixed.js
// Updates it to read from standard Cognito attributes instead of custom ones

const fs = require('fs');
const path = require('path');

// New getDeveloperFromToken function that uses standard attributes
const newTokenHandler = `// Helper function to extract developer info from JWT token
const getDeveloperFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    return {
      userId: payload.sub,
      email: payload.email,
      // Map standard attributes to developer fields
      developerId: payload.preferred_username || payload['custom:developer_id'] || null,
      companyName: payload.website || payload['custom:company_name'] || null,
      userType: payload.profile || payload['custom:user_type'] || 'player',
      groups: payload['cognito:groups'] || []
    };
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};`;

// Read the current file
const filePath = path.join(__dirname, 'games-api-fixed.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the getDeveloperFromToken function
const functionStart = content.indexOf('// Helper function to extract developer info from JWT token');
const functionEnd = content.indexOf('};', functionStart) + 2;

if (functionStart !== -1 && functionEnd > functionStart) {
    content = content.substring(0, functionStart) + newTokenHandler + content.substring(functionEnd);
    
    // Write the updated file
    fs.writeFileSync(filePath, content);
    console.log('✅ Updated getDeveloperFromToken to use standard Cognito attributes');
    console.log('   - preferred_username → developer_id');
    console.log('   - website → company_name');
    console.log('   - profile → user_type');
} else {
    console.error('❌ Could not find getDeveloperFromToken function');
}

// Also update the enhanced check in handleDeveloperGames to be clearer
const enhancedCheckPattern = /if \(!developer \|\| !developer\.developerId\)/g;
const enhancedCheck = `if (!developer || !developer.developerId)`;
content = content.replace(enhancedCheckPattern, enhancedCheck);

// Save final version
fs.writeFileSync(filePath, content);

console.log('\n📝 Next steps:');
console.log('1. Deploy the updated games-api-fixed.js');
console.log('2. User needs to logout and login to get new token');
console.log('3. All endpoints should then work correctly');