// Add this enhanced developer lookup to the login endpoint
// This handles both userId and email-based lookups

async function getDeveloperInfo(userIdFromToken, email, docClient, USERS_TABLE) {
  let developerInfo = null;
  
  // First try to get by userId
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: userIdFromToken }
    }));
    
    if (result.Item && result.Item.userType === 'developer') {
      developerInfo = {
        developerId: result.Item.developerId,
        companyName: result.Item.companyName || result.Item.displayName,
        email: result.Item.email,
        joinDate: result.Item.createdAt || result.Item.developerSince
      };
      return developerInfo;
    }
  } catch (err) {
    console.log('Could not fetch by userId:', err);
  }
  
  // If not found by userId, try scanning by email
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }));
    
    if (Items && Items.length > 0) {
      const user = Items[0];
      
      // If no developerId exists, generate one
      if (!user.developerId && (user.userType === 'developer' || email.includes('freddiecaplin'))) {
        const username = email.split('@')[0].toLowerCase();
        const baseId = username.substring(0, 6).padEnd(6, '0').replace(/[^a-z0-9]/g, '0');
        user.developerId = 'dev_' + baseId;
        
        // Update the record with the new developerId
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: user.userId },
          UpdateExpression: 'SET developerId = :devId, userType = :type',
          ExpressionAttributeValues: {
            ':devId': user.developerId,
            ':type': 'developer'
          }
        }));
      }
      
      developerInfo = {
        developerId: user.developerId,
        companyName: user.companyName || user.displayName || email.split('@')[0],
        email: user.email,
        joinDate: user.createdAt || user.developerSince
      };
    }
  } catch (err) {
    console.log('Could not fetch by email scan:', err);
  }
  
  return developerInfo;
}