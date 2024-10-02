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

    const noteListSection = document.getElementById('note-list-section');
    const noteFormSection = document.getElementById('note-form-section');
    const noteList = document.getElementById('note-list');
    const noteForm = document.getElementById('note-form');
    const noteTitle = document.getElementById('note-title');
    const noteTags = document.getElementById('note-tags');
    const submitBtn = document.getElementById('submit-btn');
    const searchInput = document.getElementById('search-input');
    const newNoteBtn = document.getElementById('new-note-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');

    let currentNoteId = null;
    let isLoggedIn = false;
    let quill;

    function initQuill() {
        if (quill) {
            quill.destroy();
        }
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
        showNoteList();
        fetchNotes();
    }

    function showNoteList() {
        noteListSection.style.display = 'block';
        noteFormSection.style.display = 'none';
    }

    function showNoteForm() {
        noteListSection.style.display = 'none';
        noteFormSection.style.display = 'block';
        initQuill();
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
                notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
                <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded mr-2">Delete</button>
                <button class="share-btn bg-green-500 text-white px-3 py-1 rounded">Share</button>
            </div>
            ${note.shared_with.length > 0 ? `
            <div class="mt-2 text-sm text-gray-500">
                Shared with: ${note.shared_with.join(', ')}
            </div>
            ` : ''}
        `;

        const editBtn = card.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => editNote(note));

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteNote(note.id));

        const shareBtn = card.querySelector('.share-btn');
        shareBtn.addEventListener('click', () => showShareModal(note));

        return card;
    }

    function editNote(note) {
        currentNoteId = note.id;
        noteTitle.value = note.title;
        showNoteForm();
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

    function showShareModal(note) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <h3 class="text-lg font-bold mb-4">Share Note</h3>
                <input type="text" id="share-username" placeholder="Enter username" class="w-full p-2 mb-4 border rounded">
                <button id="share-submit" class="bg-blue-500 text-white px-4 py-2 rounded">Share</button>
                <button id="close-modal" class="ml-2 text-gray-500">Cancel</button>
                <div id="shared-users-list" class="mt-4"></div>
            </div>
        `;

        document.body.appendChild(modal);

        const shareSubmit = document.getElementById('share-submit');
        const closeModal = document.getElementById('close-modal');
        const sharedUsersList = document.getElementById('shared-users-list');

        function updateSharedUsersList() {
            fetch(`/api/shared_users/${note.id}`)
                .then(response => response.json())
                .then(users => {
                    sharedUsersList.innerHTML = '<h4 class="font-bold mb-2">Shared with:</h4>';
                    users.forEach(user => {
                        const userItem = document.createElement('div');
                        userItem.className = 'flex justify-between items-center mb-2';
                        userItem.innerHTML = `
                            <span>${user.username}</span>
                            <button class="unshare-btn text-red-500" data-username="${user.username}">Unshare</button>
                        `;
                        sharedUsersList.appendChild(userItem);
                    });

                    const unshareButtons = sharedUsersList.querySelectorAll('.unshare-btn');
                    unshareButtons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const username = btn.getAttribute('data-username');
                            unshareNote(note.id, username).then(updateSharedUsersList);
                        });
                    });
                });
        }

        updateSharedUsersList();

        shareSubmit.addEventListener('click', () => {
            const username = document.getElementById('share-username').value;
            shareNote(note.id, username).then(() => {
                document.getElementById('share-username').value = '';
                updateSharedUsersList();
            });
        });

        closeModal.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    function shareNote(noteId, username) {
        return fetch(`/api/notes/${noteId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert('Note shared successfully');
                fetchNotes();
            }
        });
    }

    function unshareNote(noteId, username) {
        return fetch(`/api/notes/${noteId}/unshare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert('Note unshared successfully');
                fetchNotes();
            }
        });
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
                showNoteList();
                fetchNotes();
            });
        } else {
            // Create new note
            fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            }).then(() => {
                showNoteList();
                fetchNotes();
            });
        }

        noteForm.reset();
        quill.root.innerHTML = '';
    });

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = e.target.value.trim();
            if (searchTerm.length > 0) {
                searchNotes(searchTerm);
            } else {
                fetchNotes();
            }
        }, 300);
    });

    function searchNotes(query) {
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                noteList.innerHTML = '';
                data.forEach(note => {
                    const noteCard = createNoteCard(note);
                    noteList.appendChild(noteCard);
                });
            })
            .catch(error => {
                console.error('Error searching notes:', error);
                noteList.innerHTML = '<p>Error searching notes. Please try again later.</p>';
            });
    }

    newNoteBtn.addEventListener('click', () => {
        currentNoteId = null;
        noteForm.reset();
        showNoteForm();
        quill.root.innerHTML = '';
        submitBtn.textContent = 'Add Note';
    });

    backToListBtn.addEventListener('click', () => {
        showNoteList();
        fetchNotes();
    });

    showLoginForm();
});
