from flask import Blueprint, jsonify, request, render_template, session
from models import db, Note, Tag, User, SharedNotes
from werkzeug.security import generate_password_hash, check_password_hash
from bleach import clean
from sqlalchemy import or_

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
    user = User.query.get(session['user_id'])
    owned_notes = Note.query.filter_by(user_id=session['user_id']).all()
    shared_notes = user.shared_notes
    all_notes = owned_notes + shared_notes
    return jsonify([note.to_dict() for note in all_notes])

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
    if note.user_id != session['user_id'] and session['user_id'] not in [user.id for user in note.shared_with]:
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

@main.route('/api/search', methods=['GET'])
def search_notes():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    user = User.query.get(session['user_id'])
    owned_notes = Note.query.filter(
        Note.user_id == session['user_id'],
        or_(
            Note.title.ilike(f'%{query}%'),
            Note.content.ilike(f'%{query}%'),
            Note.tags.any(Tag.name.ilike(f'%{query}%'))
        )
    ).all()
    
    shared_notes = Note.query.filter(
        Note.shared_with.contains(user),
        or_(
            Note.title.ilike(f'%{query}%'),
            Note.content.ilike(f'%{query}%'),
            Note.tags.any(Tag.name.ilike(f'%{query}%'))
        )
    ).all()
    
    all_notes = owned_notes + shared_notes
    return jsonify([note.to_dict() for note in all_notes])

@main.route('/api/notes/<int:note_id>/share', methods=['POST'])
def share_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    user_to_share = User.query.filter_by(username=username).first()
    if not user_to_share:
        return jsonify({'error': 'User not found'}), 404
    
    if user_to_share.id == session['user_id']:
        return jsonify({'error': 'Cannot share note with yourself'}), 400
    
    if user_to_share in note.shared_with:
        return jsonify({'error': 'Note already shared with this user'}), 400
    
    shared_note = SharedNotes(note_id=note.id, user_id=user_to_share.id)
    db.session.add(shared_note)
    db.session.commit()
    
    return jsonify({'message': 'Note shared successfully'}), 200

@main.route('/api/notes/<int:note_id>/unshare', methods=['POST'])
def unshare_note(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    user_to_unshare = User.query.filter_by(username=username).first()
    if not user_to_unshare:
        return jsonify({'error': 'User not found'}), 404
    
    shared_note = SharedNotes.query.filter_by(note_id=note.id, user_id=user_to_unshare.id).first()
    if not shared_note:
        return jsonify({'error': 'Note is not shared with this user'}), 400
    
    db.session.delete(shared_note)
    db.session.commit()
    
    return jsonify({'message': 'Note unshared successfully'}), 200

@main.route('/api/shared_users/<int:note_id>', methods=['GET'])
def get_shared_users(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    note = Note.query.get_or_404(note_id)
    if note.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    shared_users = [user.to_dict() for user in note.shared_with]
    return jsonify(shared_users), 200
