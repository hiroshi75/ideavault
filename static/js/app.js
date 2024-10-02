document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const authSubmit = document.getElementById('auth-submit');
    const toggleAuth = document.getElementById('toggle-auth');
    const emailContainer = document.getElementById('email-container');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const loggedInUsername = document.getElementById('logged-in-username');
    const loginRegisterForm = document.getElementById('login-register-form');
    const appContainer = document.getElementById('app-container');

    const noteList = document.getElementById('note-list');
    const noteForm = document.getElementById('note-form');
    const noteTitle = document.getElementById('note-title');
    const noteTags = document.getElementById('note-tags');
    const submitBtn = document.getElementById('submit-btn');
    const searchInput = document.getElementById('search-input');

    let currentNoteId = null;
    let isLoggedIn = false;
    let quill;

    function initQuill() {
        quill = new Quill('#note-content', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            bounds: '#note-content'
        });
    }

    function showLoginForm() {
        loginRegisterForm.style.display = 'block';
        userInfo.style.display = 'none';
        appContainer.style.display = 'none';
        authSubmit.textContent = 'Login';
        emailContainer.style.display = 'none';
        toggleAuth.textContent = 'Register';
    }

    function showRegisterForm() {
        loginRegisterForm.style.display = 'block';
        userInfo.style.display = 'none';
        appContainer.style.display = 'none';
        authSubmit.textContent = 'Register';
        emailContainer.style.display = 'block';
        toggleAuth.textContent = 'Login';
    }

    function showUserInfo(username) {
        loginRegisterForm.style.display = 'none';
        userInfo.style.display = 'block';
        appContainer.style.display = 'block';
        loggedInUsername.textContent = username;
        isLoggedIn = true;
        initQuill();
        fetchNotes();
    }

    toggleAuth.addEventListener('click', () => {
        if (authSubmit.textContent === 'Login') {
            showRegisterForm();
        } else {
            showLoginForm();
        }
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value;

        if (authSubmit.textContent === 'Login') {
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    showUserInfo(data.username);
                }
            });
        } else {
            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    showUserInfo(data.username);
                }
            });
        }
    });

    logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
        .then(() => {
            isLoggedIn = false;
            showLoginForm();
        });
    });

    function fetchNotes() {
        if (!isLoggedIn) return;
        fetch('/api/notes')
            .then(response => response.json())
            .then(data => {
                const notes = Array.isArray(data) ? data : [];
                noteList.innerHTML = '';
                notes.forEach(note => {
                    const noteCard = createNoteCard(note);
                    noteList.appendChild(noteCard);
                });
            })
            .catch(error => {
                console.error('Error fetching notes:', error);
                noteList.innerHTML = '<p>Error fetching notes. Please try again later.</p>';
            });
    }

    function createNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card bg-white p-4 rounded-lg shadow-md mb-4';
        card.innerHTML = `
            <h3 class="text-xl font-semibold mb-2">${note.title}</h3>
            <div class="note-content mb-2">${note.content.replace(/\n/g, '<br>')}</div>
            <div class="flex flex-wrap mb-2">
                ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="flex justify-between text-sm text-gray-500">
                <span>Created: ${new Date(note.created_at).toLocaleString()}</span>
                <span>Updated: ${new Date(note.updated_at).toLocaleString()}</span>
            </div>
            <div class="mt-4">
                <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded mr-2">Edit</button>
                <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded">Delete</button>
            </div>
        `;

        const editBtn = card.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => editNote(note));

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteNote(note.id));

        return card;
    }

    function editNote(note) {
        currentNoteId = note.id;
        noteTitle.value = note.title;
        quill.root.innerHTML = note.content.replace(/\n/g, '<br>');
        noteTags.value = note.tags.join(', ');
        submitBtn.textContent = 'Update Note';
    }

    function deleteNote(noteId) {
        if (confirm('Are you sure you want to delete this note?')) {
            fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
                .then(() => {
                    fetchNotes();
                });
        }
    }

    noteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = noteTitle.value;
        const content = quill.root.innerHTML.replace(/<p><br><\/p>$/, '').replace(/<br>/g, '\n');
        const tags = noteTags.value.split(',').map(tag => tag.trim());

        const noteData = { title, content, tags };

        if (currentNoteId) {
            // Update existing note
            fetch(`/api/notes/${currentNoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            }).then(() => {
                currentNoteId = null;
                submitBtn.textContent = 'Add Note';
                fetchNotes();
            });
        } else {
            // Create new note
            fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            }).then(() => {
                fetchNotes();
            });
        }

        noteForm.reset();
        quill.root.innerHTML = '';
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const noteCards = noteList.querySelectorAll('.note-card');

        noteCards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const content = card.querySelector('.note-content').textContent.toLowerCase();
            const tags = Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent.toLowerCase());

            if (title.includes(searchTerm) || content.includes(searchTerm) || tags.some(tag => tag.includes(searchTerm))) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });

    showLoginForm();
});
