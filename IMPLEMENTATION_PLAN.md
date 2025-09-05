# Developer Authentication Implementation Plan

## Overview
This plan details the step-by-step implementation of developer authentication for triolldev.com, leveraging the existing Trioll infrastructure.

## Phase 1: Backend Updates (Day 1)

### 1.1 Extend Users API Lambda

Update `/Users/frederickcaplin/Desktop/Trioll Mobile App Final Version/backend-api-deployment/lambda-functions/users-api.js`:

```javascript
// Add developer registration endpoint
if (path === '/developers/register' && method === 'POST') {
  const { email, password, companyName, website } = JSON.parse(event.body);
  
  // Generate unique developer ID
  const developerId = 'dev_' + crypto.randomBytes(3).toString('hex');
  
  // Register in Cognito (reuse existing logic)
  // ... existing signup code ...
  
  // Create developer profile in DynamoDB
  const developerProfile = {
    userId,
    email,
    userType: 'developer', // NEW
    developerId: developerId, // NEW
    companyName: companyName, // NEW
    website: website || '', // NEW
    username: developerId,
    displayName: companyName,
    gamesUploaded: 0, // NEW
    totalPlays: 0, // NEW
    totalRatings: 0, // NEW
    verifiedDeveloper: false, // NEW
    developerSince: new Date().toISOString(), // NEW
    // ... rest of existing user fields
  };
}

// Add developer-specific profile endpoint
if (path === '/developers/profile' && method === 'GET') {
  // Get developer by auth token
  // Include games count and analytics
}
```

### 1.2 Update Games API Lambda

Update `/Users/frederickcaplin/Desktop/Trioll Mobile App Final Version/backend-api-deployment/lambda-functions/games-api.js`:

```javascript
// Modify handleCreateGame to include developerId
async function handleCreateGame(body, authHeaders) {
  const gameData = JSON.parse(body);
  
  // Extract developerId from JWT token
  const token = authHeaders.Authorization.split(' ')[1];
  const decoded = jwt.decode(token);
  const developerId = decoded['custom:developer_id'];
  
  const item = {
    ...existingFields,
    developerId: developerId, // NEW
    developerEmail: decoded.email, // NEW
    uploadedBy: 'developer', // NEW (vs 'admin' or 'guest')
  };
}

// Add endpoint to get games by developer
if (path === '/developers/games' && method === 'GET') {
  // Use GSI to query games by developerId
}
```

## Phase 2: Frontend Authentication UI (Day 2)

### 2.1 Replace PIN Lock Screen

Create new authentication flow in `index.html`:

```html
<!-- Replace PIN lock screen with login/signup -->
<div id="authScreen" class="auth-screen active">
  <div class="auth-container">
    <!-- Login Form -->
    <div id="loginForm" class="auth-form">
      <h2>Developer Login</h2>
      <input type="email" id="loginEmail" placeholder="Email" required>
      <input type="password" id="loginPassword" placeholder="Password" required>
      <button onclick="handleLogin()">Login</button>
      <p>New developer? <a onclick="showSignup()">Sign up</a></p>
    </div>
    
    <!-- Signup Form -->
    <div id="signupForm" class="auth-form" style="display: none;">
      <h2>Create Developer Account</h2>
      <input type="email" id="signupEmail" placeholder="Email" required>
      <input type="password" id="signupPassword" placeholder="Password (min 8 chars)" required>
      <input type="text" id="companyName" placeholder="Company/Developer Name" required>
      <input type="url" id="website" placeholder="Website (optional)">
      <label>
        <input type="checkbox" id="termsAccept" required>
        I accept the <a href="#">Terms of Service</a>
      </label>
      <button onclick="handleSignup()">Create Account</button>
      <p>Have an account? <a onclick="showLogin()">Login</a></p>
    </div>
  </div>
</div>
```

### 2.2 Add Authentication JavaScript

```javascript
// Authentication service
class AuthService {
  constructor() {
    this.apiEndpoint = AWS_CONFIG.apiEndpoint;
    this.token = localStorage.getItem('developerToken');
    this.developerInfo = JSON.parse(localStorage.getItem('developerInfo') || '{}');
  }
  
  async signup(email, password, companyName, website) {
    const response = await fetch(`${this.apiEndpoint}/developers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, companyName, website })
    });
    
    if (response.ok) {
      // Show verification message
      showVerificationScreen(email);
    }
  }
  
  async login(email, password) {
    const response = await fetch(`${this.apiEndpoint}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      // Store tokens
      localStorage.setItem('developerToken', data.tokens.idToken);
      
      // Get developer profile
      await this.loadDeveloperProfile();
      
      // Show main portal
      showMainPortal();
    }
  }
  
  async loadDeveloperProfile() {
    const response = await fetch(`${this.apiEndpoint}/developers/profile`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    const data = await response.json();
    this.developerInfo = data.developer;
    localStorage.setItem('developerInfo', JSON.stringify(this.developerInfo));
  }
}

const auth = new AuthService();
```

### 2.3 Update Upload Form

Modify the upload form to auto-populate developer information:

```javascript
// When showing upload form
function showUploadForm() {
  const developerInfo = auth.developerInfo;
  
  // Auto-fill and disable developer fields
  document.getElementById('developerName').value = developerInfo.companyName;
  document.getElementById('developerName').disabled = true;
  
  // Add developer badge
  document.getElementById('developerBadge').innerHTML = `
    <div class="developer-info-badge">
      <span>Uploading as: ${developerInfo.companyName}</span>
      <span class="developer-id">ID: ${developerInfo.developerId}</span>
    </div>
  `;
}

// Modify saveGameToDatabase to include auth
async function saveGameToDatabase(gameData) {
  const response = await fetch(`${AWS_CONFIG.apiEndpoint}/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}` // Include auth token
    },
    body: JSON.stringify(gameData)
  });
}
```

## Phase 3: Database Schema Updates (Day 3)

### 3.1 Update DynamoDB Schema

No table creation needed - extend existing tables:

1. **trioll-prod-users**:
   - Add fields: `userType`, `developerId`, `companyName`, `website`, `gamesUploaded`, `verifiedDeveloper`
   - Existing email index works for lookups

2. **trioll-prod-games**:
   - Add fields: `developerId`, `developerEmail`, `uploadedBy`
   - Create GSI: `developerId-index` (partition key: `developerId`)

### 3.2 Create GSI via AWS CLI

```bash
aws dynamodb update-table \
  --table-name trioll-prod-games \
  --attribute-definitions AttributeName=developerId,AttributeType=S \
  --global-secondary-index-updates \
  '[{
    "Create": {
      "IndexName": "developerId-index",
      "Keys": [{"AttributeName": "developerId", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"},
      "BillingMode": "PAY_PER_REQUEST"
    }
  }]' \
  --region us-east-1
```

## Phase 4: Developer Dashboard (Day 4)

### 4.1 Add Dashboard Section

```html
<!-- Developer Dashboard -->
<section id="dashboard" class="section">
  <div class="container">
    <h2>Developer Dashboard</h2>
    
    <div class="dashboard-header">
      <div class="developer-profile">
        <h3 id="dashCompanyName"></h3>
        <p>Developer ID: <code id="dashDeveloperId"></code></p>
        <p>Member since: <span id="dashMemberSince"></span></p>
      </div>
      
      <div class="quick-stats">
        <div class="stat-card">
          <h4>Games Uploaded</h4>
          <p class="stat-number" id="gamesCount">0</p>
        </div>
        <div class="stat-card">
          <h4>Total Plays</h4>
          <p class="stat-number" id="totalPlays">0</p>
        </div>
        <div class="stat-card">
          <h4>Average Rating</h4>
          <p class="stat-number" id="avgRating">0.0</p>
        </div>
      </div>
    </div>
    
    <div class="games-grid" id="developerGames">
      <!-- Developer's games will be populated here -->
    </div>
  </div>
</section>
```

### 4.2 Load Developer Games

```javascript
async function loadDeveloperDashboard() {
  // Load developer's games
  const response = await fetch(`${AWS_CONFIG.apiEndpoint}/developers/games`, {
    headers: { 'Authorization': `Bearer ${auth.token}` }
  });
  
  const data = await response.json();
  
  // Update stats
  document.getElementById('gamesCount').textContent = data.games.length;
  document.getElementById('totalPlays').textContent = data.totalPlays;
  document.getElementById('avgRating').textContent = data.averageRating.toFixed(1);
  
  // Display games
  const gamesGrid = document.getElementById('developerGames');
  data.games.forEach(game => {
    gamesGrid.innerHTML += `
      <div class="game-card">
        <img src="${game.thumbnailUrl}" alt="${game.title}">
        <h4>${game.title}</h4>
        <p>Plays: ${game.playCount}</p>
        <p>Rating: ${game.rating}/5</p>
      </div>
    `;
  });
}
```

## Phase 5: Security & Polish (Day 5)

### 5.1 Add JWT Validation

Update Lambda functions to validate JWT tokens:

```javascript
const jwt = require('jsonwebtoken');

function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid auth token');
  }
  
  const token = authHeader.split(' ')[1];
  // In production, verify with Cognito public keys
  const decoded = jwt.decode(token);
  
  if (!decoded || decoded.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }
  
  return decoded;
}
```

### 5.2 Add Email Verification UI

```javascript
// Email verification screen
function showVerificationScreen(email) {
  document.getElementById('authScreen').innerHTML = `
    <div class="verification-container">
      <h2>Verify Your Email</h2>
      <p>We've sent a verification code to ${email}</p>
      <input type="text" id="verificationCode" placeholder="Enter code" maxlength="6">
      <button onclick="verifyEmail('${email}')">Verify</button>
      <button onclick="resendCode('${email}')">Resend Code</button>
    </div>
  `;
}

async function verifyEmail(email) {
  const code = document.getElementById('verificationCode').value;
  const response = await fetch(`${AWS_CONFIG.apiEndpoint}/users/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  
  if (response.ok) {
    // Auto-login after verification
    showLogin();
  }
}
```

## Testing Plan

1. **Test Authentication Flow**:
   - Sign up with new email
   - Verify email
   - Login
   - Check developer ID generation

2. **Test Game Upload**:
   - Upload game as authenticated developer
   - Verify developerId is attached
   - Check game appears in dashboard

3. **Test Dashboard**:
   - View uploaded games
   - Verify stats are accurate
   - Test logout/login persistence

## Deployment Steps

1. **Deploy Backend Changes**:
   ```bash
   ./deploy-correct-lambda.sh  # For games API
   # Deploy users-api.js similarly
   ```

2. **Update Frontend**:
   - Replace index.html with updated version
   - Test on staging first

3. **Create GSI**:
   - Run DynamoDB update command
   - Wait for index to be active

4. **Monitor**:
   - Check CloudWatch logs
   - Monitor error rates
   - Track developer signups

## Migration Strategy

For existing games without developerId:
- Keep them as "legacy" games
- Allow claiming by email match
- Or assign to "Trioll Legacy" developer account

This implementation leverages all existing infrastructure while adding the minimal necessary components for developer authentication.