from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    tag = db.Column(db.String(50), default="")       # кастомный тег
    vip = db.Column(db.Boolean, default=True)        # пока всем True
    vip_date = db.Column(db.DateTime, default=datetime.utcnow)
    private_account = db.Column(db.Boolean, default=False)    
    nsfw_allowed = db.Column(db.Boolean, default=False)  # разрешение NSFW контента

    anime_list = db.relationship(
        'UserAnime',
        backref='user',
        lazy=True,
        cascade='all, delete-orphan'
    )

class UserAnime(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey('user.id'),
        nullable=False
    )

    mal_id = db.Column(db.Integer, nullable=False)

    status = db.Column(
        db.String(20),
        default='planned'
    )

    score = db.Column(db.Integer)  # 1–10, NULL если не оценено

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    __table_args__ = (
        db.UniqueConstraint('user_id', 'mal_id', name='unique_user_anime'),
    )