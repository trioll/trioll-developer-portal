# Hardcoded Values Cleanup - Impact Analysis
*Created: September 17, 2025*

## 🔍 Analysis Results

### 1. One-Time Migration Scripts (SAFE TO ARCHIVE)
These scripts were used for initial setup and data migration. They are NOT used in production:

#### **assign-historical-games.js**
- **Purpose**: One-time script to assign orphan games to your account
- **Status**: Already executed (based on your games having developer IDs)
- **Action**: ✅ **ARCHIVE** - No longer needed
- **Impact**: None - This was a one-time data migration

#### **fix-developer-ids.js**
- **Purpose**: One-time script to standardize developer IDs
- **Status**: Likely already executed
- **Action**: ✅ **ARCHIVE** - No longer needed
- **Impact**: None - This was a one-time cleanup

#### **standardize-developer-ids.js**
- **Purpose**: One-time script to ensure consistent developer ID format
- **Status**: Likely already executed
- **Action**: ✅ **ARCHIVE** - No longer needed
- **Impact**: None - This was a one-time cleanup

### 2. Production Code (NEEDS REPLACEMENT)

#### **games-api-with-developers.js** ✅ ALREADY FIXED
- **Status**: We already removed hardcoded values in our previous fix
- **Current State**: Uses database lookups instead of hardcoded values
- **Action**: None needed - already fixed

#### **users-api-with-cognito-attributes.js**
- **Purpose**: User management Lambda function
- **Hardcoded Values**: Contains email/developer ID mappings
- **Action**: ⚠️ **NEEDS UPDATE** - Replace with dynamic lookups
- **Replacement Strategy**:
  ```javascript
  // Instead of:
  const DEVELOPER_MAPPING = {
    'freddiecaplin@hotmail.com': 'dev_c84a7e'
  };
  
  // Use:
  // Dynamic lookup from database based on email
  ```

#### **games-update-api-fixed.js**
- **Contains**: JWT secret placeholder `'your-jwt-secret'`
- **Action**: ⚠️ **CRITICAL FIX** - Must use environment variable
- **Replacement**:
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || (() => {
    throw new Error('JWT_SECRET environment variable is required');
  })();
  ```

### 3. Test/Debug Files (NEEDS CLEANUP)

#### **create-comments-table.js**
- **Contains**: Test data with fake users
- **Action**: 🧹 **CLEAN** - Remove test data insertion
- **Keep**: Table creation logic
- **Remove**: Sample data insertion

## 📋 Safe Cleanup Plan

### Step 1: Archive Migration Scripts (NO RISK)
```bash
# These are one-time scripts, safe to archive
mkdir -p archive/migration-scripts-2025-09
mv backend-updates/assign-historical-games.js archive/migration-scripts-2025-09/
mv backend-updates/fix-developer-ids.js archive/migration-scripts-2025-09/
mv backend-updates/standardize-developer-ids.js archive/migration-scripts-2025-09/
mv backend-updates/deploy-assign-games.sh archive/migration-scripts-2025-09/
```

### Step 2: Fix Production Code (CAREFUL UPDATES)

#### For users-api-with-cognito-attributes.js:
1. Remove hardcoded mappings
2. Add database lookup logic
3. Test thoroughly before deploying

#### For JWT Secret:
1. Add to Lambda environment variables in AWS Console
2. Update code to require environment variable
3. Never commit actual secrets to code

### Step 3: Clean Test Data
1. Remove sample data from create-comments-table.js
2. Keep only table structure creation

## ✅ What's Safe Now

1. **Archive these files** - They are NOT used in production:
   - assign-historical-games.js
   - fix-developer-ids.js  
   - standardize-developer-ids.js
   - Related deployment scripts

2. **Already Fixed**:
   - games-api-with-developers.js (we fixed this earlier)

## ⚠️ What Needs Careful Updates

1. **users-api-with-cognito-attributes.js** - Needs dynamic lookup
2. **JWT secret in games-update-api-fixed.js** - Critical security fix
3. **Test data in create-comments-table.js** - Clean up

## 🚀 Recommended Order

1. **First**: Archive migration scripts (no risk)
2. **Second**: Fix JWT secret (security priority)
3. **Third**: Update users API to use dynamic lookups
4. **Fourth**: Clean test data
5. **Fifth**: Implement config system for frontend

## 🔒 Nothing Will Break If...

- You archive the migration scripts (they've already done their job)
- You properly replace hardcoded values with environment variables
- You test changes before deploying to production

## 🛑 Things That COULD Break If...

- You remove email/ID mappings without adding database lookups
- You deploy without setting JWT_SECRET environment variable
- You change client IDs without updating all references

The migration scripts are safe to archive immediately. The production code needs careful updates with proper replacements.