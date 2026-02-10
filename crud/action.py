from sqlalchemy.orm import Session
from models.action import Action

def create_action(db: Session, action: Action) -> Action:
    """
    创建标准动作记录

    :param db: 数据库会话
    :param action: 动作模型实例
    :return: 创建后的动作模型实例
    """
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

def get_action_by_id(db: Session, action_id: int):
    """
    根据 ID 获取标准动作

    :param db: 数据库会话
    :param action_id: 动作 ID
    :return: 动作模型实例 或 None
    """
    return db.query(Action).filter(Action.id == action_id).first()

def get_action_by_name(db: Session, name: str):
    """
    根据名称获取标准动作

    :param db: 数据库会话
    :param name: 动作名称
    :return: 动作模型实例 或 None
    """
    return db.query(Action).filter(Action.name == name).first()

def get_actions(db: Session, skip: int = 0, limit: int = 20):
    """
    获取标准动作列表

    :param db: 数据库会话
    :param skip: 跳过的记录数
    :param limit: 返回的最大记录数
    :return: 动作模型实例列表
    """
    return db.query(Action).offset(skip).limit(limit).all()

def update_action(db: Session, action: Action):
    """
    更新标准动作

    :param db: 数据库会话
    :param action: 已修改的动作模型实例
    :return: 更新后的动作模型实例
    """
    db.commit()
    db.refresh(action)
    return action

def delete_action(db: Session, action: Action):
    """
    删除标准动作

    :param db: 数据库会话
    :param action: 要删除的动作模型实例
    """
    db.delete(action)
    db.commit()
