from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, get_current_admin_user
from backend.app.models import User, Project, ProjectMember, Task, UserStory
from backend.app import schemas

router = APIRouter(prefix="/api/projects/{project_id}/team", tags=["team"])


@router.post("", response_model=schemas.ProjectMember, status_code=status.HTTP_201_CREATED)
def add_team_member(
    project_id: int,
    request: schemas.ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Adds a registered user to a project team with a specific role (Frontend, Backend, AI).
    Only the project owner can add members.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Admin-only check enforced via get_current_admin_user dependency

    # Validate role
    if request.role not in ["Frontend", "Backend", "AI", "Manager"]:
        raise HTTPException(status_code=400, detail="Role must be 'Frontend', 'Backend', 'AI', or 'Manager'")

    # Find the user by email
    user = db.query(User).filter(User.email == request.user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No registered user found with email '{request.user_email}'")

    # Check if already a member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"User '{user.full_name}' is already a member of this project as '{existing.role}'")

    member = ProjectMember(
        project_id=project_id,
        user_id=user.id,
        role=request.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return schemas.ProjectMember(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        user_name=user.full_name,
        user_email=user.email,
        created_at=member.created_at
    )


@router.get("", response_model=List[schemas.ProjectMember])
def get_team_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all team members for a project with their roles."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.owner_id:
        owner_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == project.owner_id
        ).first()
        if not owner_member:
            owner_member = ProjectMember(
                project_id=project_id,
                user_id=project.owner_id,
                role="Manager"
            )
            db.add(owner_member)
            db.commit()

    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append(schemas.ProjectMember(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            role=m.role,
            user_name=user.full_name if user else "Unknown",
            user_email=user.email if user else "unknown",
            created_at=m.created_at
        ))

    return result


@router.post("/auto-assign", status_code=status.HTTP_200_OK)
def auto_assign_project_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Automatically assigns all unassigned tasks in the project to team members based on their roles.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Admin-only check enforced via get_current_admin_user dependency

    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    role_map = {m.role: m.user_id for m in members}

    if not role_map:
        raise HTTPException(status_code=400, detail="No team members configured to assign tasks to")

    stories = db.query(UserStory).filter(UserStory.project_id == project_id).all()
    assigned_count = 0

    for story in stories:
        for task in story.tasks:
            if not task.assigned_to and task.task_type in role_map:
                task.assigned_to = role_map[task.task_type]
                assigned_count += 1

    db.commit()
    return {"detail": f"Successfully assigned {assigned_count} tasks to team members based on their roles."}


@router.put("/{member_id}", response_model=schemas.ProjectMember)
def update_team_member(
    project_id: int,
    member_id: int,
    request: schemas.ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Updates a team member's role in the project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate role
    if request.role not in ["Frontend", "Backend", "AI", "Manager"]:
        raise HTTPException(status_code=400, detail="Role must be 'Frontend', 'Backend', 'AI', or 'Manager'")

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    old_role = member.role
    member.role = request.role
    db.commit()
    db.refresh(member)

    # If the role changed, unassign the user from tasks matching their old role,
    # and then run auto-assign for all project members.
    if old_role != member.role:
        story_ids = [s.id for s in db.query(UserStory).filter(UserStory.project_id == project_id).all()]
        if story_ids:
            # Unassign user from old role tasks
            db.query(Task).filter(
                Task.story_id.in_(story_ids),
                Task.assigned_to == member.user_id,
                Task.task_type == old_role
            ).update({Task.assigned_to: None}, synchronize_session="fetch")
            db.commit()
            
            # Re-run auto assignment for all members in the project
            members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
            role_map = {m.role: m.user_id for m in members}
            if role_map:
                stories = db.query(UserStory).filter(UserStory.project_id == project_id).all()
                for story in stories:
                    for task in story.tasks:
                        if not task.assigned_to and task.task_type in role_map:
                            task.assigned_to = role_map[task.task_type]
                db.commit()

    user = db.query(User).filter(User.id == member.user_id).first()
    return schemas.ProjectMember(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        role=member.role,
        user_name=user.full_name if user else "Unknown User",
        user_email=user.email if user else "",
        created_at=member.created_at
    )


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Removes a member from the project team. Unassigns their tasks."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Admin-only check enforced via get_current_admin_user dependency

    member = db.query(ProjectMember).filter(
        ProjectMember.id == member_id,
        ProjectMember.project_id == project_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Unassign all tasks assigned to this user in this project
    story_ids = [s.id for s in db.query(UserStory).filter(UserStory.project_id == project_id).all()]
    if story_ids:
        db.query(Task).filter(
            Task.story_id.in_(story_ids),
            Task.assigned_to == member.user_id
        ).update({Task.assigned_to: None}, synchronize_session="fetch")

    db.delete(member)
    db.commit()
    return None


# =====================================================================
# My Tasks - Developer's personal task dashboard
# =====================================================================
my_tasks_router = APIRouter(prefix="/api/my-tasks", tags=["my-tasks"])


@my_tasks_router.get("", response_model=List[schemas.MyTask])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all tasks assigned to the currently logged-in user across all projects.
    This powers the developer's personal task dashboard.
    """
    tasks = db.query(Task).filter(Task.assigned_to == current_user.id).order_by(Task.created_at.desc()).all()

    result = []
    for task in tasks:
        story = db.query(UserStory).filter(UserStory.id == task.story_id).first()
        if not story:
            continue
        project = db.query(Project).filter(Project.id == story.project_id).first()
        if not project:
            continue

        result.append(schemas.MyTask(
            id=task.id,
            title=task.title,
            task_type=task.task_type,
            status=task.status,
            assigned_to=task.assigned_to,
            story_id=task.story_id,
            story_title=story.title,
            project_id=project.id,
            project_name=project.name,
            created_at=task.created_at
        ))

    return result
