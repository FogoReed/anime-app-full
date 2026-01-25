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