from datetime import datetime

from pydantic import BaseModel


class ActionMusicSyncBase(BaseModel):
    action_id: int
    music_id: int
    sync_offset_ms: int = 0
    is_aligned: bool = False
    alignment_note: str | None = None


class ActionMusicSyncAlignRequest(BaseModel):
    action_id: int
    music_id: int
    sync_offset_ms: int
    alignment_note: str | None = None


class ActionMusicSyncOut(ActionMusicSyncBase):
    id: int
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActionMusicSyncLookupOut(BaseModel):
    action_id: int
    music_id: int
    sync_offset_ms: int
    is_aligned: bool
    alignment_note: str | None = None
    has_sync_config: bool


class ActionMusicSyncListItem(BaseModel):
    music_id: int
    music_name: str
    music_file_path: str
    sync_offset_ms: int
    is_aligned: bool
    has_sync_config: bool
