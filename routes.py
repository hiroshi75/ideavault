from flask import Blueprint, jsonify, request, render_template, session
from models import db, Note, Tag, User
from werkzeug.security import generate_password_hash, check_password_hash
from bleach import clean

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/register', methods=['POST'])
def register():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user:
        return jsonify({'error': 'Username already exists'}), 400
    user = User.query.filter_by(email=data['email']).first()
    if user:
        return jsonify({'error': 'Email already exists'}), 400
    new_user = User(username=data['username'], email=data['email'])
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify(new_user.to_dict()), 201

@main.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and user.check_password(data['password']):
        session['user_id'] = user.id
        return jsonify(user.to_dict()), 200
    return jsonify({'error': 'Invalid username or password'}), 401

@main.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return '', 204

@main.route('/api/notes', methods=['GET'])
def get_notes():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    notes = Note.query.filter_by(user_id=session['user_id']).all()
    return jsonify([note.to_dict() for note in notes])

@main.route('/api/notes', methods=['POST'])
def create_note():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    new_note = Note(
        title=data['title'],
        content=clean(data['content'], tags=['p', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'blockquote', 'ol', 'ul', 'li', 'a'], attributes={'a': ['href']}),
        user_id=session['user_id']
    )
    
    for tag_name in data.get('tags', []):
        tag = Tag.query.filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.session.add(tag)
        new_note.tags.append(tag)
    
    db.session.add(new_note)
    db.session.commit()
    return jsonify(new_note.to_dict()), 201

@main.route('/api/notes/<int:note_id>', methods=['GET'])
def get_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify(note.to_dict())

@main.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    note.title = data['title']
    note.content = clean(data['content'], tags=['p', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'blockquote', 'ol', 'ul', 'li', 'a'], attributes={'a': ['href']})
    
    note.tags.clear()
    for tag_name in data.get('tags', []):
        tag = Tag.query.filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.session.add(tag)
        note.tags.append(tag)
    
    db.session.commit()
    return jsonify(note.to_dict())

@main.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    db.session.delete(note)
    db.session.commit()
    return '', 204

@main.route('/api/tags', methods=['GET'])
def get_tags():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    tags = Tag.query.join(Tag.notes).filter(Note.user_id == session['user_id']).all()
    return jsonify([tag.to_dict() for tag in tags])
