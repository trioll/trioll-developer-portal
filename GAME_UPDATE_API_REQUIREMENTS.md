# Game Update API Requirements

## Overview
This document outlines the requirements for the `PUT /games/{gameId}` endpoint that allows developers to update their game metadata through the Trioll Developer Portal.

## Endpoint Details

### URL
```
PUT https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games/{gameId}
```

### Authentication
- **Required**: Yes
- **Method**: Bearer token in Authorization header
- **Header Format**: `Authorization: Bearer {idToken}`
- **Client Header**: `X-App-Client: developer-portal`

### Request Headers
```http
Content-Type: application/json
Authorization: Bearer {developerToken}
X-App-Client: developer-portal
Origin: https://triolldev.com
```

### Request Body
```json
{
    "name": "Updated Game Name",
    "description": "Updated game description",
    "category": "Action|Adventure|Arcade|Puzzle|Racing|Sports|Strategy|Simulation|Educational|Other",
    "status": "active|inactive",
    "thumbnailUrl": "https://dgq2nqysbn2z3.cloudfront.net/{gameId}/thumbnail.jpg" // Optional
}
```

### Response

#### Success (200 OK)
```json
{
    "success": true,
    "game": {
        "gameId": "horror-pong-1757075261334",
        "name": "Updated Game Name",
        "description": "Updated game description",
        "category": "Action",
        "status": "active",
        "developerId": "dev_c84a7e",
        "thumbnailUrl": "https://dgq2nqysbn2z3.cloudfront.net/{gameId}/thumbnail.jpg",
        "gameUrl": "https://dgq2nqysbn2z3.cloudfront.net/{gameId}/index.html",
        "updatedAt": "2025-09-06T16:30:00.000Z",
        "publishedAt": "2025-09-05T10:00:00.000Z"
    }
}
```

#### Error Responses

**401 Unauthorized**
```json
{
    "success": false,
    "message": "No authorization token provided"
}
```

**403 Forbidden**
```json
{
    "success": false,
    "message": "You can only update games you uploaded"
}
```

**404 Not Found**
```json
{
    "success": false,
    "message": "Game not found"
}
```

**400 Bad Request**
```json
{
    "success": false,
    "message": "Invalid update data"
}
```

## Lambda Function Requirements

### Function Name
`trioll-prod-games-update-api`

### Runtime
Node.js 18.x or higher

### Environment Variables
- None required (uses same configuration as existing games-api)

### IAM Role Permissions
The Lambda execution role needs:
1. **DynamoDB Permissions**:
   - `dynamodb:GetItem` on `trioll-prod-games` table
   - `dynamodb:UpdateItem` on `trioll-prod-games` table
2. **CloudWatch Logs**:
   - Standard Lambda logging permissions

### Implementation Logic

1. **Extract Game ID**: Get gameId from path parameters
2. **Validate Token**: 
   - Verify JWT token using Cognito User Pool
   - Extract developerId from token claims
3. **Verify Ownership**:
   - Get game from DynamoDB
   - Check if game.developerId matches token's developerId
   - Return 403 if not authorized
4. **Validate Updates**:
   - Ensure only allowed fields are updated
   - Validate category is from allowed list
   - Validate status is 'active' or 'inactive'
5. **Update Game**:
   - Use UpdateItem with UpdateExpression
   - Set updatedAt timestamp
   - Preserve all other fields
6. **Return Updated Game**: Send back the complete updated game object

### DynamoDB Update Expression
```javascript
const params = {
    TableName: 'trioll-prod-games',
    Key: {
        gameId: gameId
    },
    UpdateExpression: 'SET #name = :name, description = :description, category = :category, #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
        '#name': 'name',
        '#status': 'status'
    },
    ExpressionAttributeValues: {
        ':name': updates.name,
        ':description': updates.description,
        ':category': updates.category,
        ':status': updates.status,
        ':updatedAt': new Date().toISOString()
    },
    ConditionExpression: 'developerId = :developerId',
    ExpressionAttributeValues: {
        ...ExpressionAttributeValues,
        ':developerId': developerId
    },
    ReturnValues: 'ALL_NEW'
};
```

### API Gateway Configuration

1. **Resource**: `/games/{gameId}`
2. **Method**: PUT
3. **Integration**: Lambda Proxy
4. **CORS**: 
   - Allow Origin: `https://triolldev.com`
   - Allow Headers: `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-App-Client`
   - Allow Methods: `PUT,OPTIONS`

## Testing Checklist

- [ ] Developer can update their own game
- [ ] Developer cannot update another developer's game
- [ ] All fields update correctly
- [ ] Status toggle works (active/inactive)
- [ ] Thumbnail URL is preserved if not updated
- [ ] Invalid token returns 401
- [ ] Missing game returns 404
- [ ] Invalid data returns 400
- [ ] UpdatedAt timestamp is set correctly

## Security Considerations

1. **Token Validation**: Always validate JWT token with Cognito
2. **Ownership Check**: Always verify developerId matches
3. **Input Validation**: Sanitize and validate all inputs
4. **Rate Limiting**: Consider implementing rate limits
5. **Audit Trail**: Log all update attempts for security monitoring

## Frontend Integration

The frontend is already implemented and sends:
```javascript
const response = await fetch(`${AWS_CONFIG.apiEndpoint}/games/${gameId}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Origin': window.location.origin
    },
    body: JSON.stringify(updates)
});
```

## Related Infrastructure

- **DynamoDB Table**: `trioll-prod-games`
- **Cognito User Pool**: `us-east-1_cLPH2acQd`
- **Developer Portal Client**: `5joogquqr4jgukp7mncgp3g23h`
- **API Gateway**: `4ib0hvu1xj.execute-api.us-east-1.amazonaws.com`
- **Existing Lambda**: `trioll-prod-games-api` (for reference)