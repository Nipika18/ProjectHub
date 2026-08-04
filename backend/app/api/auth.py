from datetime import datetime, timedelta
import os
import uuid
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from fastapi.responses import HTMLResponse
from backend.app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_verification_token,
    decode_verification_token,
    get_current_user,
    get_current_admin_user
)
from backend.app.models import User, ActivityLog, ProjectMember, Project
from backend.app import schemas
from backend.app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory rate limiting tracker: { "user@softprodigy.com": { "count": 3, "lock_until": timestamp, "last_attempt": timestamp } }
FAILED_LOGIN_ATTEMPTS = {}

def get_client_ip(request: Request) -> str:
    """Extracts client IP address, checking X-Forwarded-For header for reverse proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def _get_base_url(request: Request) -> str:
    """Returns application base URL prioritizing settings.APP_URL then request headers."""
    if settings.APP_URL:
        return settings.APP_URL.rstrip('/')
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip('/')
    return "http://sprintai.softprodigy.in"

def check_rate_limit(identifier: str):
    """Enforces progressive rate limiting and account locking to prevent brute-force password guessing."""
    now = time.time()
    record = FAILED_LOGIN_ATTEMPTS.get(identifier)
    if not record:
        return
    
    # Clean up old records after 30 minutes of inactivity
    if now - record["last_attempt"] > 1800:
        del FAILED_LOGIN_ATTEMPTS[identifier]
        return

    # Check if account is locked (attempt 20+)
    if record["lock_until"] and now < record["lock_until"]:
        remaining_secs = int(record["lock_until"] - now)
        remaining_mins = (remaining_secs // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Security Alert: Account temporarily locked due to excessive failed login attempts. Please try again in {remaining_mins} minutes."
        )

def record_failed_login(identifier: str):
    """Records a failed login attempt and calculates progressive penalty/lockout."""
    now = time.time()
    record = FAILED_LOGIN_ATTEMPTS.get(identifier, {"count": 0, "lock_until": None, "last_attempt": now})
    record["count"] += 1
    record["last_attempt"] = now
    
    if record["count"] >= 20:
        # Lock account for 15 minutes (900 seconds)
        record["lock_until"] = now + 900
    
    FAILED_LOGIN_ATTEMPTS[identifier] = record

def record_successful_login(identifier: str):
    """Resets failed login attempt counter upon successful login."""
    if identifier in FAILED_LOGIN_ATTEMPTS:
        del FAILED_LOGIN_ATTEMPTS[identifier]

import requests

def get_neon_auth_url():
    url = getattr(settings, "NEON_AUTH_URL", None) or os.getenv("NEON_AUTH_URL")
    return url.rstrip('/') if url else None


def validate_corporate_domain(email: str):
    """Allows any valid email address to access or register in SprintAi."""
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address."
        )


def log_activity(db: Session, user_id: Optional[int], action: str, details: str):
    """Utility helper to record team events in the ActivityLog table."""
    log = ActivityLog(user_id=user_id, action=action, details=details)
    db.add(log)
    db.commit()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    """Issues a stateless registration token & sends verification email. Does NOT save to DB until confirmed."""
    validate_corporate_domain(user_in.email)
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists."
        )
    
    payload = {
        "action": "register",
        "email": user_in.email,
        "full_name": user_in.full_name or user_in.email.split("@")[0],
        "hashed_password": get_password_hash(user_in.password),
        "is_admin": False
    }

    # Send verification email
    try:
        from backend.app.services.email_service import send_verification_email
        origin = _get_base_url(request)
        token = create_verification_token(payload)
        verify_url = f"{origin}/api/auth/verify-email?token={token}"
        send_verification_email(user_in.email, payload["full_name"], verify_url)
    except Exception as e:
        print(f"[SprintAi] Verification email dispatch error: {e}")

    return {
        "detail": "Verification email sent! Please check your inbox and click the link to complete registration.",
        "email": user_in.email
    }

@router.get("/verify-email", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """Validates registration/invite JWT token, inserts User into DB for the FIRST time, and activates account."""
    payload = decode_verification_token(token)
    if not payload or not payload.get("email"):
        return HTMLResponse(content="""
        <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ef4444;">Verification Link Expired or Invalid</h1>
                <p>The email verification link is invalid or has expired. Please try requesting a new link or contact support.</p>
            </body>
        </html>
        """, status_code=400)

    email = payload["email"]
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # CREATE USER IN POSTGRESQL FOR THE FIRST TIME
        user = User(
            email=email,
            full_name=payload.get("full_name", email.split("@")[0]),
            hashed_password=payload.get("hashed_password"),
            is_active=True,
            is_admin=payload.get("is_admin", False)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log_activity(db, user.id, "verify_email", f"User account created & verified via email link: {email}")

        # If this was an invite with project assignment, add member record
        project_id = payload.get("project_id")
        if project_id:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                member = ProjectMember(project_id=project.id, user_id=user.id, role=payload.get("role", "Frontend"))
                db.add(member)
                from backend.app.models import Notification
                notification = Notification(user_id=user.id, title="Added to Project", message=f"You have been added to '{project.name}' as '{payload.get('role', 'Frontend')}'.")
                db.add(notification)
                db.commit()
                
                # Auto-assign tasks to the newly joined member
                from backend.app.api.team import _auto_assign_project_tasks_internal
                _auto_assign_project_tasks_internal(db, project.id)

    return HTMLResponse(content=f"""
    <html>
        <head>
            <meta http-equiv="refresh" content="3;url=/">
            <style>
                body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7fa; color: #333; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                .card {{ background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; max-width: 450px; }}
                h1 {{ color: #16a34a; margin-top: 0; }}
                p {{ color: #4b5563; line-height: 1.5; font-size: 16px; }}
                .btn {{ background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Account Created & Activated!</h1>
                <p>Your email <strong>{user.email}</strong> has been verified and your account is now active.</p>
                <p style="font-size:14px; color:#6b7280; margin-top:10px;">Redirecting you to the Login page in 3 seconds...</p>
                <a href="/" class="btn">Proceed to Log In</a>
            </div>
            <script>
                setTimeout(function() {{
                    window.location.href = "/";
                }}, 3000);
            </script>
        </body>
    </html>
    """)

@router.post("/invite", status_code=status.HTTP_201_CREATED)
def invite_user(
    invite_in: schemas.UserInvite,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Admin-only endpoint to invite/register a user. If user doesn't exist, issues a stateless invite token."""
    validate_corporate_domain(invite_in.email)
    user = db.query(User).filter(User.email == invite_in.email).first()
    
    if user:
        # User already exists in DB -> update project membership
        assigned_project = None
        if invite_in.project_id:
            project = db.query(Project).filter(Project.id == invite_in.project_id).first()
            if project:
                existing_mem = db.query(ProjectMember).filter(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id
                ).first()
                if existing_mem:
                    return {"detail": f"User '{user.full_name}' is already a member of project '{project.name}' as '{existing_mem.role}'."}
                
                member = ProjectMember(project_id=project.id, user_id=user.id, role=invite_in.role or "Frontend")
                db.add(member)
                from backend.app.models import Notification
                notification = Notification(user_id=user.id, title="Added to Project", message=f"You have been added to '{project.name}' as '{invite_in.role or 'Frontend'}'.")
                db.add(notification)
                db.commit()
                assigned_project = project.name
                
                # Auto-assign tasks to the newly joined member
                from backend.app.api.team import _auto_assign_project_tasks_internal
                _auto_assign_project_tasks_internal(db, project.id)

                try:
                    from backend.app.services.email_service import send_project_added_email
                    send_project_added_email(user.email, user.full_name, project.name, invite_in.role or "Frontend")
                    print(f"[SprintAi] Sent project assignment email to existing user {user.email}")
                except Exception as e:
                    print(f"[SprintAi] SMTP error sending project assignment email to existing user: {e}")
        return {"detail": f"Existing user '{user.full_name}' assigned to project '{assigned_project}'." if assigned_project else f"User '{user.full_name}' already exists."}

    # User does NOT exist in DB -> Create stateless invitation token
    import secrets
    pwd = invite_in.password or secrets.token_urlsafe(16)
    hashed_pwd = get_password_hash(pwd)
    
    payload = {
        "action": "invite",
        "email": invite_in.email,
        "full_name": invite_in.full_name,
        "hashed_password": hashed_pwd,
        "is_admin": False,
        "project_id": invite_in.project_id,
        "role": invite_in.role or "Frontend"
    }

    try:
        from backend.app.services.email_service import send_invite_email
        origin = _get_base_url(request)
        token = create_verification_token(payload)
        confirm_url = f"{origin}/api/auth/verify-email?token={token}"
        send_invite_email(invite_in.email, invite_in.full_name, pwd, confirm_url)
        print(f"[SprintAi] Stateless invite email sent to {invite_in.email}")
    except Exception as e:
        print(f"[SprintAi] SMTP invite email error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send invitation email. Please check server email configuration.")

    log_activity(db, current_admin.id, "register_user", f"Admin sent stateless invite to: {invite_in.full_name} ({invite_in.email})")

    return {
        "detail": f"Invitation email sent to {invite_in.email}. User account will be created when they confirm.",
        "email": invite_in.email
    }

@router.get("/users", response_model=List[schemas.User])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin and Manager endpoint to retrieve registered workspace users."""
    if current_user.is_admin:
        users = db.query(User).order_by(User.full_name.asc()).all()
        return users
        
    manager_projects = db.query(ProjectMember.project_id).filter(
        ProjectMember.user_id == current_user.id,
        ProjectMember.role == "Manager"
    ).all()
    
    if not manager_projects:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    project_ids = [p[0] for p in manager_projects]
    
    users = db.query(User).join(ProjectMember, User.id == ProjectMember.user_id).filter(
        ProjectMember.project_id.in_(project_ids)
    ).distinct().order_by(User.full_name.asc()).all()
    
    return users


@router.post("/assign-admin", status_code=status.HTTP_200_OK)
def assign_admin_role(
    req: schemas.AdminAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Endpoint to promote or demote a registered workspace user as Admin."""
    user = None
    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
    elif req.email:
        user = db.query(User).filter(User.email == req.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not current_user.is_admin:
        manager_projects = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == current_user.id,
            ProjectMember.role == "Manager"
        ).all()
        
        if not manager_projects:
            raise HTTPException(status_code=403, detail="Not authorized.")
            
        project_ids = [p[0] for p in manager_projects]
        target_in_project = db.query(ProjectMember).filter(
            ProjectMember.user_id == user.id,
            ProjectMember.project_id.in_(project_ids)
        ).first()
        
        if not target_in_project:
            raise HTTPException(status_code=403, detail="You can only manage privileges for users in your projects.")

    if user.id == current_user.id and not req.is_admin:
        raise HTTPException(status_code=400, detail="You cannot revoke your own administrator privileges.")

    if user.is_admin == req.is_admin:
        if req.is_admin:
            raise HTTPException(status_code=400, detail=f"User '{user.full_name}' is already an Administrator.")
        else:
            raise HTTPException(status_code=400, detail=f"User '{user.full_name}' is not an Administrator.")

    user.is_admin = req.is_admin
    db.commit()
    db.refresh(user)

    action_text = "promoted to Administrator" if req.is_admin else "demoted from Administrator"
    log_activity(db, current_user.id, "assign_admin", f"User '{current_user.full_name}' {action_text} user '{user.full_name}' ({user.email})")

    return {
        "detail": f"User '{user.full_name}' has been {action_text} successfully.",
        "user": user
    }


@router.post("/login", response_model=schemas.Token)
def login(login_in: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    """Logs in a user via JSON payload (email and password), using native PostgreSQL auth."""
    validate_corporate_domain(login_in.email)
    check_rate_limit(login_in.email)
    
    user = db.query(User).filter(User.email == login_in.email).first()
    
    if not user:
        record_failed_login(login_in.email)
        ip = get_client_ip(request)
        log_activity(db, None, "failed_login", f"Login attempt for non-existent account {login_in.email} [IP: {ip}] [Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}]")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please sign up first.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not verify_password(login_in.password, user.hashed_password):
        record_failed_login(login_in.email)
        ip = get_client_ip(request)
        log_activity(db, None, "failed_login", f"Incorrect password for {login_in.email} [IP: {ip}] [Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}]")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please check your inbox and verify your email address before logging in."
        )


    record_successful_login(login_in.email)
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    ip = get_client_ip(request)
    log_activity(db, user.id, "login_user", f"User logged in: {user.full_name} [IP: {ip}] [Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}]")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "refresh_token": refresh_token
    }

@router.post("/login/form", response_model=schemas.Token)
def login_form(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Logs in a user via standard OAuth2 Password Request Form, checking Supabase Auth first then local fallback."""
    validate_corporate_domain(form_data.username)
    check_rate_limit(form_data.username)
    
    user = db.query(User).filter(User.email == form_data.username).first()
    neon_auth_ok = False
    neon_url = get_neon_auth_url()
    if neon_url:
        try:
            auth_res = requests.post(
                f"{neon_url}/sign-in/email",
                json={
                    "email": form_data.username,
                    "password": form_data.password
                },
                timeout=10
            )
            if auth_res.status_code == 200:
                neon_auth_ok = True
                print(f"[SprintAi] Neon Auth login successful for {form_data.username}")
        except Exception as e:
            print(f"[SprintAi] Neon sign_in notice/error: {e}")
    
    if not neon_auth_ok:
        if not user or not verify_password(form_data.password, user.hashed_password):
            record_failed_login(form_data.username)
            ip = get_client_ip(request)
            log_activity(db, None, "failed_login", f"Failed login attempt for {form_data.username} [IP: {ip}] [Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}]")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        if not user:
            user = User(
                email=form_data.username,
                hashed_password=get_password_hash(form_data.password),
                full_name=form_data.username.split("@")[0]
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.hashed_password = get_password_hash(form_data.password)
            db.commit()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please check your inbox and verify your email address before logging in."
        )

    record_successful_login(form_data.username)
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    ip = get_client_ip(request)
    log_activity(db, user.id, "login_user", f"User logged in (form): {user.full_name} [IP: {ip}] [Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}]")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "refresh_token": refresh_token
    }

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Retrieves the profile of the currently logged-in user."""
    return current_user

@router.put("/me", response_model=schemas.User)
def update_user_me(
    user_in: schemas.UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Updates the profile of the currently logged-in user."""
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.email is not None:
        # Check if email is already taken by another user
        existing = db.query(User).filter(User.email == user_in.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_in.email
    if user_in.password is not None and user_in.password.strip():
        current_user.hashed_password = get_password_hash(user_in.password)
        
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/refresh", response_model=schemas.Token)
def refresh_token_endpoint(req: schemas.TokenRefreshRequest, db: Session = Depends(get_db)):
    """Validates a long-lived refresh token and issues a brand new access and refresh token pair without logging the user out."""
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(req.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type", "refresh")
        if email is None or token_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
        
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found or deactivated")
        
    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "user": user,
        "refresh_token": new_refresh_token
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(req: schemas.PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    """Triggers a password reset link sent via Neon Auth or local SMTP email sender."""
    validate_corporate_domain(req.email)
    neon_url = get_neon_auth_url()
    origin = _get_base_url(request)
    ip = get_client_ip(request)

    # Check if user exists in local DB
    user = db.query(User).filter(User.email == req.email).first()

    if not neon_url:
        # Local SMTP/email fallback when Neon Auth is not configured
        if user:
            token = create_verification_token({"email": user.email, "action": "password_reset"}, expires_hours=1)
            reset_url = f"{origin}/?reset-password=true&access_token={token}"
            from backend.app.services.email_service import send_password_reset_email
            send_password_reset_email(user.email, user.full_name or user.email.split("@")[0], reset_url)
            log_activity(db, user.id, "password_reset_request", f"Password reset requested for {req.email} [IP: {ip}]")
        return {"detail": "If an account exists with this email, a password reset link has been sent to your inbox."}

    # Auto-ensure user is synced in Neon Auth before triggering reset
    if user:
        try:
            requests.post(
                f"{neon_url}/sign-up/email",
                json={
                    "email": user.email,
                    "password": "TempSyncPassword123!",
                    "name": user.full_name or user.email.split("@")[0]
                },
                headers={"Origin": origin},
                timeout=5
            )
        except Exception:
            pass

    try:
        res = requests.post(
            f"{neon_url}/request-password-reset",
            json={"email": req.email, "redirectTo": f"{origin}/?recovery=true"},
            headers={"Origin": origin},
            timeout=10
        )
        print(f"[SprintAi] Password reset email triggered via Neon Auth for {req.email}: {res.status_code}")
        
        if res.status_code >= 400:
            err_msg = res.json().get("message", res.text) if "application/json" in res.headers.get("Content-Type", "") else res.text
            print(f"[SprintAi] Neon Auth error: {err_msg}")
            if "user not found" not in err_msg.lower():
                raise Exception(f"Neon API Error: {err_msg}")
                
        log_activity(db, user.id if user else None, "password_reset_request", f"Password reset requested (Neon Auth) for {req.email} [IP: {ip}]")
        return {"detail": "If an account exists with this email, a password reset link has been sent to your inbox."}
    except Exception as e:
        err_msg = str(e)
        print(f"[SprintAi] Forgot password error via Neon Auth: {err_msg}")
        raise HTTPException(
            status_code=400,
            detail=f"Could not send password reset link: {err_msg}"
        )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(req: schemas.PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    """Confirms a password reset using the token via Neon Auth or local JWT token."""
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long."
        )
    neon_url = get_neon_auth_url()
    ip = get_client_ip(request)

    if not neon_url:
        # Local JWT password reset fallback
        payload = decode_verification_token(req.access_token)
        if not payload or payload.get("action") != "password_reset":
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired password reset token."
            )
        email = payload.get("email")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        
        if verify_password(req.new_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as your current password."
            )
        
        user.hashed_password = get_password_hash(req.new_password)
        db.commit()
        log_activity(db, user.id, "password_reset_complete", f"Password reset completed for {email} [IP: {ip}]")
        return {"detail": "Password has been reset successfully. You can now log in with your new password."}
    
    try:
        # Confirm password reset with Neon Auth
        res = requests.post(
            f"{neon_url}/reset-password",
            json={
                "newPassword": req.new_password,
                "token": req.access_token
            },
            timeout=10
        )
        if res.status_code >= 400:
            err_detail = "Invalid or expired password reset token."
            try:
                err_detail = res.json().get("message", err_detail)
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=err_detail)

        # Update local password hash in PostgreSQL so local database remains in sync
        neon_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        neon_email = neon_data.get("user", {}).get("email")
        if neon_email:
            user = db.query(User).filter(User.email == neon_email).first()
            if user:
                user.hashed_password = get_password_hash(req.new_password)
                db.commit()
                print(f"[SprintAi] Local password hash updated for {neon_email}")

        log_activity(db, None, "password_reset_complete", f"Password reset completed via Neon Auth [IP: {ip}]")
        print(f"[SprintAi] Password reset successfully completed via Neon Auth")
        return {"detail": "Password has been reset successfully. You can now log in with your new password."}
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        print(f"[SprintAi] Reset password error: {err_msg}")
        raise HTTPException(
            status_code=400,
            detail=f"Could not reset password: {err_msg}"
        )



# ──────────────────────────────────────────────
#  Avatar upload endpoint
# ──────────────────────────────────────────────
AVATAR_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "avatars")

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a profile picture for the currently logged-in user."""
    # Validate MIME type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files (JPEG, PNG, WebP) are accepted.")

    # Read and validate size (max 2 MiB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 2 MB.")

    from backend.app.services.storage import storage_service
    import uuid

    ext = os.path.splitext(file.filename or "avatar.jpg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    relative_url = ""

    if storage_service.use_supabase:
        supabase_path = f"{filename}"
        try:
            # Try to delete the old avatar from Supabase if it exists
            if current_user.profile_image and "/storage/v1/object/public/" in current_user.profile_image:
                old_filename = current_user.profile_image.split("/")[-1]
                try:
                    if "documents/avatars" in current_user.profile_image:
                        storage_service.supabase.storage.from_("documents").remove([f"avatars/{old_filename}"])
                    else:
                        storage_service.supabase.storage.from_("avatars").remove([f"{old_filename}"])
                except Exception:
                    pass

            # Upload the new avatar to the dedicated public 'avatars' bucket
            storage_service.supabase.storage.from_("avatars").upload(
                supabase_path,
                contents,
                {"content-type": file.content_type}
            )
            # Use the public URL directly
            relative_url = storage_service.supabase.storage.from_("avatars").get_public_url(supabase_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload avatar to Supabase: {str(e)}")
    else:
        # Create folder if needed
        os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)
        save_path = os.path.join(AVATAR_UPLOAD_DIR, filename)

        # Delete previous avatar if exists locally
        if current_user.profile_image and current_user.profile_image.startswith("/uploads/avatars/"):
            old_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", current_user.profile_image.lstrip("/"))
            old_path = os.path.normpath(old_path)
            if os.path.isfile(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass

        # Save new file locally
        with open(save_path, "wb") as out:
            out.write(contents)

        # Relative URL served as static
        relative_url = f"/uploads/avatars/{filename}"

    # Persist to DB
    current_user.profile_image = relative_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"profile_image_url": relative_url}
