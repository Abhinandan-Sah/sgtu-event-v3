# 🧪 Multi-Event API Testing Guide

Complete step-by-step testing guide with edge cases for all multi-event APIs.

## 📋 Prerequisites

1. **Server Running**: `npm run dev`
2. **Database Setup**: `npm run setup:fresh`
3. **Tool**: Use Postman, Thunder Client, or curl
4. **Base URL**: `http://localhost:5000/api`

---

## 🔐 Step 1: Admin Authentication

### 1.1 Admin Login (Get Token)

**Endpoint**: `POST /api/admin/login`

```json
{
  "email": "admin@sgtu.ac.in",
  "password": "admin123"
}
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@sgtu.ac.in",
      "full_name": "System Admin",
      "role": "ADMIN"
    }
  }
}
```

**⚠️ Edge Cases to Test**:

1. **Wrong Password**
```json
{ "email": "admin@sgtu.ac.in", "password": "wrongpass" }
// Expected: 401 - Invalid credentials
```

2. **Non-existent Email**
```json
{ "email": "fake@sgtu.ac.in", "password": "admin123" }
// Expected: 401 - Invalid credentials
```

3. **Missing Fields**
```json
{ "email": "admin@sgtu.ac.in" }
// Expected: 400 - Password required
```

4. **Invalid Email Format**
```json
{ "email": "notanemail", "password": "admin123" }
// Expected: 400 - Invalid email format
```

**📝 Save the token** - You'll need it for all protected routes!

---

## 👥 Step 2: Event Manager Management

### 2.1 Create Event Manager

**Endpoint**: `POST /api/admin/event-managers`  
**Auth**: Required (Bearer Token)

**Headers**:
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "tech.fest@sgtu.edu",
  "password": "TechFest@123",
  "full_name": "Tech Fest Coordinator",
  "phone": "9876543210",
  "department": "Computer Science"
}
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Event manager created successfully",
  "data": {
    "id": "uuid",
    "email": "tech.fest@sgtu.edu",
    "full_name": "Tech Fest Coordinator",
    "phone": "9876543210",
    "department": "Computer Science",
    "is_approved_by_admin": true,
    "is_active": true,
    "created_at": "2024-11-24T10:30:00.000Z"
  }
}
```

**⚠️ Edge Cases to Test**:

1. **Duplicate Email**
```json
// Create same manager twice
// Expected: 409 - Email already exists
```

2. **Missing Required Fields**
```json
{ "email": "test@sgtu.edu" }
// Expected: 400 - Missing required fields
```

3. **Invalid Email Format**
```json
{ "email": "notanemail", "password": "pass", "full_name": "Test" }
// Expected: 400 - Invalid email format
```

4. **Weak Password**
```json
{ "email": "test@sgtu.edu", "password": "123", "full_name": "Test" }
// Expected: 400 - Password too short (min 8 chars)
```

5. **No Authorization Header**
```
Remove Authorization header
// Expected: 401 - No token provided
```

6. **Invalid Token**
```
Authorization: Bearer invalid_token_here
// Expected: 401 - Invalid token
```

7. **Non-Admin User** (if you have student/volunteer tokens)
```
Use student/volunteer token
// Expected: 403 - Access denied
```

### 2.2 Get All Event Managers

**Endpoint**: `GET /api/admin/event-managers`  
**Auth**: Required

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "data": {
    "managers": [
      {
        "id": "uuid",
        "email": "tech.fest@sgtu.edu",
        "full_name": "Tech Fest Coordinator",
        "phone": "9876543210",
        "department": "Computer Science",
        "is_approved_by_admin": true,
        "is_active": true,
        "total_events": 0,
        "active_events": 0,
        "created_at": "2024-11-24T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**⚠️ Edge Cases**:
- No managers in DB → Returns empty array with total: 0
- Unauthenticated → 401
- Non-admin → 403

### 2.3 Get Event Manager Details

**Endpoint**: `GET /api/admin/event-managers/:id`  
**Auth**: Required

**Example**: `GET /api/admin/event-managers/550e8400-e29b-41d4-a716-446655440000`

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "tech.fest@sgtu.edu",
    "full_name": "Tech Fest Coordinator",
    "phone": "9876543210",
    "department": "Computer Science",
    "is_approved_by_admin": true,
    "is_active": true,
    "total_events": 2,
    "active_events": 1,
    "created_at": "2024-11-24T10:30:00.000Z",
    "events": [
      {
        "id": "uuid",
        "event_name": "Hackathon 2024",
        "event_type": "PAID",
        "status": "APPROVED",
        "start_date": "2024-12-01",
        "registrations_count": 50
      }
    ]
  }
}
```

**⚠️ Edge Cases**:

1. **Invalid UUID Format**
```
GET /api/admin/event-managers/invalid-id
// Expected: 400 - Invalid ID format
```

2. **Non-existent Manager**
```
GET /api/admin/event-managers/550e8400-0000-0000-0000-000000000000
// Expected: 404 - Event manager not found
```

### 2.4 Update Event Manager

**Endpoint**: `PUT /api/admin/event-managers/:id`  
**Auth**: Required

**Request Body**:
```json
{
  "full_name": "Updated Tech Fest Coordinator",
  "phone": "9999999999",
  "department": "IT Department",
  "is_active": true
}
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Event manager updated successfully",
  "data": {
    "id": "uuid",
    "email": "tech.fest@sgtu.edu",
    "full_name": "Updated Tech Fest Coordinator",
    "phone": "9999999999",
    "department": "IT Department",
    "is_active": true
  }
}
```

**⚠️ Edge Cases**:

1. **Try to Update Email**
```json
{ "email": "newemail@sgtu.edu" }
// Expected: Email should not be updatable (or 400)
```

2. **Empty Update**
```json
{}
// Expected: 400 - No fields to update
```

3. **Invalid UUID**
```
PUT /api/admin/event-managers/invalid-id
// Expected: 400 - Invalid ID format
```

### 2.5 Delete Event Manager

**Endpoint**: `DELETE /api/admin/event-managers/:id`  
**Auth**: Required

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Event manager deleted successfully"
}
```

**⚠️ Edge Cases**:

1. **Delete with Active Events**
```
Delete manager who has active events
// Expected: Should handle gracefully (cascade or prevent deletion)
```

2. **Already Deleted**
```
Delete same manager twice
// Expected: 404 - Event manager not found
```

3. **Invalid UUID**
```
DELETE /api/admin/event-managers/invalid-id
// Expected: 400 - Invalid ID format
```

---

## 🎉 Step 3: Event Management

### 3.1 Get All Events

**Endpoint**: `GET /api/admin/events`  
**Auth**: Required

**Query Parameters** (Optional):
```
?status=APPROVED
?event_type=FREE
?search=hackathon
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "event_name": "AI Workshop",
        "event_code": "AI2024",
        "event_type": "FREE",
        "status": "APPROVED",
        "category": "WORKSHOP",
        "start_date": "2024-12-01",
        "end_date": "2024-12-01",
        "price": 0,
        "max_participants": 100,
        "current_registrations": 25,
        "manager_name": "Tech Fest Coordinator",
        "manager_email": "tech.fest@sgtu.edu"
      }
    ],
    "total": 1,
    "filters": {
      "status": "APPROVED",
      "event_type": null,
      "search": null
    }
  }
}
```

**⚠️ Edge Cases**:
- Invalid status filter → Returns empty or error
- No events → Returns empty array
- Invalid query params → Should ignore or return error

### 3.2 Get Pending Events

**Endpoint**: `GET /api/admin/events/pending`  
**Auth**: Required

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "data": {
    "pending_events": [
      {
        "id": "uuid",
        "event_name": "New Hackathon",
        "event_type": "PAID",
        "price": 500,
        "manager_name": "Tech Fest Coordinator",
        "submitted_at": "2024-11-24T12:00:00.000Z",
        "days_pending": 0
      }
    ],
    "total": 1
  }
}
```

**⚠️ Edge Cases**:
- No pending events → Returns empty array with total: 0

### 3.3 Get Event Details

**Endpoint**: `GET /api/admin/events/:id`  
**Auth**: Required

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_name": "AI Workshop",
    "event_code": "AI2024",
    "event_type": "FREE",
    "status": "APPROVED",
    "description": "Learn AI basics...",
    "category": "WORKSHOP",
    "start_date": "2024-12-01",
    "end_date": "2024-12-01",
    "price": 0,
    "max_participants": 100,
    "current_registrations": 25,
    "registration_start_date": "2024-11-20",
    "registration_end_date": "2024-11-30",
    "venue": "Main Auditorium",
    "is_visible": true,
    "manager": {
      "id": "uuid",
      "email": "tech.fest@sgtu.edu",
      "full_name": "Tech Fest Coordinator"
    },
    "registrations": [
      {
        "student_name": "John Doe",
        "student_email": "john@sgtu.ac.in",
        "registration_status": "CONFIRMED",
        "payment_status": "COMPLETED"
      }
    ]
  }
}
```

**⚠️ Edge Cases**:

1. **Invalid Event ID**
```
GET /api/admin/events/invalid-id
// Expected: 400 - Invalid ID format
```

2. **Non-existent Event**
```
GET /api/admin/events/550e8400-0000-0000-0000-000000000000
// Expected: 404 - Event not found
```

### 3.4 Approve Event

**Endpoint**: `POST /api/admin/events/:id/approve`  
**Auth**: Required

**Request Body** (Optional):
```json
{
  "admin_notes": "Approved for December slot"
}
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Event approved successfully",
  "data": {
    "id": "uuid",
    "event_name": "AI Workshop",
    "status": "APPROVED",
    "approved_at": "2024-11-24T14:00:00.000Z",
    "admin_notes": "Approved for December slot"
  }
}
```

**⚠️ Edge Cases**:

1. **Already Approved Event**
```
Approve same event twice
// Expected: 400 - Event already approved
```

2. **Rejected Event**
```
Approve a rejected event
// Expected: 400 - Cannot approve rejected event (or allow re-approval)
```

3. **Cancelled Event**
```
Approve a cancelled event
// Expected: 400 - Cannot approve cancelled event
```

### 3.5 Reject Event

**Endpoint**: `POST /api/admin/events/:id/reject`  
**Auth**: Required

**Request Body**:
```json
{
  "rejection_reason": "Insufficient details provided"
}
```

**Expected Response** (✅ Success):
```json
{
  "success": true,
  "message": "Event rejected successfully",
  "data": {
    "id": "uuid",
    "event_name": "AI Workshop",
    "status": "REJECTED",
    "rejected_at": "2024-11-24T14:00:00.000Z",
    "rejection_reason": "Insufficient details provided"
  }
}
```

**⚠️ Edge Cases**:

1. **Missing Rejection Reason**
```json
{}
// Expected: 400 - Rejection reason required
```

2. **Already Rejected**
```
Reject same event twice
// Expected: 400 - Event already rejected
```

3. **Already Approved Event**
```
Reject an approved event
// Expected: 400 - Cannot reject approved event (or allow status change)
```

---

## 🧪 Step 4: Integration Testing Scenarios

### Scenario 1: Complete Event Manager Workflow

```bash
# 1. Admin Login
POST /api/admin/login

# 2. Create Event Manager
POST /api/admin/event-managers
{
  "email": "cultural@sgtu.edu",
  "password": "Cultural@123",
  "full_name": "Cultural Head",
  "phone": "9876543210"
}

# 3. Verify Manager Created
GET /api/admin/event-managers

# 4. Get Manager Details
GET /api/admin/event-managers/{manager_id}

# 5. Event Manager Creates Event (use event manager token)
POST /api/event-manager/login
POST /api/event-manager/events

# 6. Admin Views Pending Events
GET /api/admin/events/pending

# 7. Admin Approves Event
POST /api/admin/events/{event_id}/approve

# 8. Verify Event Status
GET /api/admin/events/{event_id}
```

### Scenario 2: Error Handling Flow

```bash
# 1. Try Without Token
GET /api/admin/event-managers
# Expected: 401

# 2. Try With Invalid Token
Authorization: Bearer invalid_token
GET /api/admin/event-managers
# Expected: 401

# 3. Try Creating Duplicate Manager
POST /api/admin/event-managers (same email twice)
# Expected: 409

# 4. Try Accessing Non-existent Resource
GET /api/admin/events/00000000-0000-0000-0000-000000000000
# Expected: 404

# 5. Try Malformed Request
POST /api/admin/event-managers
{ "invalid": "data" }
# Expected: 400
```

### Scenario 3: Permission Testing

```bash
# 1. Create Student Account
# 2. Login as Student
POST /api/student/login

# 3. Try Accessing Admin Route with Student Token
Authorization: Bearer student_token
GET /api/admin/event-managers
# Expected: 403 - Access denied

# 4. Try Creating Event Manager with Student Token
POST /api/admin/event-managers
# Expected: 403 - Access denied
```

---

## 📊 Step 5: Database Validation

After each operation, verify in the database:

```sql
-- Check Event Managers
SELECT * FROM event_managers;

-- Check Events
SELECT * FROM events;

-- Check Permissions
SELECT * FROM event_permissions;

-- Check Event with Manager Details
SELECT e.*, em.full_name as manager_name 
FROM events e 
JOIN event_managers em ON e.created_by = em.id;
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "No token provided"
**Solution**: Add Authorization header with Bearer token

### Issue 2: "Invalid token"
**Solution**: Token might be expired or malformed. Login again to get fresh token

### Issue 3: "Access denied"
**Solution**: Make sure you're using admin token, not student/volunteer

### Issue 4: 500 Internal Server Error
**Solution**: Check server logs. Usually database connection or missing fields

### Issue 5: "Event manager not found"
**Solution**: Verify the UUID is correct and manager exists in database

---

## ✅ Testing Checklist

### Authentication
- [ ] Admin can login with correct credentials
- [ ] Login fails with wrong password
- [ ] Login fails with non-existent email
- [ ] Token is returned on successful login
- [ ] Token works for protected routes

### Event Manager CRUD
- [ ] Create event manager with all fields
- [ ] Create fails with duplicate email
- [ ] Create fails with missing required fields
- [ ] Get all event managers returns list
- [ ] Get specific manager returns details
- [ ] Update manager updates fields
- [ ] Delete manager removes from database
- [ ] Deleted manager cannot be accessed

### Event Management
- [ ] Get all events returns list
- [ ] Filter events by status works
- [ ] Get pending events returns only pending
- [ ] Get event details shows full info
- [ ] Approve event changes status
- [ ] Reject event with reason works
- [ ] Cannot approve already approved event
- [ ] Cannot reject already rejected event

### Security
- [ ] Routes without token return 401
- [ ] Routes with invalid token return 401
- [ ] Non-admin users cannot access admin routes
- [ ] Expired tokens are rejected

### Edge Cases
- [ ] Invalid UUID format returns 400
- [ ] Non-existent resources return 404
- [ ] Malformed JSON returns 400
- [ ] Empty request bodies handled correctly
- [ ] Very long strings truncated or rejected
- [ ] Special characters in names handled
- [ ] SQL injection attempts blocked

---

## 🎯 Priority Test Order

1. **High Priority** (Must Test First):
   - Admin login
   - Create event manager
   - Get all event managers
   - Approve/reject events

2. **Medium Priority**:
   - Update event manager
   - Delete event manager
   - Get event details
   - Filter events

3. **Low Priority** (Nice to Have):
   - Edge cases
   - Permission testing
   - Malformed requests

---

## 📝 Test Results Template

Create a spreadsheet or document tracking:

| API Endpoint | Method | Test Case | Expected | Actual | Status | Notes |
|--------------|--------|-----------|----------|--------|--------|-------|
| /admin/login | POST | Valid credentials | 200 + token | | ✅/❌ | |
| /admin/event-managers | POST | Create manager | 201 | | ✅/❌ | |
| /admin/event-managers | POST | Duplicate email | 409 | | ✅/❌ | |

---

**Good luck testing! 🚀**
