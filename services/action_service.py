from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.action import Action
from crud import action as action_crud
from schemas.action import ActionCreate, ActionUpdate

def create_action(db: Session, action_in: ActionCreate):
    """
    创建标准动作

    :param db: 数据库会话
    :param action_in: 动作创建请求数据
    :return: 创建后的动作对象
    :raises HTTPException: 如果动作名称已存在，抛出 400 错误
    """
    # 工程级保护：动作名唯一
    existing = action_crud.get_action_by_name(db, action_in.name)
    if existing:
        raise HTTPException(status_code=400, detail="Action already exists")

    action = Action(
        name=action_in.name,
        description=action_in.description,
        keypoints=action_in.keypoints
    )
    return action_crud.create_action(db, action)

def get_action(db: Session, action_id: int):
    """
    获取单个动作详情

    :param db: 数据库会话
    :param action_id: 动作 ID
    :return: 动作对象
    :raises HTTPException: 如果动作不存在，抛出 404 错误
    """
    action = action_crud.get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action

def list_actions(db: Session, skip: int = 0, limit: int = 20):
    """
    获取动作列表

    :param db: 数据库会话
    :param skip: 跳过的记录数
    :param limit: 返回的最大记录数
    :return: 动作列表
    """
    return action_crud.get_actions(db, skip, limit)

def update_action(db: Session, action_id: int, action_in: ActionUpdate):
    """
    更新动作信息

    :param db: 数据库会话
    :param action_id: 动作 ID
    :param action_in: 动作更新请求数据
    :return: 更新后的动作对象
    :raises HTTPException: 如果动作不存在，抛出 404 错误
    """
    action = get_action(db, action_id)

    if action_in.description is not None:
        action.description = action_in.description
    if action_in.keypoints is not None:
        action.keypoints = action_in.keypoints

    return action_crud.update_action(db, action)

def delete_action(db: Session, action_id: int):
    """
    删除动作

    :param db: 数据库会话
    :param action_id: 动作 ID
    :raises HTTPException: 如果动作不存在，抛出 404 错误
    """
    action = get_action(db, action_id)
    action_crud.delete_action(db, action)
