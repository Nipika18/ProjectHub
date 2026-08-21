from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, get_current_admin_user, check_is_project_manager_or_admin
from backend.app.models import Milestone, Project, User, ProjectMember, Document, UserStory
from backend.app import schemas
from backend.app.api.auth import log_activity
from backend.app.services.storage import storage_service

router = APIRouter(prefix="/api/milestones", tags=["milestones"])

@router.post("", response_model=schemas.Milestone, status_code=status.HTTP_201_CREATED)
def create_milestone(
    milestone_in: schemas.MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a milestone inside a project and logs it."""
    check_is_project_manager_or_admin(db, current_user, milestone_in.project_id)

    # Check if project exists
    project = db.query(Project).filter(Project.id == milestone_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Prevent duplicate milestone titles within the same project
    existing = db.query(Milestone).filter(
        Milestone.project_id == milestone_in.project_id,
        Milestone.title.ilike(milestone_in.title.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A milestone named '{milestone_in.title.strip()}' already exists in this project.")

    new_milestone = Milestone(
        title=milestone_in.title,
        description=milestone_in.description,
        due_date=milestone_in.due_date,
        project_id=milestone_in.project_id,
        status="pending",
        priority="Medium",
        reporter_id=current_user.id
    )
    db.add(new_milestone)
    db.commit()
    db.refresh(new_milestone)

    log_activity(
        db,
        current_user.id,
        "create_milestone",
        f"Created milestone: '{new_milestone.title}' under project '{project.name}' (Milestone ID: {new_milestone.id})"
    )
    return new_milestone

@router.get("/project/{project_id}", response_model=List[schemas.Milestone])
def list_project_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all milestones associated with a specific project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not current_user.is_admin:
        is_owner = project.owner_id == current_user.id
        is_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id
        ).first() is not None
        if not is_owner and not is_member:
            raise HTTPException(status_code=403, detail="You do not have access to this project.")

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.due_date.asc()).all()

    # Enrich with assignee and reporter names
    users_map = {u.id: u.full_name for u in db.query(User.id, User.full_name).all()}
    for m in milestones:
        m.assignee_name = users_map.get(m.assignee_id)
        m.reporter_name = users_map.get(m.reporter_id)

    return milestones
@router.put("/{milestone_id}", response_model=schemas.Milestone)
def update_milestone(
    milestone_id: int,
    milestone_in: schemas.MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates a milestone's title, description, due date, or status."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    from backend.app.core.security import check_is_project_member_or_admin
    check_is_project_member_or_admin(db, current_user, milestone.project_id)

    old_status = milestone.status
    if milestone_in.title is not None:
        # Prevent duplicate milestone titles within the same project
        existing = db.query(Milestone).filter(
            Milestone.project_id == milestone.project_id,
            Milestone.title.ilike(milestone_in.title.strip()),
            Milestone.id != milestone_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"A milestone named '{milestone_in.title.strip()}' already exists in this project.")
        milestone.title = milestone_in.title
    if milestone_in.description is not None:
        milestone.description = milestone_in.description
    if milestone_in.due_date is not None:
        milestone.due_date = milestone_in.due_date
    if milestone_in.status is not None:
        milestone.status = milestone_in.status
    if milestone_in.priority is not None:
        milestone.priority = milestone_in.priority
    # For assignee_id and reporter_id, allow explicit null to unassign
    if "assignee_id" in milestone_in.model_fields_set:
        milestone.assignee_id = milestone_in.assignee_id
    if "reporter_id" in milestone_in.model_fields_set:
        milestone.reporter_id = milestone_in.reporter_id

    db.commit()
    db.refresh(milestone)

    log_msg = f"Updated milestone '{milestone.title}'."
    if old_status != milestone.status:
        log_msg += f" Changed status from '{old_status}' to '{milestone.status}'."

    log_activity(db, current_user.id, "update_milestone", log_msg)
    return milestone

@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a milestone. Documents and user stories linked to it will be permanently deleted."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    check_is_project_manager_or_admin(db, current_user, milestone.project_id)

    # Auto-purge associated documents (and their physical files)
    docs = db.query(Document).filter(Document.milestone_id == milestone_id).all()
    for doc in docs:
        storage_service.delete_file(doc.file_path)
        db.delete(doc)

    # Auto-purge associated user stories
    stories = db.query(UserStory).filter(UserStory.milestone_id == milestone_id).all()
    for story in stories:
        db.delete(story)

    title = milestone.title
    db.delete(milestone)
    db.commit()

    log_activity(
        db,
        current_user.id,
        "delete_milestone",
        f"Deleted milestone: '{title}' (Milestone ID: {milestone_id})"
    )
    return None
