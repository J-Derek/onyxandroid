from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    downloads = relationship("Download", back_populates="user")
    queue_items = relationship("QueueItem", back_populates="user")

class Download(Base):
    __tablename__ = "downloads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    url = Column(String)
    status = Column(String) # 'completed', 'failed', 'cancelled'
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="downloads")

class QueueItem(Base):
    __tablename__ = "queue_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    url = Column(String)
    title = Column(String)
    format = Column(String)
    quality = Column(String)
    thumbnail = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="queue_items")
