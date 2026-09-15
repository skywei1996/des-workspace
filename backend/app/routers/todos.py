from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database

router = APIRouter(
    prefix="/todos",
    tags=["todos"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Todo)
def create_todo(todo: schemas.TodoCreate, db: Session = Depends(database.get_db)):
    db_todo = models.Todo(**todo.dict())
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.post("/batch/", response_model=List[schemas.Todo])
def create_todos_batch(todos: List[schemas.TodoCreate], db: Session = Depends(database.get_db)):
    db_todos = []
    for todo in todos:
        db_todo = models.Todo(**todo.dict())
        db.add(db_todo)
        db_todos.append(db_todo)
    db.commit()
    for t in db_todos:
        db.refresh(t)
    return db_todos

@router.get("/list/{chat_id}", response_model=List[schemas.Todo])
def read_todos(chat_id: int, db: Session = Depends(database.get_db)):
    todos = db.query(models.Todo).filter(models.Todo.chat_id == chat_id).all()
    return todos

@router.put("/{todo_id}", response_model=schemas.Todo)
def update_todo(todo_id: int, todo: schemas.TodoCreate, db: Session = Depends(database.get_db)):
    db_todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if db_todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    for key, value in todo.dict().items():
        setattr(db_todo, key, value)
    
    db.commit()
    db.refresh(db_todo)
    return db_todo
