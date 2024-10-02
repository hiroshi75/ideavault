import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.urandom(24)
    app.config['SESSION_TYPE'] = 'filesystem'

    db.init_app(app)

    with app.app_context():
        from models import Note, Tag, User
        db.create_all()

    from routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app

app = create_app()
