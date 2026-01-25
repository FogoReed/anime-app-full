import os
from dotenv import load_dotenv

load_dotenv()  # загружаем .env

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")  # для dev, заменяется на prod
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URI", "sqlite:///anime_app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
