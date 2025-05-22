// Trainees management functionality with validation
Auth.redirectIfNotLoggedIn();
Auth.displayUserInfo();

// Global variables
let currentPage = 1;
let totalPages = 1;
let editingTraineeId = null;

// Logout handler
document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
});

// Load trainees data
async function loadTrainees(page = 1) {
    try {
        currentPage = page;
        const response = await api.getTrainees(page, CONFIG.DEFAULT_PAGE_SIZE);
        displayTrainees(response.data);
        updatePagination(response.pagination);
    } catch (error) {
        console.error('Error loading trainees:', error);
        showError('Error loading trainees: ' + error.message);
    }
}

function displayTrainees(trainees) {
    const tbody = document.getElementById('trainees-tbody');

    if (trainees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No trainees found</td></tr>';
        return;
    }

    tbody.innerHTML = trainees.map(trainee => `
        <tr>
            <td>${trainee.name}</td>
            <td>${trainee.email}</td>
            <td>${trainee.timezone || '-'}</td>
            <td>${formatDate(trainee.createdAt)}</td>
            <td>
                <button onclick="editTrainee('${trainee.id}')" class="btn btn-secondary">Edit</button>
                <button onclick="deleteTrainee('${trainee.id}')" class="btn btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');
}

function updatePagination(pagination) {
    totalPages = Math.ceil(pagination.total / pagination.pageSize);
    const paginationDiv = document.getElementById('pagination');

    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let buttons = '';

    // Previous button
    if (currentPage > 1) {
        buttons += `<button onclick="loadTrainees(${currentPage - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const active = i === currentPage ? 'active' : '';
        buttons += `<button onclick="loadTrainees(${i})" class="${active}">${i}</button>`;
    }

    // Next button
    if (currentPage < totalPages) {
        buttons += `<button onclick="loadTrainees(${currentPage + 1})">Next</button>`;
    }

    paginationDiv.innerHTML = buttons;
}

// Modal management
function openCreateModal() {
    editingTraineeId = null;
    document.getElementById('modal-title').textContent = 'Add New Trainee';
    document.getElementById('trainee-form').reset();
    document.getElementById('trainee-id').value = '';
    document.getElementById('trainee-password').setAttribute('required', '');

    // Clear validation messages
    clearValidationMessages();

    document.getElementById('trainee-modal').style.display = 'block';
}

async function editTrainee(id) {
    try {
        editingTraineeId = id;
        const trainee = await api.getTrainee(id);

        document.getElementById('modal-title').textContent = 'Edit Trainee';
        document.getElementById('trainee-id').value = trainee.id;
        document.getElementById('trainee-name').value = trainee.name;
        document.getElementById('trainee-email').value = trainee.email;
        document.getElementById('trainee-timezone').value = trainee.timezone || '';
        // Don't pre-fill password for security
        document.getElementById('trainee-password').value = '';
        document.getElementById('trainee-password').removeAttribute('required');

        // Clear validation messages
        clearValidationMessages();

        document.getElementById('trainee-modal').style.display = 'block';
    } catch (error) {
        console.error('Error fetching trainee:', error);
        showError('Error fetching trainee: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('trainee-modal').style.display = 'none';
    document.getElementById('modal-error').style.display = 'none';
    document.getElementById('trainee-password').setAttribute('required', '');
    clearValidationMessages();
}

function clearValidationMessages() {
    document.querySelectorAll('.validation-message').forEach(el => {
        el.style.display = 'none';
    });
}

// Delete trainee
async function deleteTrainee(id) {
    if (!confirm('Are you sure you want to delete this trainee?')) {
        return;
    }

    try {
        await api.deleteTrainee(id);
        showSuccess('Trainee deleted successfully');
        loadTrainees(currentPage);
    } catch (error) {
        console.error('Error deleting trainee:', error);
        showError('Error deleting trainee: ' + error.message);
    }
}

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Real-time validation setup
function setupFormValidation() {
    // Name validation
    document.getElementById('trainee-name').addEventListener('input', function() {
        const name = this.value;
        const validationElement = document.getElementById('name-validation');

        if (name === '') {
            validationElement.style.display = 'none';
            return;
        }

        if (name.trim() === '') {
            validationElement.textContent = 'Nimi ei või sisaldada ainult tühikuid';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else if (name !== name.trim()) {
            validationElement.textContent = 'Nimi ei või alata ega lõppeda tühikutega';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else {
            validationElement.textContent = 'Nimi on kehtiv';
            validationElement.style.color = 'green';
            validationElement.style.display = 'block';
        }
    });

    // Email validation
    document.getElementById('trainee-email').addEventListener('input', function() {
        const email = this.value;
        const validationElement = document.getElementById('email-validation');

        if (email === '') {
            validationElement.style.display = 'none';
            return;
        }

        if (email.trim() === '') {
            validationElement.textContent = 'E-post ei või sisaldada ainult tühikuid';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else if (email !== email.trim()) {
            validationElement.textContent = 'E-post ei või alata ega lõppeda tühikutega';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        } else if (Auth.validateEmail(email.trim())) {
            validationElement.textContent = 'E-posti aadress on kehtiv';
            validationElement.style.color = 'green';
            validationElement.style.display = 'block';
        } else {
            validationElement.textContent = 'Vigane e-posti aadress';
            validationElement.style.color = 'red';
            validationElement.style.display = 'block';
        }
    });

    // Password validation
    document.getElementById('trainee-password').addEventListener('input', function() {
        const password = this.value;
        const validationElement = document.getElementById('password-validation');
        Auth.displayPasswordValidation(password, validationElement);
    });
}

// Modal event listeners
document.querySelector('.close').addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    const modal = document.getElementById('trainee-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Form submission
document.getElementById('trainee-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const traineeData = Object.fromEntries(formData);
    const modalError = document.getElementById('modal-error');

    try {
        // Validate and trim fields
        const requiredFields = editingTraineeId ?
            ['name', 'email'] : // Password not required for updates
            ['name', 'email', 'password'];

        const { trimmedFields, errors } = Auth.trimAndValidateFields(traineeData, requiredFields);

        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        // Validate email format
        if (!Auth.validateEmail(trimmedFields.email)) {
            throw new Error('Vigane e-posti aadress');
        }

        // Validate password if provided
        if (trimmedFields.password) {
            const passwordValidation = Auth.validatePassword(trimmedFields.password);
            if (!passwordValidation.isValid) {
                throw new Error(passwordValidation.message);
            }
        }

        // Check for whitespace issues in original values
        if (traineeData.name !== traineeData.name.trim()) {
            throw new Error('Nimi ei või alata ega lõppeda tühikutega');
        }
        if (traineeData.email !== traineeData.email.trim()) {
            throw new Error('E-post ei või alata ega lõppeda tühikutega');
        }

        // Remove empty password for edit operations
        if (editingTraineeId && !trimmedFields.password) {
            delete trimmedFields.password;
        }

        if (editingTraineeId) {
            // Update existing trainee
            await api.updateTrainee(editingTraineeId, trimmedFields);
            showSuccess('Treenija andmed uuendatud edukalt');
        } else {
            // Create new trainee
            await api.createTrainee(trimmedFields);
            showSuccess('Treenija loodud edukalt');
        }

        closeModal();
        loadTrainees(currentPage);
    } catch (error) {
        console.error('Error saving trainee:', error);
        modalError.textContent = error.message;
        modalError.style.display = 'block';
    }
});

// Initialize validation when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupFormValidation();
});

// Load trainees on page load
loadTrainees();