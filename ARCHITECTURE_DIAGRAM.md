# Developer Portal Authentication Architecture

## Visual Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         triolldev.com                           │
│                    (Developer Portal Website)                   │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
                │ 1. PIN Entry            │ 5. Upload Games
                │    (477235)             │    with Auth
                ▼                         ▼
┌───────────────────────────┐   ┌────────────────────────────────┐
│      PIN Protection       │   │        AWS S3 Bucket           │
│   (First Security Layer)  │   │  trioll-prod-games-us-east-1   │
└───────────┬───────────────┘   │  • CORS for triolldev.com      │
            │                    │  • Developer role access       │
            │ 2. Show Auth       └────────────────────────────────┘
            ▼                              ▲
┌───────────────────────────┐             │ 6. Store with
│   Developer Auth Screen   │             │    developerId
│  • Login with Email/Pass  │             │
│  • Signup with Company    │             │
└───────────┬───────────────┘             │
            │                              │
            │ 3. Authenticate              │
            ▼                              │
┌───────────────────────────────────────────────────────────────┐
│                     AWS Cognito User Pool                      │
│                   (us-east-1_cLPH2acQd)                       │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │   Mobile App        │    │   Developer Portal       │    │
│  │   App Client        │    │   App Client (NEW)       │    │
│  │ bft50gui77sdq2n4... │    │ trioll-developer-portal  │    │
│  └─────────────────────┘    └──────────────┬───────────┘    │
│                                            │                  │
│  ┌─────────────────────┐    ┌──────────────▼───────────┐    │
│  │  Players Group      │    │   Developers Group       │    │
│  │  (Mobile Users)     │    │   (Portal Users)         │    │
│  └─────────────────────┘    └──────────────────────────┘    │
└───────────────┬───────────────────────────┬───────────────────┘
                │                           │
                │ 4. Get JWT Token          │
                │    with developerId       │
                ▼                           ▼
┌───────────────────────────┐   ┌────────────────────────────────┐
│   API Gateway             │   │      DynamoDB Tables           │
│ 4ib0hvu1xj.execute-api... │   │                                │
│                           │   │  trioll-prod-users:            │
│ • /developers/register    │───┤  • userType: 'developer'       │
│ • /developers/login       │   │  • developerId: 'dev_xxxxx'    │
│ • /developers/profile     │   │  • companyName                 │
│ • /developers/games       │   │                                │
│ • POST /games (with auth) │   │  trioll-prod-games:            │
└───────────┬───────────────┘   │  • developerId (NEW)           │
            │                    │  • developerEmail (NEW)        │
            │                    │  • GSI: developerId-index      │
            ▼                    └────────────────────────────────┘
┌───────────────────────────┐
│    Lambda Functions       │
│                           │
│ • users-api.js            │
│ • games-api.js            │
│                           │
│ ENV VARS:                 │
│ • DEVELOPER_APP_CLIENT_ID │
│ • ALLOWED_ORIGINS         │
└───────────────────────────┘
```

## Authentication Flow

```
Developer Portal User Journey:
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Visit triolldev.com
        │
        ▼
2. Enter PIN: 477235
        │
        ▼
3. Choose: [Login] or [Sign Up]
        │
        ├─── Sign Up ───┐
        │               ▼
        │         Enter Details:
        │         • Email
        │         • Password  
        │         • Company Name
        │               │
        │               ▼
        │         Verify Email
        │               │
        └───────────────┘
                │
                ▼
4. Login with Credentials
        │
        ▼
5. Receive JWT Token with:
   • sub (user ID)
   • custom:developer_id (dev_xxxxx)
   • custom:company_name
   • cognito:groups ["developers"]
        │
        ▼
6. Access Portal Features:
   • Upload Games (auto-tagged)
   • View Dashboard
   • Track Analytics
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP DOMAIN                        │
│                                                             │
│  • App Client: bft50gui77sdq2n4lcio4onql                  │
│  • IAM Role: trioll-auth-role                              │
│  • User Type: 'player'                                     │
│  • Access: Play games, user features                       │
└─────────────────────────────────────────────────────────────┘
                            ╱│╲
                     SECURITY BOUNDARY
                            ╲│╱
┌─────────────────────────────────────────────────────────────┐
│                  DEVELOPER PORTAL DOMAIN                    │
│                                                             │
│  • App Client: trioll-developer-portal-client (NEW)        │
│  • IAM Role: trioll-developer-portal-role (NEW)            │
│  • User Type: 'developer'                                  │
│  • Access: Upload games, view analytics                    │
│  • Extra Gate: PIN protection                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Separations

| Component | Mobile App | Developer Portal |
|-----------|------------|------------------|
| URL | Mobile App | triolldev.com |
| App Client | `bft50gui...` | `trioll-developer-portal-client` |
| IAM Role | `trioll-auth-role` | `trioll-developer-portal-role` |
| User Type | `player` | `developer` |
| First Auth | Optional guest | Required PIN |
| Second Auth | Email/Pass | Email/Pass |
| Permissions | Play games | Upload games |
| Token Prefix | `player_` | `dev_` |

This architecture ensures complete separation between the mobile app and developer portal while reusing the core AWS infrastructure efficiently.