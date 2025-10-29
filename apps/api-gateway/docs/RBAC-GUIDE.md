# Role-Based Access Control (RBAC) Guide

## Overview

The Conversational Clone API implements a comprehensive RBAC system that combines:
- **Roles**: User roles (user, admin)
- **Permissions**: Granular action-based permissions
- **Subscription Tiers**: Feature access based on subscription level

## Using RBAC Middleware

### 1. Require Specific Permission

```typescript
import { requirePermission } from '../middleware/rbac.middleware';

router.post('/documents', 
  authMiddleware,
  requirePermission('knowledge:write'),
  uploadDocument
);
```

### 2. Require Specific Role

```typescript
import { requireRole } from '../middleware/rbac.middleware';

router.get('/admin/users', 
  authMiddleware,
  requireRole('admin'),
  listAllUsers
);
```

### 3. Require Any of Multiple Roles

```typescript
import { requireAnyRole } from '../middleware/rbac.middleware';

router.get('/analytics', 
  authMiddleware,
  requireAnyRole(['admin', 'analyst']),
  getAnalytics
);
```

### 4. Require All Permissions

```typescript
import { requireAllPermissions } from '../middleware/rbac.middleware';

router.post('/team/invite', 
  authMiddleware,
  requireAllPermissions(['team:manage', 'user:invite']),
  inviteTeamMember
);
```

### 5. Require Subscription Tier

```typescript
import { requireSubscriptionTier } from '../middleware/rbac.middleware';

router.post('/voice/create', 
  authMiddleware,
  requireSubscriptionTier('pro'),
  createVoiceModel
);
```

## Permission Naming Convention

Permissions follow the format: `resource:action`

### Examples:
- `conversation:create` - Create conversations
- `conversation:read` - Read conversation history
- `knowledge:write` - Upload/modify knowledge base
- `voice:create` - Create voice models
- `face:create` - Create face models
- `analytics:read` - View analytics
- `team:manage` - Manage team members
- `admin:all` - Full admin access

## Subscription Tier Permissions

### Free Tier
```typescript
const freePermissions = [
  'conversation:create',
  'conversation:read',
  'knowledge:read'
];
```

**Limitations:**
- 60 minutes of conversation per day
- Read-only knowledge base
- No voice/face cloning

### Pro Tier
```typescript
const proPermissions = [
  ...freePermissions,
  'knowledge:write',
  'voice:create',
  'face:create'
];
```

**Features:**
- Unlimited conversations
- Upload documents
- Create voice models
- Create face models

### Enterprise Tier
```typescript
const enterprisePermissions = [
  ...proPermissions,
  'analytics:read',
  'team:manage'
];
```

**Features:**
- All Pro features
- Advanced analytics
- Team management
- Priority support

## Role Permissions

### User Role
- Default role for all registered users
- Permissions based on subscription tier

### Admin Role
```typescript
const adminPermissions = [
  'admin:all',
  'user:manage',
  'system:manage',
  // Plus all user permissions
];
```

**Capabilities:**
- Manage all users
- Access system settings
- View all data
- Override subscription limits

## Checking Permissions in Controllers

```typescript
import { AuthRequest } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';

export const someController = async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  
  // Check if user has specific permission
  if (!authService.hasPermission(user, 'knowledge:write')) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to write knowledge'
      }
    });
  }
  
  // Check if user has specific role
  if (!authService.hasRole(user, 'admin')) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
  }
  
  // Proceed with operation
  // ...
};
```

## Custom Permission Logic

For complex permission checks, you can implement custom logic:

```typescript
export const requireOwnership = (resourceType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user!;
    const resourceId = req.params.id;
    
    // Check if user owns the resource or is admin
    const resource = await getResource(resourceType, resourceId);
    
    if (resource.userId !== user.userId && !user.roles.includes('admin')) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only access your own resources'
        }
      });
    }
    
    next();
  };
};

// Usage
router.delete('/documents/:id', 
  authMiddleware,
  requireOwnership('document'),
  deleteDocument
);
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden - Missing Permission
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Permission denied. Required permission: knowledge:write"
  }
}
```

### 403 Forbidden - Missing Role
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. Required role: admin"
  }
}
```

### 403 Forbidden - Subscription Required
```json
{
  "error": {
    "code": "SUBSCRIPTION_REQUIRED",
    "message": "This feature requires pro subscription or higher",
    "requiredTier": "pro",
    "currentTier": "free"
  }
}
```

## Best Practices

### 1. Layer Security Checks
```typescript
// Good: Multiple layers of security
router.post('/enterprise/feature',
  authMiddleware,                      // Layer 1: Authentication
  requireSubscriptionTier('enterprise'), // Layer 2: Subscription
  requirePermission('feature:use'),     // Layer 3: Permission
  enterpriseFeatureHandler
);
```

### 2. Fail Secure
```typescript
// Good: Default to denying access
if (!user || !hasPermission(user, 'resource:action')) {
  return res.status(403).json({ error: 'Forbidden' });
}

// Bad: Default to allowing access
if (user && hasPermission(user, 'resource:action')) {
  // proceed
}
```

### 3. Check Ownership
```typescript
// Always verify user owns the resource
const document = await getDocument(id);
if (document.userId !== user.userId && !user.roles.includes('admin')) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### 4. Log Access Attempts
```typescript
// Log all permission denials for security monitoring
if (!hasPermission(user, permission)) {
  logger.warn('Permission denied', {
    userId: user.userId,
    permission,
    resource: req.path
  });
  return res.status(403).json({ error: 'Forbidden' });
}
```

### 5. Use Middleware for Common Checks
```typescript
// Good: Reusable middleware
router.use('/admin/*', requireRole('admin'));

// Bad: Repeated checks in every controller
export const adminController1 = (req, res) => {
  if (!req.user.roles.includes('admin')) { /* ... */ }
  // ...
};
```

## Testing RBAC

### Unit Tests
```typescript
describe('RBAC Middleware', () => {
  it('should allow access with correct permission', async () => {
    const req = {
      user: {
        userId: '123',
        permissions: ['knowledge:write'],
        roles: ['user']
      }
    };
    
    const middleware = requirePermission('knowledge:write');
    await middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
  
  it('should deny access without permission', async () => {
    const req = {
      user: {
        userId: '123',
        permissions: ['knowledge:read'],
        roles: ['user']
      }
    };
    
    const middleware = requirePermission('knowledge:write');
    await middleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

### Integration Tests
```typescript
describe('Document Upload', () => {
  it('should allow pro users to upload documents', async () => {
    const token = await getProUserToken();
    
    const response = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test.pdf');
    
    expect(response.status).toBe(201);
  });
  
  it('should deny free users from uploading documents', async () => {
    const token = await getFreeUserToken();
    
    const response = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test.pdf');
    
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
```

## Migration Guide

### Adding New Permissions

1. Define the permission in the auth service:
```typescript
// apps/api-gateway/src/services/auth.service.ts
private getPermissionsForUser(user: User): string[] {
  const permissions: string[] = [...];
  
  // Add new permission
  if (user.subscriptionTier === 'enterprise') {
    permissions.push('new:permission');
  }
  
  return permissions;
}
```

2. Apply the permission to routes:
```typescript
router.post('/new-feature',
  authMiddleware,
  requirePermission('new:permission'),
  newFeatureHandler
);
```

3. Update documentation and tests

### Adding New Roles

1. Add role to user creation:
```typescript
const user: User = {
  // ...
  roles: ['user', 'new-role']
};
```

2. Create role-specific middleware:
```typescript
router.get('/special-access',
  authMiddleware,
  requireRole('new-role'),
  specialHandler
);
```

3. Update JWT payload and documentation
